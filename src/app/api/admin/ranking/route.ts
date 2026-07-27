import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

            // TIPO A: entregó pero el director no atendió las correcciones señaladas por el ATP
            const docsConCorreccionesPendientes = entregasRequeridas.filter((e: any) =>
                e.estado === "REQUIERE_CORRECCION"
            ).length;

            // TIPO B: nunca entregó nada — incumplimiento total (más grave que TIPO A)
            const docsNoEntregados = entregasRequeridas.filter((e: any) =>
                ["PENDIENTE", "NO_ENTREGADO", "NO_APROBADO"].includes(e.estado)
            ).length;
            
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
                medalla,
                // Campos adicionales para distinguir la naturaleza del incumplimiento
                docsConCorreccionesPendientes, // TIPO A: entregó pero no corrigió
                docsNoEntregados               // TIPO B: nunca entregó (más grave)
            };
        });

        ranking.sort((a, b) => {
            // 1. Por medalla: ORO > PLATA > BRONCE > NINGUNA
            if (a.medalla !== b.medalla) {
                const map: Record<string, number> = { "ORO": 4, "PLATA": 3, "BRONCE": 2, "NINGUNA": 1 };
                return map[b.medalla] - map[a.medalla];
            }
            // 2. Por cumplimiento descendente
            if (b.cumplimiento !== a.cumplimiento) {
                return b.cumplimiento - a.cumplimiento;
            }
            // 3. Mismo cumplimiento: TIPO B (nunca entregó) es más grave → posición más baja en ranking
            //    Menos docsNoEntregados = mejor posición
            if (a.docsNoEntregados !== b.docsNoEntregados) {
                return a.docsNoEntregados - b.docsNoEntregados;
            }
            // 4. Mismo tipo B: menos correcciones pendientes (TIPO A) = mejor posición
            if (a.docsConCorreccionesPendientes !== b.docsConCorreccionesPendientes) {
                return a.docsConCorreccionesPendientes - b.docsConCorreccionesPendientes;
            }
            // 5. Alfabético
            return a.nombre.localeCompare(b.nombre);
        });

        return NextResponse.json(ranking);

    } catch (error) {
        console.error("Error generating ranking:", error);
        return NextResponse.json({ error: "Error al generar ranking" }, { status: 500 });
    }
}
