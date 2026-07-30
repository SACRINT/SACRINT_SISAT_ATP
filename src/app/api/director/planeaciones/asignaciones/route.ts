import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await req.json();
    const { escuelaId: paramEscuelaId, grupoNombre, semestre, asignatura, personalId } = body;

    let escuelaId = paramEscuelaId;
    if (!escuelaId) {
      escuelaId = user.escuelaId || user.id;
      if (!escuelaId && user.cct) {
        const esc = await prisma.escuela.findUnique({ where: { cct: user.cct }, select: { id: true } });
        if (esc) escuelaId = esc.id;
      }
    }

    if (!escuelaId || !grupoNombre || !semestre || !asignatura) {
      return NextResponse.json({ error: "Faltan parámetros obligatorios" }, { status: 400 });
    }

    // 1. Asegurar que existe el grupo en HorarioGrupo
    const grupo = await prisma.horarioGrupo.upsert({
      where: {
        escuelaId_nombre: {
          escuelaId,
          nombre: grupoNombre,
        },
      },
      create: {
        escuelaId,
        nombre: grupoNombre,
        semestre: parseInt(`${semestre}`, 10) || 1,
      },
      update: {
        semestre: parseInt(`${semestre}`, 10) || 1,
      },
    });

    // 2. Asegurar que existe la materia en HorarioAsignaturaCatalogo o buscarla
    let asignaturaObj = await prisma.horarioAsignaturaCatalogo.findFirst({
      where: {
        OR: [
          { uacName: asignatura },
          { uacName: { contains: asignatura, mode: "insensitive" } },
        ],
      },
    });

    if (!asignaturaObj) {
      asignaturaObj = await prisma.horarioAsignaturaCatalogo.create({
        data: {
          uacName: asignatura,
          semester: parseInt(`${semestre}`, 10) || 1,
          component: "fundamental",
          horasSemanales: 3,
          escuelaId,
        },
      });
    }

    // 3. Si no hay personalId, eliminar la asignación si existía
    if (!personalId || personalId === "SIN_ASIGNAR") {
      await prisma.horarioCargaDocente.deleteMany({
        where: {
          escuelaId,
          grupoId: grupo.id,
          asignaturaId: asignaturaObj.id,
        },
      });
      return NextResponse.json({ ok: true, mensaje: "Asignación removida" });
    }

    // 4. Crear o actualizar la carga docente en HorarioCargaDocente
    const cargaExistente = await prisma.horarioCargaDocente.findFirst({
      where: {
        escuelaId,
        grupoId: grupo.id,
        asignaturaId: asignaturaObj.id,
      },
    });

    if (cargaExistente) {
      await prisma.horarioCargaDocente.update({
        where: { id: cargaExistente.id },
        data: { personalId },
      });
    } else {
      await prisma.horarioCargaDocente.create({
        data: {
          escuelaId,
          grupoId: grupo.id,
          asignaturaId: asignaturaObj.id,
          personalId,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error al asignar docente:", err);
    return NextResponse.json({ error: "Error interno al guardar asignación" }, { status: 500 });
  }
}
