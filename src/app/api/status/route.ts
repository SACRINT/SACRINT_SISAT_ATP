import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// API for n8n to poll delivery status
export async function GET() {
    try {
        // Get the active ciclo escolar
        const ciclo = await prisma.cicloEscolar.findFirst({
            where: { activo: true },
        });

        if (!ciclo) {
            return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 404 });
        }

        const programas = await prisma.programa.findMany({
            orderBy: { orden: "asc" },
            include: {
                periodos: {
                    where: { cicloEscolarId: ciclo.id, activo: true },
                    include: {
                        entregas: {
                            include: {
                                escuela: {
                                    select: { cct: true, nombre: true, localidad: true, email: true },
                                },
                                archivos: { where: { tipo: "ENTREGA" } },
                            },
                        },
                    },
                },
            },
        });

        const summary = programas.map((prog) => {
            const todasEntregas = prog.periodos.flatMap((p) => p.entregas);
            const aprobadas = todasEntregas.filter((e) => e.estado === "APROBADO").length;
            const pendientes = todasEntregas.filter((e) => e.estado === "PENDIENTE").length;
            const enRevision = todasEntregas.filter((e) => e.estado === "EN_REVISION").length;
            const requiereCorreccion = todasEntregas.filter((e) => e.estado === "REQUIERE_CORRECCION").length;
            const noAprobado = todasEntregas.filter((e) => e.estado === "NO_APROBADO").length;
            const noEntregadas = todasEntregas.filter((e) => e.estado === "NO_ENTREGADO").length;

            return {
                programa: prog.nombre,
                tipo: prog.tipo,
                aprobadas,
                pendientes,
                enRevision,
                requiereCorreccion,
                noAprobado,
                noEntregadas,
                total: todasEntregas.length,
                periodos: prog.periodos.length,
                escuelasPendientes: todasEntregas
                    .filter((e) => e.estado !== "APROBADO")
                    .map((e) => ({
                        cct: e.escuela.cct,
                        nombre: e.escuela.nombre,
                        email: e.escuela.email,
                        estado: e.estado,
                        archivos: e.archivos.length,
                    })),
            };
        });

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            ciclo: ciclo.nombre,
            totalEscuelas: 18,
            programas: summary,
        });
    } catch (error) {
        console.error("Status API error:", error);
        return NextResponse.json({ error: "Error al obtener estatus" }, { status: 500 });
    }
}
