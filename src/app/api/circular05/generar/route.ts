import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { generarBuffer, DatosCircular05 } from "@/lib/generador-circular05";
import { obtenerCicloActual } from "@/lib/ciclo";

// POST - Generar documento .docx y registrar descarga
export async function POST(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string; cct?: string } | undefined;

    if (!session || user?.role !== "director") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const cct = user?.cct;
    if (!cct) {
        return NextResponse.json({ error: "CCT no encontrado" }, { status: 400 });
    }

    const escuela = await prisma.escuela.findUnique({ where: { cct } });
    if (!escuela) {
        return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    const ciclo = await obtenerCicloActual();
    if (!ciclo) {
        return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 404 });
    }

    // If cycle is not active, it's read-only
    if (!ciclo.activo) {
        return NextResponse.json({ error: "No se permiten modificaciones en ciclos escolares pasados o inactivos" }, { status: 403 });
    }

    // Verificar que el módulo esté activo (auto-crear config si no existe)
    let config = await prisma.circular05Config.findUnique({ where: { id: "singleton" } });
    if (!config) {
        config = await prisma.circular05Config.create({
            data: { id: "singleton", activo: false },
        });
    }
    if (!config.activo) {
        return NextResponse.json({ error: "El módulo Circular 05 no está habilitado. El administrador ATP debe activarlo primero." }, { status: 403 });
    }

    try {
        const body = await req.json();
        const datos: DatosCircular05 = body;

        // Generar el documento
        const buffer = await generarBuffer(datos);

        // Registrar la descarga
        await prisma.circular05Descarga.create({
            data: {
                escuelaId: escuela.id,
                cicloEscolarId: ciclo.id,
                datos: body,
            },
        });

        // Devolver el archivo .docx
        const discLabel = datos.gruposPorDisciplina && datos.gruposPorDisciplina.length > 0
            ? (datos.gruposPorDisciplina.length === 1
                ? datos.gruposPorDisciplina[0].disciplina.replace(/\s+/g, "_")
                : "MultiDisciplinas")
            : (datos.disciplinaRama || "General").replace(/\s+/g, "_");
        const nombreArchivo = `Proyecto_Circular05_${escuela.cct}_${discLabel}.docx`;

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
                "Content-Length": buffer.byteLength.toString(),
            },
        });
    } catch (error: any) {
        console.error("Error generando documento:", error);
        return NextResponse.json({ error: "Error generando documento: " + error.message }, { status: 500 });
    }
}
