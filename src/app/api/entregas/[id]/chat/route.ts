import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds (Vercel Hobby max) for long LLM responses

// GET - Obtener el historial de chat para una entrega
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id: entregaId } = await params;

        // Validar que la entrega exista y que pertenezca a la escuela del director (si es rol director)
        const entrega = await prisma.entrega.findUnique({
            where: { id: entregaId },
            include: { escuela: true },
        });

        if (!entrega) {
            return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
        }

        const user = session.user as any;
        if (user.role !== "admin" && user.role !== "atp" && user.cct !== entrega.escuela.cct) {
            return NextResponse.json({ error: "No tienes permiso para ver este chat" }, { status: 403 });
        }

        // Obtener historial de mensajes ordenados por fecha
        const mensajes = await prisma.chatMensaje.findMany({
            where: { entregaId },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json(mensajes);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error al obtener el chat" }, { status: 500 });
    }
}

// POST - Enviar un nuevo mensaje del director y obtener respuesta de la IA
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id: entregaId } = await params;
        const { message } = await req.json();

        if (!message || message.trim() === "") {
            return NextResponse.json({ error: "El mensaje no puede estar vacío" }, { status: 400 });
        }

        // 1. Obtener detalles de la entrega con su período y programa
        const entrega = await prisma.entrega.findUnique({
            where: { id: entregaId },
            include: { 
                escuela: true,
                periodoEntrega: {
                    include: {
                        programa: true
                    }
                },
                preRevision: true
            },
        });

        if (!entrega) {
            return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
        }

        const user = session.user as any;
        // Solo el director propietario de la escuela, o un administrador, pueden usar el chat
        if (user.role !== "admin" && user.role !== "atp" && user.cct !== entrega.escuela.cct) {
            return NextResponse.json({ error: "No tienes permiso para interactuar en este chat" }, { status: 403 });
        }

        // 2. Obtener el historial previo de mensajes en base de datos
        const prevMensajes = await prisma.chatMensaje.findMany({
            where: { entregaId },
            orderBy: { createdAt: "asc" },
        });

        // 3. Construir las instrucciones del sistema contextuales
        const programaNombre = entrega.periodoEntrega.programa.nombre;
        const escuelaNombre = entrega.escuela.nombre;
        const escuelaCct = entrega.escuela.cct;
        
        let preRevisionCtx = "No hay observaciones preliminares registradas.";
        if (entrega.preRevision && entrega.preRevision.resultado) {
            try {
                const resObj = entrega.preRevision.resultado as any;
                preRevisionCtx = `Explicación de Observaciones/Recomendaciones preliminares de la IA:\n${resObj.explanation || resObj.text || JSON.stringify(resObj)}`;
            } catch (e) {
                preRevisionCtx = "Error al parsear las observaciones de pre-revisión.";
            }
        }

        const systemInstruction = `Eres el Asistente de Correcciones Virtual de SISAT-ATP, una herramienta especializada en planeación y gestión escolar para la Supervisión Escolar.
Tu única misión es guiar, asesorar y responder dudas al Director de la escuela "${escuelaNombre}" (CCT: ${escuelaCct}) sobre cómo mejorar y solventar las observaciones preliminares de su documento "${programaNombre}".

A continuación tienes el contexto del estado actual:
----------------------------------------
DOCUMENTO EVALUADO: ${programaNombre}
REPORTE PRELIMINAR DE LA AUTOEVALUACIÓN:
${preRevisionCtx}
----------------------------------------

Reglas de Comportamiento:
1. Sé extremadamente respetuoso, profesional, claro y motivador. El director es una autoridad escolar.
2. Basándote en el reporte preliminar y las dudas del director, dale sugerencias concretas, ejemplos prácticos de metas, objetivos, acciones o evidencias según corresponda.
3. IMPORTANTE: Si el director te hace preguntas fuera de contexto (ej. temas generales, preguntas técnicas de programación, recetas, entretenimiento, etc.), niégate de manera muy amable indicando que tu único rol es asistirle en la corrección de su planeación escolar (${programaNombre}).
4. Sé conciso y responde directamente en español. Evita respuestas extremadamente largas; prefiere respuestas enfocadas y fáciles de leer.`;

        // 4. Formatear la conversación para la API
        let promptWithHistory = "A continuación se muestra el historial del chat:\n\n";
        for (const msg of prevMensajes) {
            const senderName = msg.role === "user" ? "Director" : "Asistente";
            promptWithHistory += `[${senderName}]: ${msg.content}\n`;
        }
        promptWithHistory += `[Director]: ${message}\n[Asistente]:`;

        // 5. Llamar al orquestador multiproveedor
        console.log(`[copiloto-chat] Solicitando respuesta de IA para entrega ${entregaId} y mensaje de ${message.length} chars...`);
        const aiResponse = await callGemini(
            systemInstruction,
            promptWithHistory,
            undefined, // no enviamos binario en el chat en cada mensaje por rendimiento
            "application/pdf",
            undefined, // no forzamos JSON schema en el chat conversacional para mayor soltura
            false, // usar modelo estándar para directores
            entrega.escuelaId
        );

        // 6. Guardar los mensajes en la base de datos de manera atómica
        const [userMsgSaved, assistantMsgSaved] = await prisma.$transaction([
            prisma.chatMensaje.create({
                data: {
                    entregaId,
                    role: "user",
                    content: message.trim(),
                }
            }),
            prisma.chatMensaje.create({
                data: {
                    entregaId,
                    role: "assistant",
                    content: aiResponse.trim(),
                }
            })
        ]);

        return NextResponse.json({
            userMessage: userMsgSaved,
            aiMessage: assistantMsgSaved
        }, { status: 201 });

    } catch (error: any) {
        console.error("[copiloto-chat] Error:", error);
        return NextResponse.json({ error: error.message || "Error al procesar el chat" }, { status: 500 });
    }
}

// DELETE - Borrar el historial de chat para una entrega
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id: entregaId } = await params;

        // Validar que la entrega exista y que pertenezca a la escuela del director (si es rol director)
        const entrega = await prisma.entrega.findUnique({
            where: { id: entregaId },
            include: { escuela: true },
        });

        if (!entrega) {
            return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
        }

        const user = session.user as any;
        if (user.role !== "admin" && user.role !== "atp" && user.cct !== entrega.escuela.cct) {
            return NextResponse.json({ error: "No tienes permiso para borrar este chat" }, { status: 403 });
        }

        // Borrar todos los mensajes del chat
        await prisma.chatMensaje.deleteMany({
            where: { entregaId },
        });

        return NextResponse.json({ success: true, message: "Chat reiniciado con éxito" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error al reiniciar el chat" }, { status: 500 });
    }
}
