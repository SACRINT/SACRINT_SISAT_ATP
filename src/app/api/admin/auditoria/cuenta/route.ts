import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Obtener la cuenta de auditoría configurada para el tenant de la sesión
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

        const cuenta = await prisma.cuentaAuditoria.findFirst({
            where: { tenantId },
            include: {
                _count: {
                    select: {
                        mensajes: true,
                        conversaciones: true,
                        adjuntos: true,
                    },
                },
                syncStates: {
                    orderBy: { iniciadoEn: "desc" },
                    take: 5,
                },
            },
        });

        return NextResponse.json(cuenta || null);
    } catch (error: any) {
        console.error("Error al obtener CuentaAuditoria:", error);
        return NextResponse.json({ error: "Error al cargar la cuenta de auditoría" }, { status: 500 });
    }
}

// POST - Guardar o actualizar la cuenta de auditoría
export async function POST(request: NextRequest) {
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

        const body = await request.json();
        const { email, nombreTitular, tipoFuente, directorioCorpus } = body;

        if (!email || !email.trim()) {
            return NextResponse.json({ error: "El correo electrónico es requerido" }, { status: 400 });
        }

        // Buscar si ya existe para este tenant o por email
        const existing = await prisma.cuentaAuditoria.findFirst({
            where: {
                OR: [
                    { email: email.trim() },
                    { tenantId },
                ],
            },
        });

        let cuenta;
        if (existing) {
            cuenta = await prisma.cuentaAuditoria.update({
                where: { id: existing.id },
                data: {
                    email: email.trim(),
                    nombreTitular: nombreTitular?.trim() || null,
                    tipoFuente: tipoFuente || "CORPUS_LOCAL",
                    directorioCorpus: directorioCorpus?.trim() || null,
                    tenantId,
                },
            });
        } else {
            cuenta = await prisma.cuentaAuditoria.create({
                data: {
                    email: email.trim(),
                    nombreTitular: nombreTitular?.trim() || null,
                    tipoFuente: tipoFuente || "CORPUS_LOCAL",
                    directorioCorpus: directorioCorpus?.trim() || null,
                    tenantId,
                },
            });
        }

        return NextResponse.json(cuenta);
    } catch (error: any) {
        console.error("Error al guardar CuentaAuditoria:", error);
        return NextResponse.json({ error: error?.message || "Error al guardar la cuenta" }, { status: 500 });
    }
}
