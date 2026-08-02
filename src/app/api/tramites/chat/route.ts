import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { responderConsultaNormativa } from "@/lib/tramites/rag-engine";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await req.json();
    const { mensaje, escuelaId: reqEscuelaId } = body;
    const escuelaId = reqEscuelaId || user.escuelaId || user.id;

    if (!mensaje || !mensaje.trim()) {
      return NextResponse.json({ error: "El mensaje es requerido." }, { status: 400 });
    }

    // 1. Guardar mensaje de usuario en historial
    await prisma.chatTramitesMensaje.create({
      data: {
        usuarioId: user.id || "usuario_anonimo",
        role: "user",
        content: mensaje.trim()
      }
    });

    // 2. Ejecutar motor RAG con Gemini 3.5
    const resultadoRAG = await responderConsultaNormativa(mensaje.trim(), escuelaId);

    // 3. Guardar respuesta del asistente
    await prisma.chatTramitesMensaje.create({
      data: {
        usuarioId: user.id || "usuario_anonimo",
        role: "assistant",
        content: resultadoRAG.respuesta,
        fuentes: (resultadoRAG.fuentes as any) || undefined
      }
    });

    return NextResponse.json({
      success: true,
      respuesta: resultadoRAG.respuesta,
      fuentes: resultadoRAG.fuentes,
      huboFuentes: resultadoRAG.huboFuentes
    });
  } catch (error: any) {
    console.error("[api/tramites/chat] Error en POST:", error);
    return NextResponse.json({ error: "Error al procesar la consulta normativa" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const mensajes = await prisma.chatTramitesMensaje.findMany({
      orderBy: { createdAt: "asc" },
      take: 30
    });

    return NextResponse.json({ success: true, mensajes });
  } catch (error: any) {
    console.error("[api/tramites/chat] Error en GET:", error);
    return NextResponse.json({ error: "Error al obtener historial de chat" }, { status: 500 });
  }
}
