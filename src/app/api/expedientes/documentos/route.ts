import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Listar documentos de un personal
export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const personalId = searchParams.get("personalId");
    if (!personalId) return NextResponse.json({ error: "personalId requerido" }, { status: 400 });

    const documentos = await prisma.documentoPersonal.findMany({
        where: { personalId },
        orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(documentos);
}

// POST - Crear/subir un documento o marcar que no tiene
export async function POST(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string; cct?: string } | undefined;

    if (!session || (user?.role !== "director" && user?.role !== "admin")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { personalId, tipoDocumento, etiqueta, archivoNombre, archivoDriveId, archivoDriveUrl, noTiene } = body;

    if (!personalId || !tipoDocumento) {
        return NextResponse.json({ error: "personalId y tipoDocumento son obligatorios" }, { status: 400 });
    }

    // Verify the personal exists
    const personal = await prisma.personal.findUnique({
        where: { id: personalId },
        include: { escuela: true },
    });
    if (!personal) return NextResponse.json({ error: "Personal no encontrado" }, { status: 404 });

    if (user?.role === "director") {
        const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
        if (!escuela || escuela.id !== personal.escuelaId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }
    }

    // Get next orden for this personal's docs
    const lastDoc = await prisma.documentoPersonal.findFirst({
        where: { personalId },
        orderBy: { orden: "desc" },
    });

    const documento = await prisma.documentoPersonal.create({
        data: {
            personalId,
            tipoDocumento,
            etiqueta: etiqueta?.trim() || null,
            archivoNombre: archivoNombre || null,
            archivoDriveId: archivoDriveId || null,
            archivoDriveUrl: archivoDriveUrl || null,
            noTiene: !!noTiene,
            orden: (lastDoc?.orden ?? 0) + 1,
        },
    });

    return NextResponse.json(documento, { status: 201 });
}
