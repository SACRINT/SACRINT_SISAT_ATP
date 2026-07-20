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

    if (user.role === "director") {
        const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
        if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
        escuelaId = escuela.id;
    } else if (user.role === "admin") {
        const todas = searchParams.get("todas") === "true";
        if (!todas) {
            escuelaId = searchParams.get("escuelaId") || undefined;
        }
        // si todas=true, escuelaId queda undefined → sin filtro → devuelve todo
    } else if (user.role === "supervision") {
        const todas = searchParams.get("todas") === "true";
        if (todas) {
            escuelaId = searchParams.get("escuelaId") || undefined;
        } else {
            const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
            if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
            escuelaId = escuela.id;
        }
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

    if (!session || (user?.role !== "director" && user?.role !== "supervision" && user?.role !== "admin")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();

    let resolvedEscuelaId: string;
    if (user?.role === "admin") {
        // Admin must specify escuelaId directly in the body
        if (!body.escuelaId) {
            return NextResponse.json({ error: "escuelaId es obligatorio para administradores" }, { status: 400 });
        }
        resolvedEscuelaId = body.escuelaId;
    } else {
        const escuela = await prisma.escuela.findUnique({ where: { cct: user!.cct! } });
        if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
        resolvedEscuelaId = escuela.id;
    }

    const body2 = body; // alias – we already parsed body above
    const { nombre, apellidoPaterno, apellidoMaterno, sexo, cargo, curp, rfc, telefono, correoElectronico, gradoAcademico, fechaIngreso, clavePresupuestal } = body2;

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
        where: { escuelaId: resolvedEscuelaId },
        orderBy: { orden: "desc" },
    });

    const personal = await prisma.personal.create({
        data: {
            escuelaId: resolvedEscuelaId,
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
            clavePresupuestal: clavePresupuestal?.trim() || null,
            orden: (lastPersonal?.orden ?? 0) + 1,
        },
        include: {
            documentos: true,
            escuela: { select: { id: true, cct: true, nombre: true } },
        },
    });

    return NextResponse.json(personal, { status: 201 });
}
