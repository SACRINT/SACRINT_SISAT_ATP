import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { generarBuffer, DatosCircular05 } from "@/lib/generador-circular05";

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

    // Verificar que el módulo esté activo
    const config = await prisma.circular05Config.findUnique({ where: { id: "singleton" } });
    if (!config?.activo) {
        return NextResponse.json({ error: "El módulo Circular 05 no está habilitado" }, { status: 403 });
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
                datos: body,
            },
        });

        // Devolver el archivo .docx
        const nombreArchivo = `Proyecto_Circular05_${escuela.cct}_${datos.disciplinaRama.replace(/\s+/g, "_")}.docx`;

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
