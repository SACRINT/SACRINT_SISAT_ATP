import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const archivo = searchParams.get("archivo"); // "EVIDENCIA_FOTO" | "REGISTRO_PARTICIPANTES" | "CONTROL_EXCEL"

        let targetFilename = "";
        let contentType = "";

        if (archivo === "EVIDENCIA_FOTO") {
            targetFilename = "FORMATO PARA EVIDENCIA FOTOGRAFICA (DÍA NARANJA).docx";
            contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        } else if (archivo === "REGISTRO_PARTICIPANTES") {
            targetFilename = "FORMATO PARA REGISTRO DE PARTICIPANTES (DÍA NARANJA).docx";
            contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        } else if (archivo === "CONTROL_EXCEL") {
            targetFilename = "TEMAS_ACOSO ESCOLAR_2026 - Escuelas CEDAVIM.xlsx";
            contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        } else {
            return NextResponse.json({ error: "Archivo no especificado o inválido" }, { status: 400 });
        }

        const formatosDir = process.env.FORMATOS_DIR || path.join(process.cwd(), "Formatos_Oficiales");
        const filePath = path.join(formatosDir, targetFilename);
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: `El archivo ${targetFilename} no existe en Formatos_Oficiales` }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(filePath);

        return new Response(new Uint8Array(fileBuffer), {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${encodeURIComponent(targetFilename)}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : "Error interno al descargar la plantilla";
        console.error("Error al descargar plantilla oficial:", error);
        return NextResponse.json({ error: errMessage }, { status: 500 });
    }
}
