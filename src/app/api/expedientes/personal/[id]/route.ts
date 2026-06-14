import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { deleteFileFromCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

// PATCH - Actualizar datos de un personal
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const user = session?.user as { role?: string; cct?: string } | undefined;
    if (!session || !user?.role) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const personal = await prisma.personal.findUnique({
        where: { id },
        include: { escuela: true },
    });

    if (!personal) return NextResponse.json({ error: "Personal no encontrado" }, { status: 404 });

    // Directors can only edit their own school's personnel
    if (user.role === "director") {
        const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
        if (!escuela || escuela.id !== personal.escuelaId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.curp !== undefined && body.curp !== null && body.curp.trim() !== "") {
        const cleanedCurp = body.curp.trim().toUpperCase();
        if (!/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(cleanedCurp)) {
            return NextResponse.json({ error: "El formato de CURP es inválido" }, { status: 400 });
        }
        updateData.curp = cleanedCurp;
    } else if (body.curp === null || body.curp === "") {
        updateData.curp = null;
    }

    if (body.rfc !== undefined && body.rfc !== null && body.rfc.trim() !== "") {
        const cleanedRfc = body.rfc.trim().toUpperCase();
        if (!/^[A-Z&Ñ]{4}\d{6}[A-Z0-9]{3}$/.test(cleanedRfc)) {
            return NextResponse.json({ error: "El formato de RFC es inválido" }, { status: 400 });
        }
        updateData.rfc = cleanedRfc;
    } else if (body.rfc === null || body.rfc === "") {
        updateData.rfc = null;
    }

    const allowedFields = ["nombre", "apellidoPaterno", "apellidoMaterno", "sexo", "cargo", "telefono", "correoElectronico", "gradoAcademico", "fechaIngreso"];
    for (const field of allowedFields) {
        if (body[field] !== undefined) {
            if (field === "fechaIngreso") {
                updateData[field] = body[field] ? new Date(body[field]) : null;
            } else {
                updateData[field] = typeof body[field] === "string" ? body[field].trim() || null : body[field];
            }
        }
    }

    const updated = await prisma.personal.update({
        where: { id },
        data: updateData,
        include: {
            documentos: { orderBy: { orden: "asc" } },
            escuela: { select: { id: true, cct: true, nombre: true } },
        },
    });

    return NextResponse.json(updated);
}

// DELETE - Eliminar personal y todos sus documentos
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const user = session?.user as { role?: string; cct?: string } | undefined;
    if (!session || !user?.role) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const personal = await prisma.personal.findUnique({
        where: { id },
        include: { documentos: true, escuela: true },
    });

    if (!personal) return NextResponse.json({ error: "Personal no encontrado" }, { status: 404 });

    // Directors can only delete their own school's personnel
    if (user.role === "director") {
        const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
        if (!escuela || escuela.id !== personal.escuelaId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }
    }

    // Delete files from Cloudinary
    for (const doc of personal.documentos) {
        if (doc.archivoDriveId) {
            try { await deleteFileFromCloudinary(doc.archivoDriveId); } catch { /* ignore */ }
        }
    }

    await prisma.personal.delete({ where: { id } });

    return NextResponse.json({ success: true });
}
