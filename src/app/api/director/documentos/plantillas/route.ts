import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET: Listar plantillas para el Director
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "director") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        // Los directores solo pueden ver las plantillas configuradas y activas
        const plantillas = await prisma.plantillaDocumento.findMany({
            where: {
                estado: "CONFIGURADA"
            },
            orderBy: { createdAt: "desc" }
        });
        
        // Removemos datos sensibles si los hubiera, o devolvemos todo (configuracionCampos es necesario)
        return NextResponse.json(plantillas);
    } catch (error: any) {
        console.error("Error obteniendo plantillas para director:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
