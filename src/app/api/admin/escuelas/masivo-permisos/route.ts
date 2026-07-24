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
    const { tipo, accion, programaNombre } = body;

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

    if (tipo === "PROGRAMA" && programaNombre) {
      const esDesactivar = accion === "DESACTIVAR_TODOS";

      await Promise.all(
        escuelas.map((esc) => {
          const permisosActuales = (esc.permisos as any) || {};
          let programasInactivos: string[] = Array.isArray(permisosActuales.programasInactivos)
            ? permisosActuales.programasInactivos
            : [];

          if (esDesactivar) {
            if (!programasInactivos.includes(programaNombre)) {
              programasInactivos = [...programasInactivos, programaNombre];
            }
          } else {
            programasInactivos = programasInactivos.filter((p: string) => p !== programaNombre);
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
