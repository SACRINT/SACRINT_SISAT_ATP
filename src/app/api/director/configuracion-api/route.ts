import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper to mask key for security (returns e.g. "AIzaSy...xxxx")
function maskApiKey(key: string | null): string {
    if (!key) return "";
    const trimmed = key.trim();
    if (trimmed.length <= 10) return "************";
    return `${trimmed.substring(0, 6)}...${trimmed.substring(trimmed.length - 4)}`;
}

// GET - Obtener la clave API actual enmascarada
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const user = session.user as any;
        if (user.role !== "director" && user.role !== "supervision") {
            return NextResponse.json({ error: "Permiso denegado. Solo directores y supervisores pueden acceder." }, { status: 403 });
        }

        // Buscar escuela por CCT
        const escuela = await prisma.escuela.findUnique({
            where: { cct: user.cct },
            select: { geminiApiKey: true }
        });

        if (!escuela) {
            return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
        }

        return NextResponse.json({
            geminiApiKey: escuela.geminiApiKey ? maskApiKey(escuela.geminiApiKey) : "",
            hasKey: !!escuela.geminiApiKey
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error al obtener la configuración de API" }, { status: 500 });
    }
}

// POST - Guardar/Actualizar la clave API
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const user = session.user as any;
        if (user.role !== "director" && user.role !== "supervision") {
            return NextResponse.json({ error: "Permiso denegado" }, { status: 403 });
        }

        const { geminiApiKey } = await req.json();

        // Validar escuela
        const escuela = await prisma.escuela.findUnique({
            where: { cct: user.cct }
        });

        if (!escuela) {
            return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
        }

        // Si viene en blanco o nulo, interpretamos que desea borrarla (volver a usar pool general)
        const updatedKey = geminiApiKey && geminiApiKey.trim() !== "" ? geminiApiKey.trim() : null;

        // Actualizar clave en la BD
        await prisma.escuela.update({
            where: { cct: user.cct },
            data: { geminiApiKey: updatedKey }
        });

        return NextResponse.json({
            success: true,
            message: updatedKey ? "Clave de API guardada exitosamente" : "Clave de API eliminada (usando pool del supervisor)",
            geminiApiKey: updatedKey ? maskApiKey(updatedKey) : "",
            hasKey: !!updatedKey
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error al guardar la clave de API" }, { status: 500 });
    }
}
