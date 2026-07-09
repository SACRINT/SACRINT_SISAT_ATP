import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { analizarEntregaConIA, downloadFile, extractTextFromPdf } from "@/lib/pre-revision";

export const maxDuration = 60; // Allow up to 60 seconds for Gemini + Cloudinary download on Vercel

// GET: Obtener el resultado del pre-dictamen / pre-revisión de una entrega, o realizar acciones de chunking
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action");

        // ── CHUNKING ACTION: info ──
        if (action === "info") {
            const entrega = await prisma.entrega.findUnique({
                where: { id },
                include: { archivos: true }
            });
            if (!entrega || entrega.archivos.length === 0) {
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
            
            // For PDF, we download the buffer and check page count
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

            const entrega = await prisma.entrega.findUnique({
                where: { id },
                include: { archivos: true }
            });
            if (!entrega || entrega.archivos.length === 0) {
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

        return NextResponse.json(preRevision ? preRevision.resultado : null);
    } catch (error: unknown) {
        console.error("GET Pre-revision error:", error);
        return NextResponse.json({ error: "Error al obtener pre-dictamen" }, { status: 500 });
    }
}

// POST: Forzar la re-evaluación del pre-dictamen (acepta opcionalmente textoCompleto en el body)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;
        
        let textoCompleto: string | undefined = undefined;
        try {
            const body = await req.json();
            textoCompleto = body.textoCompleto;
        } catch (_) {}

        await analizarEntregaConIA(id, textoCompleto);

        const preRevision = await prisma.preRevision.findUnique({
            where: { entregaId: id }
        });

        return NextResponse.json({ success: true, resultado: preRevision?.resultado ?? null });
    } catch (error: unknown) {
        console.error("POST Pre-revision force error:", error);
        return NextResponse.json({ error: "Error al forzar re-evaluación del pre-dictamen" }, { status: 500 });
    }
}
