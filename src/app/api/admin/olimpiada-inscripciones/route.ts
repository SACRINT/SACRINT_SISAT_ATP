import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET: List all inscriptions (with optional CSV export)
export async function GET(req: NextRequest) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || !["ATP", "ATP_ADMIN", "SUPER_ADMIN", "ATP_LECTOR"].includes(user?.role || "")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const inscripciones = await prisma.inscripcionOlimpiada.findMany({
        include: { escuela: { select: { id: true, cct: true, nombre: true } } },
        orderBy: { createdAt: "desc" },
    });

    const format = req.nextUrl.searchParams.get("format");

    if (format === "csv") {
        let csv = "CCT,Escuela,Alumno,Grado,CURP,Fecha Registro\n";
        for (const insc of inscripciones) {
            const datos = insc.datos as { alumnos?: { nombre: string; grado: string; curp: string }[] };
            const alumnos = datos.alumnos || [];
            for (const al of alumnos) {
                csv += `"${insc.escuela.cct}","${insc.escuela.nombre}","${al.nombre}","${al.grado}","${al.curp}","${insc.createdAt.toISOString().split("T")[0]}"\n`;
            }
        }
        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": "attachment; filename=olimpiada_matematicas_2026.csv",
            },
        });
    }

    const result = inscripciones.map((insc) => {
        const datos = insc.datos as { alumnos?: { nombre: string; grado: string; curp: string }[] };
        return {
            id: insc.escuela.id,
            cct: insc.escuela.cct,
            nombre: insc.escuela.nombre,
            alumnos: datos.alumnos || [],
            fecha: insc.createdAt.toISOString().split("T")[0],
        };
    });

    return NextResponse.json(result);
}

// DELETE: Cancel a school's inscription (admin)
export async function DELETE(req: NextRequest) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || !["ATP", "ATP_ADMIN", "SUPER_ADMIN"].includes(user?.role || "")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const escuelaId = req.nextUrl.searchParams.get("escuelaId");
    if (!escuelaId) return NextResponse.json({ error: "escuelaId requerido" }, { status: 400 });

    await prisma.inscripcionOlimpiada.deleteMany({ where: { escuelaId } });
    return NextResponse.json({ success: true });
}
