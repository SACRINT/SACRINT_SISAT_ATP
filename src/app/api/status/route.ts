import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// API for n8n to poll delivery status
export async function GET() {
    try {
        const programas = await prisma.programa.findMany({
            orderBy: { orden: "asc" },
            include: {
                entregas: {
                    include: {
                        escuela: {
                            select: { cct: true, nombre: true, localidad: true, email: true },
                        },
                    },
                },
            },
        });

        const summary = programas.map((prog) => {
            const completas = prog.entregas.filter((e) => e.estatus === "COMPLETO").length;
            const pendientes = prog.entregas.filter((e) => e.estatus === "PENDIENTE").length;
            const noEntregadas = prog.entregas.filter((e) => e.estatus === "NO_ENTREGADO").length;

            return {
                programa: prog.nombre,
                completas,
                pendientes,
                noEntregadas,
                total: prog.entregas.length,
                escuelasPendientes: prog.entregas
                    .filter((e) => e.estatus !== "COMPLETO")
                    .map((e) => ({
                        cct: e.escuela.cct,
                        nombre: e.escuela.nombre,
                        email: e.escuela.email,
                        estatus: e.estatus,
                    })),
            };
        });

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            totalEscuelas: 18,
            programas: summary,
        });
    } catch (error) {
        return NextResponse.json({ error: "Error al obtener estatus" }, { status: 500 });
    }
}
