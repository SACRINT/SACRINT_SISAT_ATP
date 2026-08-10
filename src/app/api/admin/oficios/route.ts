/**
 * GET  /api/admin/oficios        — lista paginada de oficios del tenant
 * POST /api/admin/oficios        — crear oficio manualmente (sin archivo)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarError } from "@/lib/error-log";
import {
    getOficioConfig,
    calcularCriticidad,
} from "@/lib/oficios/oficios-engine";

export const dynamic = "force-dynamic";

// ── GET: Listar oficios ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    let tenantId: string | undefined;
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        if (!session || !["admin", "supervision", "atp"].includes(user?.role ?? "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Usuario sin organización/tenant asignado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
        const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
        const estado = searchParams.get("estado") ?? undefined;
        const criticidad = searchParams.get("criticidad") ?? undefined;
        const q = searchParams.get("q") ?? undefined;

        const where = {
            tenantId,
            ...(estado ? { estado: estado as "RECIBIDO" | "ENVIADO" | "ACUSADO" | "VENCIDO" | "CANCELADO" } : {}),
            ...(criticidad ? { criticidad: criticidad as "VERDE" | "AMARILLO" | "ROJO" } : {}),
            ...(q
                ? {
                      OR: [
                          { numeroOficio: { contains: q, mode: "insensitive" as const } },
                          { asunto: { contains: q, mode: "insensitive" as const } },
                          { remitenteNombre: { contains: q, mode: "insensitive" as const } },
                      ],
                  }
                : {}),
        };

        const [total, oficios] = await Promise.all([
            prisma.oficio.count({ where }),
            prisma.oficio.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [{ fechaLimite: "asc" }, { createdAt: "desc" }],
                include: {
                    _count: { select: { destinatarios: true } },
                    destinatarios: {
                        select: {
                            id: true,
                            escuelaNombre: true,
                            acuseRecibido: true,
                            confirmadoATP: true,
                        },
                    },
                },
            }),
        ]);

        const config = await getOficioConfig(tenantId);

        return NextResponse.json({
            oficios,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            config: {
                umbralRojoHoras: config.umbralRojoHoras,
                umbralAmarilloHoras: config.umbralAmarilloHoras,
            },
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al obtener oficios";
        const stack = error instanceof Error ? error.stack : undefined;
        await registrarError(tenantId, { ruta: "/api/admin/oficios", metodo: "GET", mensaje: msg, stack });
        console.error("[GET /api/admin/oficios]", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ── POST: Crear oficio manualmente ───────────────────────────────────────────
export async function POST(req: NextRequest) {
    let tenantId: string | undefined;
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        if (!session || !["admin", "supervision", "atp"].includes(user?.role ?? "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Usuario sin organización/tenant asignado" }, { status: 401 });
        }

        const body = (await req.json()) as {
            numeroOficio?: string;
            asunto?: string;
            remitenteNombre?: string;
            remitenteEmail?: string;
            fechaLimite?: string;
            notas?: string;
            esRecibido?: boolean;
        };

        if (!body.numeroOficio?.trim()) {
            return NextResponse.json({ error: "numeroOficio es requerido" }, { status: 400 });
        }
        if (!body.asunto?.trim()) {
            return NextResponse.json({ error: "asunto es requerido" }, { status: 400 });
        }

        const config = await getOficioConfig(tenantId);
        const fechaLimite = body.fechaLimite ? new Date(body.fechaLimite) : null;
        const criticidad = calcularCriticidad(
            fechaLimite,
            config.umbralRojoHoras,
            config.umbralAmarilloHoras
        );

        const oficio = await prisma.oficio.create({
            data: {
                tenantId,
                numeroOficio: body.numeroOficio.trim(),
                asunto: body.asunto.trim(),
                remitenteNombre: body.remitenteNombre?.trim() || null,
                remitenteEmail: body.remitenteEmail?.trim() || null,
                fechaLimite,
                criticidad,
                esRecibido: body.esRecibido ?? true,
                notas: body.notas?.trim() || null,
            },
        });

        return NextResponse.json({ oficio }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al crear oficio";
        const stack = error instanceof Error ? error.stack : undefined;
        await registrarError(tenantId, { ruta: "/api/admin/oficios", metodo: "POST", mensaje: msg, stack });
        console.error("[POST /api/admin/oficios]", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
