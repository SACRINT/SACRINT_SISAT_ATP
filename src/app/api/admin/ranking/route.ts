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

        // Obtener configuración de SPARH para verificar si el módulo está activo
        const sparhConfig = await prisma.plantillaCorteConfig.findUnique({
            where: { tenantId: "zona004" }
        });
        const sparhActivo = sparhConfig?.activo ?? true;

        // Obtener registros de plantillas por escuela para el módulo SPARH
        const plantillasSparh = sparhActivo ? await prisma.plantillaPersonalRegistro.findMany({
            where: { tenantId: "zona004" }
        }) : [];

        const plantillasMap = new Map<string, any>();
        plantillasSparh.forEach((p) => {
            if (p.escuelaId) plantillasMap.set(p.escuelaId, p);
            if (p.escuelaCCT) plantillasMap.set(p.escuelaCCT, p);
        });

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
            
            let totalRequeridas = entregasRequeridas.length;
            const entregadas = entregasRequeridas.filter((e: any) => ["APROBADO", "ENTREGADO_FISICO", "EN_REVISION", "REQUIERE_CORRECCION"].includes(e.estado));
            const aprobadas = entregasRequeridas.filter((e: any) => ["APROBADO", "ENTREGADO_FISICO"].includes(e.estado));

            // Evaluacion de entregable de módulo SPARH (si está activo)
            let sparhAprobada = false;
            let sparhEntregada = false;
            let sparhATiempo = false;
            let sparhPendienteCorreccion = false;
            let sparhNoEntregada = false;

            if (sparhActivo) {
                totalRequeridas += 1;
                const regSparh = plantillasMap.get(esc.id) || plantillasMap.get(esc.cct);
                if (regSparh) {
                    if (["VALIDADO", "LISTO_PARA_CORDE", "ENTREGADO_A_CORDE"].includes(regSparh.estado)) {
                        sparhAprobada = true;
                        sparhEntregada = true;
                        aprobadas.push(regSparh);
                        entregadas.push(regSparh);
                    } else if (["RECIBIDO", "EN_VALIDACION", "CONSOLIDADO"].includes(regSparh.estado)) {
                        sparhEntregada = true;
                        entregadas.push(regSparh);
                    } else if (["CON_ERRORES", "CORREGIR"].includes(regSparh.estado)) {
                        sparhEntregada = true;
                        sparhPendienteCorreccion = true;
                        entregadas.push(regSparh);
                    } else {
                        sparhNoEntregada = true;
                    }

                    const fechaSubida = regSparh.fechaEntregaPdf || regSparh.fechaSubidaExcel || regSparh.updatedAt;
                    const fechaLimite = sparhConfig?.fechaCorteOficial;
                    if (sparhAprobada) {
                        if (!fechaLimite || new Date(fechaSubida) <= new Date(fechaLimite)) {
                            sparhATiempo = true;
                        }
                    }
                } else {
                    sparhNoEntregada = true;
                }
            }

            // TIPO A: entregó pero el director no atendió las correcciones señaladas por el ATP
            const docsConCorreccionesPendientes = entregasRequeridas.filter((e: any) =>
                e.estado === "REQUIERE_CORRECCION"
            ).length + (sparhPendienteCorreccion ? 1 : 0);

            // TIPO B: nunca entregó nada — incumplimiento total (más grave que TIPO A)
            const docsNoEntregados = entregasRequeridas.filter((e: any) =>
                ["PENDIENTE", "NO_ENTREGADO", "NO_APROBADO"].includes(e.estado)
            ).length + (sparhNoEntregada ? 1 : 0);
            
            // Check if all were on time (fechaSubida <= fechaLimite)
            const todasAprobadasYATiempo = (entregasRequeridas.length > 0 || sparhActivo) &&
                entregasRequeridas.every((e: any) => {
                    const esAprobada = ["APROBADO", "ENTREGADO_FISICO"].includes(e.estado);
                    if (!esAprobada) return false;
                    if (!e.fechaSubida) return false;
                    
                    const limite = new Date(e.periodoEntrega.fechaLimite);
                    limite.setHours(23, 59, 59, 999);
                    return new Date(e.fechaSubida) <= limite;
                }) && (!sparhActivo || sparhATiempo);

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
