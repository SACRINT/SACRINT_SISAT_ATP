import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { analizarEntregaConIA, downloadFile, extractTextFromPdf } from "@/lib/pre-revision";
import { hasBackendAccess } from "@/lib/permissions";

export const maxDuration = 120; // Allow up to 120 seconds for Gemini + Cloudinary download on Vercel

// GET: Obtener el resultado del pre-dictamen / pre-revisión de una entrega, o realizar acciones de chunking
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const user = session.user as { role?: string; cct?: string } | undefined;
        const userRole = user?.role;
        const { id } = await params;

        // Fetch the entrega to verify school ownership if director
        const entrega = await prisma.entrega.findUnique({
            where: { id },
            include: { escuela: true, archivos: true }
        });

        if (!entrega) {
            return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
        }

        if (userRole === "director") {
            if (entrega.escuela.cct !== user?.cct) {
                return NextResponse.json({ error: "No autorizado para esta escuela" }, { status: 403 });
            }
        } else if (userRole !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action");

        // ── CHUNKING ACTION: info ──
        if (action === "info") {
            if (entrega.archivos.length === 0) {
                return NextResponse.json({ error: "Entrega o archivo no encontrado" }, { status: 404 });
            }
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (!file) {
                return NextResponse.json({ error: "Archivo principal no encontrado" }, { status: 404 });
            }
            
            const isDocx = file.nombre.toLowerCase().endsWith(".docx");
            if (isDocx) {
                return NextResponse.json({ format: "docx", totalPages: 1 });
            }
            
            // For PDF, download and count pages
            const buffer = await downloadFile(file.driveUrl!);
            const resPdf = await extractTextFromPdf(buffer, { start: 1, end: 1 });
            return NextResponse.json({ format: "pdf", totalPages: resPdf.total });
        }

        // ── CHUNKING ACTION: extract ──
        if (action === "extract") {
            const start = parseInt(searchParams.get("start") || "");
            const end = parseInt(searchParams.get("end") || "");
            if (isNaN(start) || isNaN(end)) {
                return NextResponse.json({ error: "Start and end pages required" }, { status: 400 });
            }

            if (entrega.archivos.length === 0) {
                return NextResponse.json({ error: "Entrega o archivo no encontrado" }, { status: 404 });
            }
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (!file) {
                return NextResponse.json({ error: "Archivo principal no encontrado" }, { status: 404 });
            }
            
            const buffer = await downloadFile(file.driveUrl!);
            const resPdf = await extractTextFromPdf(buffer, { start, end });
            return NextResponse.json({ text: resPdf.text });
        }

        // ── DEFAULT ACTION: Get saved pre-revision ──
        const preRevision = await prisma.preRevision.findUnique({
            where: { entregaId: id }
        });

        const aiConfig = await prisma.preRevisionConfig.findUnique({ where: { id: "singleton" } });

        const tieneEvaluacionActual = !!(
            preRevision &&
            preRevision.resultado &&
            (preRevision.resultado as any).tipo &&
            entrega.fechaSubida &&
            preRevision.updatedAt >= entrega.fechaSubida
        );

        return NextResponse.json({
            resultado: preRevision ? preRevision.resultado : null,
            intentosUsados: preRevision ? preRevision.intentosUsados : 0,
            limiteIntentos: aiConfig?.limiteIntentos ?? 3,
            activoDirectores: aiConfig?.activoDirectores ?? false,
            evaluacionActual: tieneEvaluacionActual
        });
    } catch (error: unknown) {
        console.error("GET Pre-revision error:", error);
        return NextResponse.json({ error: "Error al obtener pre-dictamen" }, { status: 500 });
    }
}

// POST: Forzar la re-evaluación del pre-dictamen
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const user = session.user as { role?: string; cct?: string; dbRole?: string; permisos?: any } | undefined;
        const userRole = user?.role;
        const { id } = await params;

        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action");

        if (action === "reset") {
            if (userRole !== "admin") {
                return NextResponse.json({ error: "No autorizado" }, { status: 403 });
            }
            if (!hasBackendAccess(user, "avances", "write")) {
                return NextResponse.json({ error: "No autorizado (sin permisos de escritura en avances)" }, { status: 403 });
            }
            const updated = await prisma.preRevision.upsert({
                where: { entregaId: id },
                update: { intentosUsados: 0 },
                create: { entregaId: id, resultado: {}, intentosUsados: 0 }
            });
            return NextResponse.json({
                success: true,
                intentosUsados: 0,
                resultado: updated.resultado
            });
        }

        // Fetch the entrega to verify school ownership if director
        const entrega = await prisma.entrega.findUnique({
            where: { id },
            include: { escuela: true }
        });

        if (!entrega) {
            return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
        }

        if (userRole === "director") {
            if (entrega.escuela.cct !== user?.cct) {
                return NextResponse.json({ error: "No autorizado para esta escuela" }, { status: 403 });
            }

            const aiConfig = await prisma.preRevisionConfig.findUnique({ where: { id: "singleton" } });
            const isAiActive = aiConfig?.activoDirectores ?? false;
            const limit = aiConfig?.limiteIntentos ?? 3;

            if (!isAiActive) {
                return NextResponse.json({ error: "La pre-revisión con IA no está habilitada para directores" }, { status: 403 });
            }

            const preRev = await prisma.preRevision.findUnique({ where: { entregaId: id } });
            const currentAttempts = preRev?.intentosUsados ?? 0;

            if (currentAttempts >= limit) {
                return NextResponse.json({ error: "Has alcanzado el límite de pre-evaluaciones con IA para esta entrega" }, { status: 403 });
            }

            // Increment attempts
            await prisma.preRevision.upsert({
                where: { entregaId: id },
                update: { intentosUsados: { increment: 1 } },
                create: { entregaId: id, resultado: {}, intentosUsados: 1 }
            });
        } else if (userRole !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        } else {
            if (!hasBackendAccess(user, "avances", "write")) {
                return NextResponse.json({ error: "No autorizado (sin permisos de escritura en avances)" }, { status: 403 });
            }
        }

        let textoCompleto: string | undefined = undefined;
        try {
            const body = await req.json();
            textoCompleto = body.textoCompleto;
        } catch (_) {}

        await analizarEntregaConIA(id, textoCompleto);

        const preRevision = await prisma.preRevision.findUnique({
            where: { entregaId: id }
        });

        const aiConfig = await prisma.preRevisionConfig.findUnique({ where: { id: "singleton" } });

        return NextResponse.json({
            success: true,
            resultado: preRevision?.resultado ?? null,
            intentosUsados: preRevision?.intentosUsados ?? 0,
            limiteIntentos: aiConfig?.limiteIntentos ?? 3,
            activoDirectores: aiConfig?.activoDirectores ?? false,
            evaluacionActual: true
        });
    } catch (error: any) {
        console.error("POST Pre-revision force error:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isRateLimit = errorMsg.toLowerCase().includes("agotado") || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("429") || errorMsg.toLowerCase().includes("limit");
        const status = isRateLimit ? 429 : 500;
        return NextResponse.json({ error: errorMsg }, { status });
    }
}
