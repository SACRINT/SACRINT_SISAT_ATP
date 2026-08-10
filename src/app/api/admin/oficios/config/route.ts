/**
 * GET  /api/admin/oficios/config   — obtener OficioConfig del tenant
 * PATCH /api/admin/oficios/config  — actualizar OficioConfig del tenant
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOficioConfig } from "@/lib/oficios/oficios-engine";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type SessionUser = { role?: string; organizacionId?: string; tenantId?: string };

export async function GET(_req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as SessionUser | undefined;
        if (!session || !["admin", "supervision", "atp"].includes(user?.role ?? "")) {
            return NextResponse.json({ error: "Solo administradores y supervisión pueden ver la configuración" }, { status: 403 });
        }
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: "Sin tenant" }, { status: 401 });

        const config = await getOficioConfig(tenantId);
        return NextResponse.json({ config });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as SessionUser | undefined;
        if (!session || !["admin", "supervision"].includes(user?.role ?? "")) {
            return NextResponse.json({ error: "Solo administradores pueden gestionar la configuración" }, { status: 403 });
        }
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: "Sin tenant" }, { status: 401 });

        const body = (await req.json()) as Partial<{
            cuentaRemitente: string;
            umbralRojoHoras: number;
            umbralAmarilloHoras: number;
            recordatorios48h: boolean;
            recordatorios12h: boolean;
            horaIngesta: string;
            plantillaAcuseDocx: string;
        }>;

        const config = await prisma.oficioConfig.upsert({
            where: { tenantId },
            update: {
                ...(body.cuentaRemitente !== undefined ? { cuentaRemitente: body.cuentaRemitente } : {}),
                ...(body.umbralRojoHoras !== undefined ? { umbralRojoHoras: body.umbralRojoHoras } : {}),
                ...(body.umbralAmarilloHoras !== undefined ? { umbralAmarilloHoras: body.umbralAmarilloHoras } : {}),
                ...(body.recordatorios48h !== undefined ? { recordatorios48h: body.recordatorios48h } : {}),
                ...(body.recordatorios12h !== undefined ? { recordatorios12h: body.recordatorios12h } : {}),
                ...(body.horaIngesta !== undefined ? { horaIngesta: body.horaIngesta } : {}),
                ...(body.plantillaAcuseDocx !== undefined ? { plantillaAcuseDocx: body.plantillaAcuseDocx } : {}),
            },
            create: {
                tenantId,
                ...(body.cuentaRemitente ? { cuentaRemitente: body.cuentaRemitente } : {}),
                ...(body.umbralRojoHoras !== undefined ? { umbralRojoHoras: body.umbralRojoHoras } : {}),
                ...(body.umbralAmarilloHoras !== undefined ? { umbralAmarilloHoras: body.umbralAmarilloHoras } : {}),
                ...(body.recordatorios48h !== undefined ? { recordatorios48h: body.recordatorios48h } : {}),
                ...(body.recordatorios12h !== undefined ? { recordatorios12h: body.recordatorios12h } : {}),
                ...(body.horaIngesta ? { horaIngesta: body.horaIngesta } : {}),
                ...(body.plantillaAcuseDocx ? { plantillaAcuseDocx: body.plantillaAcuseDocx } : {}),
            },
        });

        return NextResponse.json({ config });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al actualizar config";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
