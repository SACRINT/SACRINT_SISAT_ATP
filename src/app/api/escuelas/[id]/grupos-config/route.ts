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
    const { grupoNombre, semestre, capacitacionNombre, ffeOptativas } = body;

    if (!escuelaId || !grupoNombre) {
      return NextResponse.json({ error: "escuelaId y grupoNombre son requeridos" }, { status: 400 });
    }

    const sem = parseInt(`${semestre || 3}`, 10);

    const grupoActualizado = await prisma.horarioGrupo.upsert({
      where: {
        escuelaId_nombre: {
          escuelaId,
          nombre: grupoNombre,
        },
      },
      create: {
        escuelaId,
        nombre: grupoNombre,
        semestre: sem,
        capacitacionNombre: capacitacionNombre || "Administracion",
        ffeOptativas: ffeOptativas || [],
      },
      update: {
        semestre: sem,
        capacitacionNombre: capacitacionNombre !== undefined ? capacitacionNombre : undefined,
        ffeOptativas: ffeOptativas !== undefined ? ffeOptativas : undefined,
      },
    });

    return NextResponse.json({ success: true, grupo: grupoActualizado });
  } catch (err: any) {
    console.error("Error updating grupo config:", err);
    return NextResponse.json({ error: "Error al actualizar configuración del grupo" }, { status: 500 });
  }
}
