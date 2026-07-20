import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!session || !["admin", "supervision", "atp", "director"].includes(role)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        const cicloActivo = await prisma.cicloEscolar.findFirst({
            where: { activo: true }
        });

        if (!cicloActivo) {
            return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 400 });
        }

        const escuelas = await prisma.escuela.findMany({
            where: { esDePrueba: false, esSupervision: false },
            include: {
                entregas: {
                    where: {
                        periodoEntrega: {
                            cicloEscolarId: cicloActivo.id,
                            activo: true
                        }
                    },
                    include: {
                        periodoEntrega: true
                    }
                }
            }
        });

        const ranking = escuelas.map((esc: any) => {
            const entregas: any[] = esc.entregas || [];
            // Exclude EXENTO from required
            const entregasRequeridas = entregas.filter((e: any) => e.estado !== "EXENTO");
            
            const totalRequeridas = entregasRequeridas.length;
            const entregadas = entregasRequeridas.filter((e: any) => ["APROBADO", "ENTREGADO_FISICO", "EN_REVISION", "REQUIERE_CORRECCION"].includes(e.estado));
            const aprobadas = entregasRequeridas.filter((e: any) => ["APROBADO", "ENTREGADO_FISICO"].includes(e.estado));
            
            // Check if all were on time (fechaSubida <= fechaLimite)
            const todasAprobadasYATiempo = entregasRequeridas.length > 0 && entregasRequeridas.every((e: any) => {
                const esAprobada = ["APROBADO", "ENTREGADO_FISICO"].includes(e.estado);
                if (!esAprobada) return false;
                if (!e.fechaSubida) return false;
                
                // Set the end of the day for fechaLimite
                const limite = new Date(e.periodoEntrega.fechaLimite);
                limite.setHours(23, 59, 59, 999);
                return new Date(e.fechaSubida) <= limite;
            });

            const cumplimiento = totalRequeridas > 0 ? (aprobadas.length / totalRequeridas) * 100 : 100;
            const entregadasPorcentaje = totalRequeridas > 0 ? (entregadas.length / totalRequeridas) * 100 : 100;
            
            let medalla = "NINGUNA";
            if (cumplimiento === 100 && todasAprobadasYATiempo) {
                medalla = "ORO";
            } else if (cumplimiento === 100) {
                medalla = "PLATA";
            } else if (cumplimiento >= 80) {
                medalla = "BRONCE";
            }

            return {
                id: esc.id,
                cct: esc.cct,
                nombre: esc.nombre,
                zona: esc.zonaEscolar,
                totalRequeridas,
                aprobadas: aprobadas.length,
                entregadas: entregadas.length,
                cumplimiento,
                entregadasPorcentaje,
                medalla
            };
        });

        ranking.sort((a, b) => {
            if (a.medalla !== b.medalla) {
                const map: Record<string, number> = { "ORO": 3, "PLATA": 2, "BRONCE": 1, "NINGUNA": 0 };
                return map[b.medalla] - map[a.medalla];
            }
            if (b.cumplimiento !== a.cumplimiento) {
                return b.cumplimiento - a.cumplimiento;
            }
            return a.nombre.localeCompare(b.nombre);
        });

        return NextResponse.json(ranking);

    } catch (error) {
        console.error("Error generating ranking:", error);
        return NextResponse.json({ error: "Error al generar ranking" }, { status: 500 });
    }
}
