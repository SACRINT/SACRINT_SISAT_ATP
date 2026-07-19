import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Listar personal (directores: su escuela, admins: filtrar por escuelaId)
export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; cct?: string };
    const { searchParams } = new URL(req.url);

    let escuelaId: string | undefined;

    if (user.role === "director" || user.role === "supervision") {
        const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
        if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
        escuelaId = escuela.id;
    } else if (user.role === "admin") {
        escuelaId = searchParams.get("escuelaId") || undefined;
    } else {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const where = escuelaId ? { escuelaId } : {};

    const personal = await prisma.personal.findMany({
        where,
        include: {
            documentos: { orderBy: { orden: "asc" } },
            escuela: { select: { id: true, cct: true, nombre: true } },
        },
        orderBy: [{ orden: "asc" }, { apellidoPaterno: "asc" }],
    });

    return NextResponse.json(personal);
}

// POST - Crear nuevo personal (solo directores)
export async function POST(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string; cct?: string } | undefined;

    if (!session || (user?.role !== "director" && user?.role !== "supervision")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
    if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });

    const body = await req.json();
    const { nombre, apellidoPaterno, apellidoMaterno, sexo, cargo, curp, rfc, telefono, correoElectronico, gradoAcademico, fechaIngreso } = body;

    if (!nombre?.trim() || !apellidoPaterno?.trim() || !apellidoMaterno?.trim() || !sexo || !cargo) {
        return NextResponse.json({ error: "Nombre, apellidos, sexo y cargo son obligatorios" }, { status: 400 });
    }

    if (curp?.trim() && !/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(curp.trim().toUpperCase())) {
        return NextResponse.json({ error: "El formato de CURP es inválido" }, { status: 400 });
    }

    if (rfc?.trim() && !/^[A-Z&Ñ]{4}\d{6}[A-Z0-9]{3}$/.test(rfc.trim().toUpperCase())) {
        return NextResponse.json({ error: "El formato de RFC es inválido" }, { status: 400 });
    }

    // Get next orden
    const lastPersonal = await prisma.personal.findFirst({
        where: { escuelaId: escuela.id },
        orderBy: { orden: "desc" },
    });

    const personal = await prisma.personal.create({
        data: {
            escuelaId: escuela.id,
            nombre: nombre.trim(),
            apellidoPaterno: apellidoPaterno.trim(),
            apellidoMaterno: apellidoMaterno.trim(),
            sexo,
            cargo,
            curp: curp?.trim()?.toUpperCase() || null,
            rfc: rfc?.trim()?.toUpperCase() || null,
            telefono: telefono?.trim() || null,
            correoElectronico: correoElectronico?.trim() || null,
            gradoAcademico: gradoAcademico || null,
            fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null,
            orden: (lastPersonal?.orden ?? 0) + 1,
        },
        include: {
            documentos: true,
            escuela: { select: { id: true, cct: true, nombre: true } },
        },
    });

    return NextResponse.json(personal, { status: 201 });
}
