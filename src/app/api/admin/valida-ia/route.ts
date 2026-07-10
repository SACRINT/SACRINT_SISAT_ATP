import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validarRegistroCapemConIA, validarDocumentoPersonalConIA } from "@/lib/ocr-validator";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;

        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        const body = await req.json();
        const { id, modulo } = body;

        if (!id || !modulo) {
            return NextResponse.json({ error: "id y modulo son obligatorios" }, { status: 400 });
        }

        let result;
        if (modulo === "CAPEMS") {
            result = await validarRegistroCapemConIA(id);
        } else if (modulo === "EXPEDIENTES") {
            result = await validarDocumentoPersonalConIA(id);
        } else {
            return NextResponse.json({ error: "Módulo no válido" }, { status: 400 });
        }

        return NextResponse.json({ success: true, result });
    } catch (err: any) {
        console.error("[valida-ia-route] Error:", err);
        return NextResponse.json({ error: err.message || "Error interno del servidor" }, { status: 500 });
    }
}
