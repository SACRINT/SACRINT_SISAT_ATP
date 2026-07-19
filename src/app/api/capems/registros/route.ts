import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const dynamic = "force-dynamic";

// GET - Listar registros de fichas CAPEM
export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; cct?: string } | undefined;
    const { searchParams } = new URL(req.url);
    const escuelaId = searchParams.get("escuelaId");

    let where: Record<string, any> = {};

    if (user?.role === "director" && user.cct) {
        const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct } });
        if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
        where.escuelaId = escuela.id;
    } else if ((user?.role === "admin" || user?.role === "supervision") && escuelaId) {
        where.escuelaId = escuelaId;
    }

    const registros = await prisma.capemFichaRegistro.findMany({
        where,
        include: {
            ficha: { select: { id: true, nombre: true } },
            capem: { select: { id: true, nombre: true } },
            escuela: { select: { id: true, cct: true, nombre: true } },
        },
        orderBy: [{ capem: { orden: "asc" } }, { createdAt: "asc" }],
    });

    return NextResponse.json(registros);
}

// POST - Crear un nuevo registro de ficha en un CAPEM (con subida de archivo)
export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; cct?: string } | undefined;
    const body = await req.json();
    const { capemId, fichaId, fileData } = body;

    if (!capemId || !fichaId) {
        return NextResponse.json({ error: "capemId y fichaId son requeridos" }, { status: 400 });
    }

    // Resolve escuelaId
    let escuelaId: string;
    if (user?.role === "director" && user.cct) {
        const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct } });
        if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
        escuelaId = escuela.id;
    } else {
        return NextResponse.json({ error: "Solo directores pueden crear registros" }, { status: 403 });
    }

    // Verify capem exists and is active
    const capem = await prisma.capem.findUnique({ where: { id: capemId } });
    if (!capem || !capem.activo) {
        return NextResponse.json({ error: "CAPEM no disponible" }, { status: 400 });
    }

    // Verify ficha exists and is active
    const ficha = await prisma.ficha.findUnique({ where: { id: fichaId } });
    if (!ficha || !ficha.activo) {
        return NextResponse.json({ error: "Ficha no disponible" }, { status: 400 });
    }

    const registro = await prisma.capemFichaRegistro.create({
        data: {
            escuelaId,
            capemId,
            fichaId,
            archivoNombre: fileData?.name || null,
            archivoDriveId: fileData?.publicId || null,
            archivoDriveUrl: fileData?.url || null,
            validoIA: fileData?.url ? "PENDIENTE" : null,
        },
        include: {
            ficha: { select: { id: true, nombre: true } },
            capem: { select: { id: true, nombre: true } },
        },
    });

    if (registro.archivoDriveUrl) {
        import("@/lib/ocr-validator").then(({ validarRegistroCapemConIA }) => {
            validarRegistroCapemConIA(registro.id).catch(err =>
                console.error("[capems-ocr] Error in background validation:", err)
            );
        });
    }

    return NextResponse.json(registro, { status: 201 });
}
