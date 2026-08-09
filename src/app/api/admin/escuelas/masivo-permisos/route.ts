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

    if (tipo === "HORARIOS_IA") {
      const horariosDesactivado = accion === "DESACTIVAR_TODOS";

      // Actualizar permisos para cada escuela
      await Promise.all(
        escuelas.map((esc) => {
          const permisosActuales = (esc.permisos as any) || {};
          const nuevosPermisos = {
            ...permisosActuales,
            horariosDesactivado
          };
          return prisma.escuela.update({
            where: { id: esc.id },
            data: { permisos: nuevosPermisos }
          });
        })
      );

      return NextResponse.json({
        success: true,
        message: `Horarios IA ${horariosDesactivado ? "desactivados" : "activados"} para TODAS las escuelas.`
      });
    }

    if (tipo === "PLANEACIONES_IA") {
      const planeacionesDesactivado = accion === "DESACTIVAR_TODOS";
      await Promise.all(
        escuelas
          .filter(esc => !(esc as any).esSupervision)
          .map((esc) => {
            const permisosActuales = (esc.permisos as any) || {};
            const nuevosPermisos = { ...permisosActuales, planeacionesDesactivado };
            return prisma.escuela.update({
              where: { id: esc.id },
              data: { permisos: nuevosPermisos }
            });
          })
      );
      return NextResponse.json({
        success: true,
        message: `Módulo Planeaciones IA ${planeacionesDesactivado ? "desactivado" : "activado"} para TODAS las escuelas.`
      });
    }

    if (tipo === "HORARIOS_SIN_REQUISITOS") {
      const sinRequisitos = accion === "ACTIVAR_TODOS";
      await Promise.all(
        escuelas.map((esc) => {
          const permisosActuales = (esc.permisos as any) || {};
          return prisma.escuela.update({
            where: { id: esc.id },
            data: { permisos: { ...permisosActuales, horariosSinRequisitos: sinRequisitos } }
          });
        })
      );
      return NextResponse.json({
        success: true,
        message: sinRequisitos
          ? "Requisitos (API/expedientes) EXIMIDOS para Horarios IA en TODAS las escuelas."
          : "Requisitos (API/expedientes) restablecidos para Horarios IA en TODAS las escuelas."
      });
    }

    if (tipo === "PLANEACIONES_SIN_REQUISITOS") {
      const sinRequisitos = accion === "ACTIVAR_TODOS";
      await Promise.all(
        escuelas
          .filter(esc => !(esc as any).esSupervision)
          .map((esc) => {
            const permisosActuales = (esc.permisos as any) || {};
            return prisma.escuela.update({
              where: { id: esc.id },
              data: { permisos: { ...permisosActuales, planeacionesSinRequisitos: sinRequisitos } }
            });
          })
      );
      return NextResponse.json({
        success: true,
        message: sinRequisitos
          ? "Requisitos (PAEC/API) EXIMIDOS para Planeaciones IA en TODAS las escuelas."
          : "Requisitos (PAEC/API) restablecidos para Planeaciones IA en TODAS las escuelas."
      });
    }

    if (tipo === "PROGRAMA" && (programaId || programaNombre)) {      const esDesactivar = accion === "DESACTIVAR_TODOS";

      await Promise.all(
        escuelas.map((esc) => {
          const permisosActuales = (esc.permisos as any) || {};
          let programasInactivos: string[] = Array.isArray(permisosActuales.programasInactivos)
            ? permisosActuales.programasInactivos
            : [];

          // Limpiar entradas legacy almacenadas por nombre y dejar el id como formato estándar
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

          const nuevosPermisos = {
            ...permisosActuales,
            programasInactivos
          };

          return prisma.escuela.update({
            where: { id: esc.id },
            data: { permisos: nuevosPermisos }
          });
        })
      );

      return NextResponse.json({
        success: true,
        message: `Programa "${programaNombre}" ${esDesactivar ? "desactivado" : "activado"} para TODAS las escuelas.`
      });
    }

    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  } catch (error: any) {
    console.error("Error en masivo-permisos:", error);
    return NextResponse.json({ error: "Error al actualizar permisos masivos" }, { status: 500 });
  }
}
