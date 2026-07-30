import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const params = await context.params;
    const escuelaId = params.id;
    const body = await req.json();
    const { gruposPrimerAno, gruposSegundoAno, gruposTercerAno, gruposConfig } = body;

    if (!escuelaId) {
      return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });
    }

    // 1. Actualizar escuela
    await prisma.escuela.update({
      where: { id: escuelaId },
      data: {
        gruposPrimerAno: Math.max(1, parseInt(`${gruposPrimerAno || 1}`, 10)),
        gruposSegundoAno: Math.max(1, parseInt(`${gruposSegundoAno || 1}`, 10)),
        gruposTercerAno: Math.max(1, parseInt(`${gruposTercerAno || 1}`, 10)),
        mapaCurricularCompletado: true,
      },
    });

    // 2. Guardar gruposConfig si se proporcionaron
    if (Array.isArray(gruposConfig) && gruposConfig.length > 0) {
      for (const item of gruposConfig) {
        const sem = parseInt(`${item.semestre || 1}`, 10);
        await prisma.horarioGrupo.upsert({
          where: {
            escuelaId_nombre: {
              escuelaId,
              nombre: item.grupoNombre,
            },
          },
          create: {
            escuelaId,
            nombre: item.grupoNombre,
            semestre: sem,
            capacitacionNombre: item.capacitacionNombre || "Administracion",
            ffeOptativas: item.ffeOptativas || [],
            ffeoSocioemocional: item.ffeoSocioemocional || null,
          },
          update: {
            semestre: sem,
            capacitacionNombre: item.capacitacionNombre !== undefined ? item.capacitacionNombre : undefined,
            ffeOptativas: item.ffeOptativas !== undefined ? item.ffeOptativas : undefined,
            ffeoSocioemocional: item.ffeoSocioemocional !== undefined ? item.ffeoSocioemocional : undefined,
          },
        });
      }
    }

    return NextResponse.json({ success: true, message: "Mapa curricular guardado correctamente" });
  } catch (err: any) {
    console.error("Error al guardar mapa curricular:", err);
    return NextResponse.json({ error: "Error al guardar el mapa curricular" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const user = session?.user as any;
    if (!session?.user || user?.role !== "admin") {
      return NextResponse.json({ error: "No autorizado (Solo Administradores)" }, { status: 401 });
    }

    const params = await context.params;
    const escuelaId = params.id;

    if (!escuelaId) {
      return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });
    }

    // Reiniciar bandera y limpiar grupos
    await prisma.escuela.update({
      where: { id: escuelaId },
      data: {
        mapaCurricularCompletado: false,
      },
    });

    await prisma.horarioGrupo.deleteMany({
      where: { escuelaId },
    });

    return NextResponse.json({ success: true, message: "Mapa curricular reiniciado correctamente" });
  } catch (err: any) {
    console.error("Error al reiniciar mapa curricular:", err);
    return NextResponse.json({ error: "Error al reiniciar el mapa curricular" }, { status: 500 });
  }
}
