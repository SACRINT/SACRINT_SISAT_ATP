/**
 * GET /api/admin/planeaciones
 * Lista todas las planeaciones didácticas de la zona (uso exclusivo del admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const session = await auth();
    const user = session?.user as any;
    if (!user || (user.role !== "admin" && user.role !== "supervision")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const escuelaId = searchParams.get("escuelaId");

    if (escuelaId) {
        const [escuela, planeaciones, personal, cargas, grupos] = await Promise.all([
            prisma.escuela.findUnique({
                where: { id: escuelaId },
                select: { id: true, cct: true, nombre: true, gruposPrimerAno: true, gruposSegundoAno: true, gruposTercerAno: true },
            }),
            prisma.planeacionDidactica.findMany({
                where: { escuelaId },
                orderBy: { fechaSubida: "desc" },
            }),
            prisma.personal.findMany({
                where: { escuelaId },
                orderBy: [{ apellidoPaterno: "asc" }, { nombre: "asc" }],
                select: { id: true, nombre: true, apellidoPaterno: true, apellidoMaterno: true, rfc: true, cargo: true },
            }),
            prisma.horarioCargaDocente.findMany({
                where: { escuelaId },
                include: { personal: true, grupo: true, asignatura: true },
            }),
            prisma.horarioGrupo.findMany({
                where: { escuelaId },
                orderBy: { nombre: "asc" },
            }),
        ]);

        return NextResponse.json({
            escuela,
            planeaciones,
            personal,
            cargas,
            grupos,
        });
    }

    const planeaciones = await prisma.planeacionDidactica.findMany({
        orderBy: { fechaSubida: "desc" },
        include: {
            escuela: {
                select: { nombre: true, cct: true, gruposPrimerAno: true, gruposSegundoAno: true, gruposTercerAno: true },
            },
        },
    });

    return NextResponse.json({ planeaciones });
}
