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
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "20", 10);
        const skip = (page - 1) * limit;

        const where: any = {
            tenantId,
        };

        if (q) {
            where.OR = [
                { asuntoNormalizado: { contains: q, mode: "insensitive" } },
                { razonUnion: { contains: q, mode: "insensitive" } },
            ];
        }

        const [total, hilos] = await Promise.all([
            prisma.emailConversation.count({ where }),
            prisma.emailConversation.findMany({
                where,
                include: {
                    mensajes: {
                        select: {
                            id: true,
                            bandeja: true,
                            fechaMensaje: true,
                            remitenteNombre: true,
                            remitenteEmail: true,
                            asunto: true,
                            resumenIA: true,
                            numAdjuntos: true,
                            tieneSenalesPlazo: true,
                        },
                        orderBy: { fechaMensaje: "asc" },
                    },
                },
                orderBy: { fechaFin: "desc" },
                skip,
                take: limit,
            }),
        ]);

        return NextResponse.json({
            hilos,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error: any) {
        console.error("Error al obtener hilos de auditoría:", error);
        return NextResponse.json({ error: "Error al cargar los hilos" }, { status: 500 });
    }
}
