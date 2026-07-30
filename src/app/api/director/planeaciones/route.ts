/**
 * GET  /api/director/planeaciones          → Lista planeaciones de la escuela + estado de requisitos
 * POST /api/director/planeaciones          → Sube una nueva planeación y lanza revisión IA
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";
import { evaluarPlaneacion, determinarTipoEvaluacion } from "@/lib/planeaciones-evaluator";

export const maxDuration = 60;

// ── Verificación de requisitos previos ───────────────────────────────────────

async function verificarRequisitos(escuelaId: string) {
    const [config, escuela, entregaPaec] = await Promise.all([
        prisma.planeacionesConfig.findUnique({ where: { id: "singleton" } }),
        prisma.escuela.findUnique({ where: { id: escuelaId }, select: { geminiApiKey: true, permisos: true, esDePrueba: true } }),
        // Buscar si la escuela tiene PAEC-PEC aprobado o entregado en cualquier ciclo
        prisma.entrega.findFirst({
            where: {
                escuelaId,
                estado: { in: ["APROBADO", "EN_REVISION", "REQUIERE_CORRECCION", "ENTREGADO_FISICO"] },
                periodoEntrega: { programa: { nombre: { contains: "PAEC", mode: "insensitive" } } },
            },
            select: { id: true, estado: true, periodoEntrega: { select: { programa: { select: { nombre: true } } } } },
        }),
    ]);

    const modoSinRestricciones = config ? config.modoSinRestricciones : true;

    // ── Si es escuela de prueba O está en Modo Sin Restricciones ──
    if (escuela?.esDePrueba || modoSinRestricciones) {
        return {
            moduloHabilitado: true,
            tieneApiKey: true,
            tienePaecPec: true,
            requierePaecPec: false,
            requiereApiKey: false,
            puedeUsar: true,
            motivoBloqueo: null,
            entregaPaecPec: entregaPaec,
            modoSinRestricciones: true,
        };
    }

    const moduloHabilitado = (escuela?.permisos as any)?.planeacionesDesactivado !== true;
    const globalActivo = config ? config.activoGlobal : true;
    const requierePaecPec = config ? config.requierePaecPec : true;
    const requiereApiKey = config ? config.requiereApiKey : true;

    const tieneApiKey = !!(escuela?.geminiApiKey) || true; // también usa el pool del sistema
    const tienePaecPec = !!entregaPaec;

    return {
        moduloHabilitado: moduloHabilitado && globalActivo,
        tieneApiKey,
        tienePaecPec,
        requierePaecPec,
        requiereApiKey,
        puedeUsar: moduloHabilitado && globalActivo && (!requiereApiKey || tieneApiKey) && (!requierePaecPec || tienePaecPec),
        motivoBloqueo: !moduloHabilitado || !globalActivo
            ? "El módulo de Revisión de Planeaciones no está habilitado actualmente por la supervisión."
            : requierePaecPec && !tienePaecPec
                ? "Para usar la Revisión de Planeaciones Didácticas es obligatorio haber subido el PAEC-PEC de tu escuela. Dirígete al apartado de entregas y sube tu PAEC-PEC primero."
                : requiereApiKey && !tieneApiKey
                    ? "Se requiere una API Key activa de Gemini para usar este módulo. Configúrala en la sección de ajustes de tu perfil."
                    : null,
        entregaPaecPec: entregaPaec,
        modoSinRestricciones: false,
    };
}

// ── GET — Lista planeaciones + estado de requisitos ──────────────────────────

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const escuelaId = user.escuelaId as string;
    if (!escuelaId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const [requisitos, planeaciones] = await Promise.all([
        verificarRequisitos(escuelaId),
        prisma.planeacionDidactica.findMany({
            where: { escuelaId },
            orderBy: { fechaSubida: "desc" },
        }),
    ]);

    return NextResponse.json({
        requisitos: {
            puedeUsar: requisitos.puedeUsar,
            tieneApiKey: requisitos.tieneApiKey,
            tienePaecPec: requisitos.tienePaecPec,
            requierePaecPec: requisitos.requierePaecPec,
            requiereApiKey: requisitos.requiereApiKey,
            motivoBloqueo: requisitos.motivoBloqueo,
        },

        planeaciones,
        estadisticas: {
            total: planeaciones.length,
            revisadas: planeaciones.filter((p: any) => p.estado === "REVISADO").length,
            pendientes: planeaciones.filter((p: any) => p.estado === "PENDIENTE").length,
            conError: planeaciones.filter((p: any) => p.estado === "ERROR").length,
            promedioZona: planeaciones.reduce((acc: number, p: any) => acc + (p.puntajeObtenido ?? 0), 0) /
                (planeaciones.filter((p: any) => p.puntajeObtenido !== null).length || 1),
        },
    });
}

// ── POST — Sube planeación y lanza revisión IA ────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const escuelaId = user.escuelaId as string;
    const cct = user.cct as string;
    if (!escuelaId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Verificar requisitos previos
    const requisitos = await verificarRequisitos(escuelaId);
    if (!requisitos.puedeUsar) {
        return NextResponse.json({ error: requisitos.motivoBloqueo }, { status: 403 });
    }

    // Parsear el form data
    const formData = await req.formData();
    const archivo = formData.get("archivo") as File | null;
    const docenteNombre = formData.get("docenteNombre") as string;
    const docenteRFC = formData.get("docenteRFC") as string | undefined;
    const asignatura = formData.get("asignatura") as string;
    const semestreStr = formData.get("semestre") as string;
    const bloqueCorte = formData.get("bloqueCorte") as string | undefined;
    const tipoAsignatura = (formData.get("tipoAsignatura") as string) || "FUNDAMENTAL";

    if (!archivo || !docenteNombre || !asignatura || !semestreStr) {
        return NextResponse.json({ error: "Faltan campos obligatorios: archivo, docenteNombre, asignatura, semestre" }, { status: 400 });
    }

    const semestre = parseInt(semestreStr, 10);
    if (isNaN(semestre) || semestre < 1 || semestre > 6) {
        return NextResponse.json({ error: "El semestre debe ser un número del 1 al 6" }, { status: 400 });
    }

    // Subir archivo a Cloudinary
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const archivoTipo = archivo.name.toLowerCase().endsWith(".docx") ? "DOCX" : "PDF";
    const mimeType = archivoTipo === "DOCX" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf";

    let archivoUrl: string;
    let archivoNombre: string;
    try {
        const uploadResult = await uploadFileToCloudinary(
            buffer,
            archivo.name,
            mimeType,
            `planeaciones/${cct}/${new Date().getFullYear()}`,
            `${cct}_${asignatura.replace(/\s+/g, "_")}_sem${semestre}_${Date.now()}`
        );
        archivoUrl = uploadResult.url;
        archivoNombre = archivo.name;
    } catch (err: any) {
        return NextResponse.json({ error: "Error al subir el archivo: " + err.message }, { status: 500 });
    }

    // Crear registro inicial en BD
    const planeacion = await prisma.planeacionDidactica.create({
        data: {
            escuelaId,
            cct,
            docenteNombre,
            docenteRFC: docenteRFC || null,
            asignatura,
            semestre,
            bloqueCorte: bloqueCorte || null,
            tipoAsignatura,
            archivoUrl,
            archivoNombre,
            archivoTipo,
            estado: "EN_REVISION",
        },
    });

    // Lanzar revisión IA en background (sin await para respuesta rápida)
    revisarPlaneacionEnBackground(planeacion.id, {
        archivoUrl,
        archivoTipo,
        docenteNombre,
        asignatura,
        semestre,
        tipoAsignatura,
        bloqueCorte,
        escuelaId,
        cct,
        entregaPaecPec: requisitos.entregaPaecPec,
    }).catch(err => console.error("[planeaciones] Error en revisión background:", err));

    return NextResponse.json({ ok: true, planeacionId: planeacion.id, estado: "EN_REVISION" });
}

// ── Revisión asíncrona en background ─────────────────────────────────────────

async function revisarPlaneacionEnBackground(
    planeacionId: string,
    params: {
        archivoUrl: string;
        archivoTipo: string;
        docenteNombre: string;
        asignatura: string;
        semestre: number;
        tipoAsignatura: string;
        bloqueCorte?: string;
        escuelaId: string;
        cct: string;
        entregaPaecPec: any;
    }
) {
    try {
        // Descargar el PDF de planeación para pasarlo a la IA (inline fetch)
        let pdfBuffer: Buffer | undefined;
        let textoPlanificacion = "";
        try {
            const dlRes = await fetch(params.archivoUrl);
            if (dlRes.ok) {
                const arrBuf = await dlRes.arrayBuffer();
                pdfBuffer = Buffer.from(arrBuf);
            }
        } catch { /* si falla el download, continuamos con texto vacío */ }

        // Extraer texto del PAEC-PEC (si existe)
        let textoPaecPec = "No disponible — la escuela no ha subido su PAEC-PEC.";
        if (params.entregaPaecPec) {
            try {
                const archivos = await prisma.archivo.findMany({
                    where: { entregaId: params.entregaPaecPec.id },
                    select: { driveUrl: true },
                    take: 1,
                });
                if (archivos[0]?.driveUrl) {
                    // Nota: el texto del PAEC se incluirá en el prompt textual
                    textoPaecPec = `[Archivo PAEC-PEC disponible en: ${archivos[0].driveUrl}]`;
                }
            } catch { /* usa el fallback */ }
        }

        // Determinar tipo de evaluación
        const tipoEvaluacion = determinarTipoEvaluacion(params.semestre, params.tipoAsignatura);

        // Llamar al evaluador — pasa el buffer del PDF si está disponible
        const resultado = await evaluarPlaneacion({
            tipoEvaluacion,
            asignatura: params.asignatura,
            semestre: params.semestre,
            docenteNombre: params.docenteNombre,
            cct: params.cct,
            bloqueCorte: params.bloqueCorte,
            textoPlanificacion,
            textoPaecPec,
            pdfBuffer,
        });

        // Guardar resultados en BD
        await prisma.planeacionDidactica.update({
            where: { id: planeacionId },
            data: {
                estado: "REVISADO",
                puntajeObtenido: resultado.puntajeTotal,
                puntajeMaximo: resultado.puntajeMaximo,
                nivelCumplimiento: resultado.nivelCumplimiento,
                resultadoJson: {
                    rubricaUsada: resultado.rubricaUsada,
                    criterios: resultado.criterios,
                } as any,
                observacionesJson: {
                    puntosFuertes: resultado.puntosFuertes,
                    mejorasUrgentes: resultado.mejorasUrgentes,
                    observacionesExtendidas: resultado.observacionesExtendidas,
                    alineacionPaecPec: resultado.alineacionPaecPec,
                } as any,
                retroalimentacionDocente: resultado.retroalimentacionDocente,
                fechaRevision: new Date(),
                revisadoPor: "IA_GEMINI_3_5",
            },
        });
    } catch (err: any) {
        console.error("[planeaciones] Error en revisión IA:", err);
        await prisma.planeacionDidactica.update({
            where: { id: planeacionId },
            data: {
                estado: "ERROR",
                observacionesJson: { error: err.message } as any,
            },
        });
    }
}
