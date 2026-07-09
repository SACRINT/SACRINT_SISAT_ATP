import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { analizarEntregaConIA } from "@/lib/pre-revision";

export const maxDuration = 60; // Allow up to 60 seconds for Gemini + Cloudinary download on Vercel

// GET: Obtener el resultado del pre-dictamen / pre-revisión de una entrega
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

        let preRevision = await prisma.preRevision.findUnique({
            where: { entregaId: id }
        });

        // Si no existe, podemos intentar correrla bajo demanda
        if (!preRevision) {
            console.log(`Pre-revision not found for delivery ${id}. Triggering on-demand analysis...`);
            await analizarEntregaConIA(id);
            preRevision = await prisma.preRevision.findUnique({
                where: { entregaId: id }
            });
        }

        return NextResponse.json(preRevision ? preRevision.resultado : null);
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
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;
        await analizarEntregaConIA(id);

        const preRevision = await prisma.preRevision.findUnique({
            where: { entregaId: id }
        });

        return NextResponse.json({ success: true, resultado: preRevision?.resultado ?? null });
    } catch (error: unknown) {
        console.error("POST Pre-revision force error:", error);
        return NextResponse.json({ error: "Error al forzar re-evaluación del pre-dictamen" }, { status: 500 });
    }
}
