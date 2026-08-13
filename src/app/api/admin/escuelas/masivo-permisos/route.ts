import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { obtenerCicloActual } from "@/lib/ciclo";

function calcularMesesDelCiclo(inicio?: Date, fin?: Date): number[] {
  return [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { tipo, accion, programaId, programaNombre, cicloId } = body;

    // Obtener todas las escuelas registradas
    const escuelas = await prisma.escuela.findMany();

    // ── Módulo Horarios IA (on/off por escuela + config global) ─────────────
    if (tipo === "HORARIOS_IA") {
      const horariosDesactivado = accion === "DESACTIVAR_TODOS";
      const activoGlobal = accion === "ACTIVAR_TODOS";

      await Promise.all([
        prisma.preRevisionConfig.upsert({
          where: { id: "singleton" },
          create: { id: "singleton", activoGlobalHorarios: activoGlobal },
          update: { activoGlobalHorarios: activoGlobal },
        }),
        ...escuelas.map((esc) => {
          const permisosActuales = (esc.permisos as any) || {};
          return prisma.escuela.update({
            where: { id: esc.id },
            data: { permisos: { ...permisosActuales, horariosDesactivado } },
          });
        })
      ]);

      return NextResponse.json({
        success: true,
        message: `Horarios IA ${horariosDesactivado ? "desactivados" : "activados"} globalmente y para TODAS las escuelas.`,
      });
    }

    // ── Módulo Planeaciones IA (on/off por escuela + config global) ─────────
    if (tipo === "PLANEACIONES_IA") {
      const planeacionesDesactivado = accion === "DESACTIVAR_TODOS";
      const activoGlobal = accion === "ACTIVAR_TODOS";

      await Promise.all([
        prisma.planeacionesConfig.upsert({
          where: { id: "singleton" },
          create: { id: "singleton", activoGlobal },
          update: { activoGlobal },
        }),
        ...escuelas
          .filter((esc) => !(esc as any).esSupervision)
          .map((esc) => {
            const permisosActuales = (esc.permisos as any) || {};
            return prisma.escuela.update({
              where: { id: esc.id },
              data: { permisos: { ...permisosActuales, planeacionesDesactivado } },
            });
          })
      ]);

      return NextResponse.json({
        success: true,
        message: `Módulo Planeaciones IA ${planeacionesDesactivado ? "desactivado" : "activado"} globalmente y para TODAS las escuelas.`,
      });
    }

    // ── Exención granular: API Key para Horarios IA ──────────────────────────
    if (tipo === "HORARIOS_SIN_API_KEY") {
      const sinApiKey = accion === "ACTIVAR_TODOS";
      await Promise.all(
        escuelas.map((esc) => {
          const permisosActuales = (esc.permisos as any) || {};
          return prisma.escuela.update({
            where: { id: esc.id },
            data: { permisos: { ...permisosActuales, horariosSinApiKey: sinApiKey } },
          });
        })
      );
      return NextResponse.json({
        success: true,
        message: sinApiKey
          ? "API Key EXIMIDA para Horarios IA en TODAS las escuelas."
          : "Requisito de API Key restablecido para Horarios IA en TODAS las escuelas.",
      });
    }

    // ── Exención granular: Expedientes de Personal para Horarios IA ──────────
    if (tipo === "HORARIOS_SIN_EXPEDIENTES") {
      const sinExpedientes = accion === "ACTIVAR_TODOS";
      await Promise.all(
        escuelas.map((esc) => {
          const permisosActuales = (esc.permisos as any) || {};
          return prisma.escuela.update({
            where: { id: esc.id },
            data: { permisos: { ...permisosActuales, horariosSinExpedientes: sinExpedientes } },
          });
        })
      );
      return NextResponse.json({
        success: true,
        message: sinExpedientes
          ? "Expedientes de Personal EXIMIDOS para Horarios IA en TODAS las escuelas."
          : "Requisito de Expedientes restablecido para Horarios IA en TODAS las escuelas.",
      });
    }

    // ── Exención granular: API Key para Planeaciones IA ──────────────────────
    if (tipo === "PLANEACIONES_SIN_API_KEY") {
      const sinApiKey = accion === "ACTIVAR_TODOS";
      await Promise.all([
        prisma.planeacionesConfig.upsert({
          where: { id: "singleton" },
          update: { requiereApiKey: !sinApiKey },
          create: { id: "singleton", requiereApiKey: !sinApiKey },
        }),
        ...escuelas
          .filter((esc) => !(esc as any).esSupervision)
          .map((esc) => {
            const permisosActuales = (esc.permisos as any) || {};
            return prisma.escuela.update({
              where: { id: esc.id },
              data: { permisos: { ...permisosActuales, planeacionesSinApiKey: sinApiKey } },
            });
          })
      ]);
      return NextResponse.json({
        success: true,
        message: sinApiKey
          ? "API Key EXIMIDA para Planeaciones IA en TODAS las escuelas."
          : "Requisito de API Key restablecido para Planeaciones IA en TODAS las escuelas.",
      });
    }

    // ── Exención granular: PAEC-PEC para Planeaciones IA ─────────────────────
    if (tipo === "PLANEACIONES_SIN_PAEC") {
      const sinPaec = accion === "ACTIVAR_TODOS";
      await Promise.all([
        prisma.planeacionesConfig.upsert({
          where: { id: "singleton" },
          update: { requierePaecPec: !sinPaec },
          create: { id: "singleton", requierePaecPec: !sinPaec },
        }),
        ...escuelas
          .filter((esc) => !(esc as any).esSupervision)
          .map((esc) => {
            const permisosActuales = (esc.permisos as any) || {};
            return prisma.escuela.update({
              where: { id: esc.id },
              data: { permisos: { ...permisosActuales, planeacionesSinPaec: sinPaec } },
            });
          })
      ]);
      return NextResponse.json({
        success: true,
        message: sinPaec
          ? "PAEC-PEC EXIMIDO para Planeaciones IA en TODAS las escuelas."
          : "Requisito de PAEC-PEC restablecido para Planeaciones IA en TODAS las escuelas.",
      });
    }

    // ── Activación/desactivación masiva por Programa ─────────────────────────
    if (tipo === "PROGRAMA" && (programaId || programaNombre)) {
      const esDesactivar = accion === "DESACTIVAR_TODOS";
      const activoGlobal = accion === "ACTIVAR_TODOS";

      // 1. Actualizar permisos de excepciones en todas las escuelas
      const updates: Promise<any>[] = [
        ...escuelas.map((esc) => {
          const permisosActuales = (esc.permisos as any) || {};
          let programasInactivos: string[] = Array.isArray(permisosActuales.programasInactivos)
            ? permisosActuales.programasInactivos
            : [];

          // Limpiar entradas legacy almacenadas por nombre
          if (programaNombre) {
            programasInactivos = programasInactivos.filter((p: string) => p !== programaNombre);
          }
          if (esDesactivar) {
            const valor = programaId || programaNombre;
            if (valor && !programasInactivos.includes(valor)) {
              programasInactivos = [...programasInactivos, valor];
            }
          } else if (programaId) {
            programasInactivos = programasInactivos.filter((p: string) => p !== programaId);
          }

          return prisma.escuela.update({
            where: { id: esc.id },
            data: { permisos: { ...permisosActuales, programasInactivos } },
          });
        })
      ];

      // 2. Sincronizar también los PeriodoEntrega del ciclo escolar correspondiente
      let cicloTarget = null;
      if (cicloId) {
        cicloTarget = await prisma.cicloEscolar.findUnique({ where: { id: cicloId } });
      }
      if (!cicloTarget) {
        cicloTarget = await obtenerCicloActual();
      }

      if (cicloTarget && programaId) {
        const periodosExistentes = await prisma.periodoEntrega.findMany({
          where: {
            cicloEscolarId: cicloTarget.id,
            programaId: programaId,
          },
        });

        if (activoGlobal) {
          if (periodosExistentes.length > 0) {
            updates.push(
              prisma.periodoEntrega.updateMany({
                where: {
                  cicloEscolarId: cicloTarget.id,
                  programaId: programaId,
                },
                data: { activo: true },
              })
            );
          } else {
            // Generar periodos iniciales para este ciclo
            const prog = await prisma.programa.findUnique({ where: { id: programaId } });
            if (prog) {
              const tipoProg = prog.tipo;
              const escuelasIds = escuelas.map((e) => e.id);

              if (tipoProg === "ANUAL") {
                updates.push(
                  (async () => {
                    const periodo = await prisma.periodoEntrega.create({
                      data: {
                        cicloEscolarId: cicloTarget!.id,
                        programaId: programaId,
                        activo: true,
                      },
                    });
                    if (escuelasIds.length > 0) {
                      await prisma.entrega.createMany({
                        data: escuelasIds.map((escuelaId) => ({
                          escuelaId,
                          periodoEntregaId: periodo.id,
                        })),
                        skipDuplicates: true,
                      });
                    }
                  })()
                );
              } else if (tipoProg === "SEMESTRAL") {
                for (const semestre of [1, 2]) {
                  updates.push(
                    (async () => {
                      const periodo = await prisma.periodoEntrega.create({
                        data: {
                          cicloEscolarId: cicloTarget!.id,
                          programaId: programaId,
                          semestre,
                          activo: true,
                        },
                      });
                      if (escuelasIds.length > 0) {
                        await prisma.entrega.createMany({
                          data: escuelasIds.map((escuelaId) => ({
                            escuelaId,
                            periodoEntregaId: periodo.id,
                          })),
                          skipDuplicates: true,
                        });
                      }
                    })()
                  );
                }
              } else if (tipoProg === "MENSUAL") {
                const meses = calcularMesesDelCiclo(cicloTarget.inicio, cicloTarget.fin);
                for (const mes of meses) {
                  updates.push(
                    (async () => {
                      const periodo = await prisma.periodoEntrega.create({
                        data: {
                          cicloEscolarId: cicloTarget!.id,
                          programaId: programaId,
                          mes,
                          activo: true,
                        },
                      });
                      if (escuelasIds.length > 0) {
                        await prisma.entrega.createMany({
                          data: escuelasIds.map((escuelaId) => ({
                            escuelaId,
                            periodoEntregaId: periodo.id,
                          })),
                          skipDuplicates: true,
                        });
                      }
                    })()
                  );
                }
              }
            }
          }
        } else {
          // Desactivar en el ciclo correspondiente
          if (periodosExistentes.length > 0) {
            updates.push(
              prisma.periodoEntrega.updateMany({
                where: {
                  cicloEscolarId: cicloTarget.id,
                  programaId: programaId,
                },
                data: { activo: false },
              })
            );
          }
        }
      }

      await Promise.all(updates);

      revalidatePath("/admin");
      revalidatePath("/director");

      return NextResponse.json({
        success: true,
        message: `Programa "${programaNombre || programaId}" ${esDesactivar ? "desactivado" : "activado"} para todas las escuelas y sincronizado con el ciclo ${cicloTarget?.nombre || ""}.`,
      });
    }

    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  } catch (error: any) {
    console.error("Error en masivo-permisos:", error);
    return NextResponse.json({ error: "Error al actualizar permisos masivos" }, { status: 500 });
  }
}
