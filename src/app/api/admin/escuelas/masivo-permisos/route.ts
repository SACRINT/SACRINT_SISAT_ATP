import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { tipo, accion, programaId, programaNombre } = body;

    // Obtener todas las escuelas registradas
    const escuelas = await prisma.escuela.findMany();

    // ── Módulo Horarios IA (on/off por escuela) ──────────────────────────────
    if (tipo === "HORARIOS_IA") {
      const horariosDesactivado = accion === "DESACTIVAR_TODOS";
      await Promise.all(
        escuelas.map((esc) => {
          const permisosActuales = (esc.permisos as any) || {};
          return prisma.escuela.update({
            where: { id: esc.id },
            data: { permisos: { ...permisosActuales, horariosDesactivado } },
          });
        })
      );
      return NextResponse.json({
        success: true,
        message: `Horarios IA ${horariosDesactivado ? "desactivados" : "activados"} para TODAS las escuelas.`,
      });
    }

    // ── Módulo Planeaciones IA (on/off por escuela) ──────────────────────────
    if (tipo === "PLANEACIONES_IA") {
      const planeacionesDesactivado = accion === "DESACTIVAR_TODOS";
      await Promise.all(
        escuelas
          .filter((esc) => !(esc as any).esSupervision)
          .map((esc) => {
            const permisosActuales = (esc.permisos as any) || {};
            return prisma.escuela.update({
              where: { id: esc.id },
              data: { permisos: { ...permisosActuales, planeacionesDesactivado } },
            });
          })
      );
      return NextResponse.json({
        success: true,
        message: `Módulo Planeaciones IA ${planeacionesDesactivado ? "desactivado" : "activado"} para TODAS las escuelas.`,
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
      await Promise.all(
        escuelas
          .filter((esc) => !(esc as any).esSupervision)
          .map((esc) => {
            const permisosActuales = (esc.permisos as any) || {};
            return prisma.escuela.update({
              where: { id: esc.id },
              data: { permisos: { ...permisosActuales, planeacionesSinApiKey: sinApiKey } },
            });
          })
      );
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
      await Promise.all(
        escuelas
          .filter((esc) => !(esc as any).esSupervision)
          .map((esc) => {
            const permisosActuales = (esc.permisos as any) || {};
            return prisma.escuela.update({
              where: { id: esc.id },
              data: { permisos: { ...permisosActuales, planeacionesSinPaec: sinPaec } },
            });
          })
      );
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

      await Promise.all(
        escuelas.map((esc) => {
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
      );

      return NextResponse.json({
        success: true,
        message: `Programa "${programaNombre}" ${esDesactivar ? "desactivado" : "activado"} para TODAS las escuelas.`,
      });
    }

    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  } catch (error: any) {
    console.error("Error en masivo-permisos:", error);
    return NextResponse.json({ error: "Error al actualizar permisos masivos" }, { status: 500 });
  }
}
