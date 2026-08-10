import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;

        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const tenantId = user.organizacionId || user.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Usuario sin organización / tenant asignado" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const q = searchParams.get("q") || "";
        const bandeja = searchParams.get("bandeja"); // "BandejaEntrada" | "Enviados"
        const categoria = searchParams.get("categoria");
        const origen = searchParams.get("origen");
        const tipo = searchParams.get("tipo");
        const soloPlazos = searchParams.get("plazos") === "true";
        const soloAdjuntos = searchParams.get("adjuntos") === "true";
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "25", 10);
        const skip = (page - 1) * limit;

        const where: any = {
            tenantId,
        };

        if (bandeja) where.bandeja = bandeja;
        if (categoria) where.categoriaTematica = categoria;
        if (origen) where.clasificacionOrigen = origen;
        if (tipo) where.clasificacionTipo = tipo;
        if (soloPlazos) where.tieneSenalesPlazo = true;
        if (soloAdjuntos) where.tieneAdjuntos = true;

        if (q) {
            where.OR = [
                { asunto: { contains: q, mode: "insensitive" } },
                { remitenteEmail: { contains: q, mode: "insensitive" } },
                { remitenteNombre: { contains: q, mode: "insensitive" } },
                { resumenIA: { contains: q, mode: "insensitive" } },
            ];
        }

        const [total, mensajes] = await Promise.all([
            prisma.emailMessage.count({ where }),
            prisma.emailMessage.findMany({
                where,
                include: {
                    adjuntos: {
                        select: {
                            id: true,
                            nombre: true,
                            categoria: true,
                            extension: true,
                            tamanoBytes: true,
                            rutaMd: true,
                        },
                    },
                    conversation: {
                        select: {
                            hiloId: true,
                            numMensajes: true,
                            confianzaHilo: true,
                        },
                    },
                },
                orderBy: { fechaMensaje: "desc" },
                skip,
                take: limit,
            }),
        ]);

        return NextResponse.json({
            mensajes,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error: any) {
        console.error("Error al obtener mensajes de auditoría:", error);
        return NextResponse.json({ error: "Error al cargar los mensajes" }, { status: 500 });
    }
}
