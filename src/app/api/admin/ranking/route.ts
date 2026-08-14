import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { obtenerCicloActual } from "@/lib/ciclo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!session || !["admin", "supervision", "atp", "director"].includes(role)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const cicloIdParam = searchParams.get("cicloId");

        let cicloActivo = null;
        if (cicloIdParam) {
            cicloActivo = await prisma.cicloEscolar.findUnique({ where: { id: cicloIdParam } });
        }
        if (!cicloActivo) {
            cicloActivo = await obtenerCicloActual();
        }

        if (!cicloActivo) {
            return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 400 });
        }

        const evaluarSoloActivos = (cicloActivo as any).evaluarSoloActivosRanking ?? false;
        const tenantId = (session?.user as any)?.organizacionId || (session?.user as any)?.tenantId || process.env.TENANT_ID || "zona004";

        // Obtener configuración de SPARH para verificar si el módulo está activo
        const sparhConfig = await prisma.plantillaCorteConfig.findUnique({
            where: { tenantId }
        });
        const sparhActivo = sparhConfig?.activo ?? true;

        // Obtener registros de plantillas por escuela para el módulo SPARH
        const plantillasSparh = sparhActivo ? await prisma.plantillaPersonalRegistro.findMany({
            where: { tenantId }
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
                        periodoEntrega: {
                            include: {
                                programa: true
                            }
                        }
                    }
                }
            }
        });

        // Si la opción "evaluarSoloActivos" está encendida:
        // Un programa/periodo se considera requerido únicamente si:
        // A) periodo.activo === true y tiene una fechaLimite configurada por el admin.
        // O B) al menos una escuela en la zona ya ha subido una entrega para ese periodo (estado != NO_ENTREGADO / PENDIENTE).
        const periodosQueTienenEntregasEnZona = new Set<string>();
        if (evaluarSoloActivos) {
            for (const esc of escuelas) {
                for (const e of esc.entregas || []) {
                    if (["APROBADO", "ENTREGADO_FISICO", "EN_REVISION", "REQUIERE_CORRECCION"].includes(e.estado)) {
                        periodosQueTienenEntregasEnZona.add(e.periodoEntregaId);
                    }
                }
            }
        }

        const ranking = escuelas.map((esc: any) => {
            const entregas: any[] = esc.entregas || [];

            // Evaluar entregas del ciclo escolar
            const entregasRequeridas = entregas.filter((e: any) => {
                if (e.estado === "EXENTO") return false;

                const quienes: string[] = e.periodoEntrega?.programa?.quienesPuedenSubir ?? [];
                // Si el programa no incluye "director", excluirlo
                if (quienes.length > 0 && !quienes.includes("director")) return false;

                // Si el modo "Solo Activos" está encendido:
                if (evaluarSoloActivos) {
                    const per = e.periodoEntrega;
                    const tieneFechaLimite = per?.fechaLimite !== null && per?.fechaLimite !== undefined;
                    const tieneEntregaEnZona = periodosQueTienenEntregasEnZona.has(e.periodoEntregaId);
                    const estaActivo = per?.activo !== false;

                    // Si NO está activo, ni tiene fecha límite, ni nadie en la zona ha subido nada -> Se ignora del ranking
                    if (!estaActivo || (!tieneFechaLimite && !tieneEntregaEnZona)) {
                        return false;
                    }
                }

                return true;
            });
            
            let totalRequeridas = entregasRequeridas.length;
            const entregadas = entregasRequeridas.filter((e: any) => ["APROBADO", "ENTREGADO_FISICO", "EN_REVISION", "REQUIERE_CORRECCION"].includes(e.estado));
            const aprobadas = entregasRequeridas.filter((e: any) => ["APROBADO", "ENTREGADO_FISICO"].includes(e.estado));

            // Evaluacion de entregable de módulo SPARH (si está activo)
            let sparhAprobada = false;
            let sparhEntregada = false;
            let sparhATiempo = false;
            let sparhPendienteCorreccion = false;
            let sparhNoEntregada = false;

            const sparhTieneFecha = sparhConfig?.fechaCorteOficial !== null && sparhConfig?.fechaCorteOficial !== undefined;
            const sparhTieneRegistros = plantillasSparh.length > 0;
            const incluirSparh = sparhActivo && (!evaluarSoloActivos || sparhTieneFecha || sparhTieneRegistros);

            if (incluirSparh) {
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
            const todasAprobadasYATiempo = (entregasRequeridas.length > 0 || incluirSparh) &&
                entregasRequeridas.every((e: any) => {
                    const esAprobada = ["APROBADO", "ENTREGADO_FISICO"].includes(e.estado);
                    if (!esAprobada) return false;
                    if (!e.fechaSubida) return false;
                    if (!e.periodoEntrega?.fechaLimite) return true;
                    
                    const limite = new Date(e.periodoEntrega.fechaLimite);
                    limite.setHours(23, 59, 59, 999);
                    return new Date(e.fechaSubida) <= limite;
                }) && (!incluirSparh || sparhATiempo);

            const cumplimiento = totalRequeridas > 0 ? (aprobadas.length / totalRequeridas) * 100 : 0;
            const entregadasPorcentaje = totalRequeridas > 0 ? (entregadas.length / totalRequeridas) * 100 : 0;
            
            let medalla = "NINGUNA";
            if (totalRequeridas > 0) {
                if (cumplimiento === 100 && todasAprobadasYATiempo) {
                    medalla = "ORO";
                } else if (cumplimiento === 100) {
                    medalla = "PLATA";
                } else if (cumplimiento >= 80) {
                    medalla = "BRONCE";
                }
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
                docsConCorreccionesPendientes,
                docsNoEntregados
            };
        });

        ranking.sort((a, b) => {
            if (a.medalla !== b.medalla) {
                const map: Record<string, number> = { "ORO": 4, "PLATA": 3, "BRONCE": 2, "NINGUNA": 1 };
                return map[b.medalla] - map[a.medalla];
            }
            if (b.cumplimiento !== a.cumplimiento) {
                return b.cumplimiento - a.cumplimiento;
            }
            if (a.docsNoEntregados !== b.docsNoEntregados) {
                return a.docsNoEntregados - b.docsNoEntregados;
            }
            if (a.docsConCorreccionesPendientes !== b.docsConCorreccionesPendientes) {
                return a.docsConCorreccionesPendientes - b.docsConCorreccionesPendientes;
            }
            return a.nombre.localeCompare(b.nombre);
        });

        return NextResponse.json({
            ranking,
            evaluarSoloActivosRanking: evaluarSoloActivos,
            cicloId: cicloActivo.id,
            cicloNombre: cicloActivo.nombre,
        });

    } catch (error) {
        console.error("Error generating ranking:", error);
        return NextResponse.json({ error: "Error al generar ranking" }, { status: 500 });
    }
}

// POST endpoint para alternar el filtro de solo programas activos en el ranking para este ciclo
export async function POST(req: NextRequest) {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!session || !["admin", "supervision"].includes(role)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { cicloId, evaluarSoloActivosRanking } = body as { cicloId?: string; evaluarSoloActivosRanking?: boolean };

        let cicloIdUsar = cicloId;
        if (!cicloIdUsar) {
            const ciclo = await obtenerCicloActual();
            cicloIdUsar = ciclo?.id;
        }

        if (!cicloIdUsar || typeof evaluarSoloActivosRanking !== "boolean") {
            return NextResponse.json({ error: "Faltan parámetros (cicloId, evaluarSoloActivosRanking)" }, { status: 400 });
        }

        const actualizado = await prisma.cicloEscolar.update({
            where: { id: cicloIdUsar },
            data: { evaluarSoloActivosRanking } as any,
        });

        return NextResponse.json({
            ok: true,
            cicloId: actualizado.id,
            evaluarSoloActivosRanking: (actualizado as any).evaluarSoloActivosRanking,
        });
    } catch (error) {
        console.error("Error updating ranking mode:", error);
        return NextResponse.json({ error: "Error al actualizar modo de ranking" }, { status: 500 });
    }
}
