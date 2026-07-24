import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolverHorario } from "@/lib/horarios/solver";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await req.json();
    const { escuelaId: reqEscuelaId, nombreVersion } = body;
    const escuelaId = reqEscuelaId || user.escuelaId || user.id;

    if (!escuelaId) {
      return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });
    }

    // 1. Obtener ciclo escolar activo
    const cicloActivo = await prisma.cicloEscolar.findFirst({
      where: { activo: true }
    });

    if (!cicloActivo) {
      return NextResponse.json({ error: "No hay un ciclo escolar activo configurado" }, { status: 400 });
    }

    // 2. Obtener datos completos de la escuela
    const config = await prisma.horarioConfiguracion.findUnique({
      where: { escuelaId }
    });

    const grupos = await prisma.horarioGrupo.findMany({ where: { escuelaId } });
    const docentes = await prisma.personal.findMany({
      where: { escuelaId }
    });
    const aulas = await prisma.horarioAula.findMany({ where: { escuelaId } });
    const cargas = await prisma.horarioCargaDocente.findMany({ where: { escuelaId } });

    if (grupos.length === 0 || cargas.length === 0) {
      return NextResponse.json({
        error: "Debe registrar al menos 1 grupo y 1 carga académica docente antes de generar el horario."
      }, { status: 400 });
    }

    // 3. Ejecutar Solver Estricto
    const resultadoSolver = resolverHorario({
      diasLectivos: config?.diasLectivos || 5,
      horasPorDia: config?.horasPorDia || 7,
      grupos: grupos.map(g => ({ id: g.id, nombre: g.nombre, semestre: g.semestre })),
      docentes: docentes.map(d => ({ id: d.id, nombreCompleto: `${d.nombre} ${d.apellidoPaterno}`.trim() })),
      aulas: aulas.map(a => ({ id: a.id, nombre: a.nombre, tipo: a.tipo })),
      cargas: cargas.map(c => ({
        id: c.id,
        docenteId: c.personalId,
        grupoId: c.grupoId,
        asignaturaId: c.asignaturaId,
        horasSemanales: c.horasSemanales,
        requiereAulaEspecial: c.requiereAulaEspecial,
        aulaEspecialId: c.aulaEspecialId || undefined
      }))
    });

    // 4. Guardar Horario Generado en BD
    const horarioGenerado = await prisma.horarioGenerado.create({
      data: {
        escuelaId,
        cicloEscolarId: cicloActivo.id,
        nombreVersion: nombreVersion || `Borrador ${new Date().toLocaleDateString("es-MX")}`,
        estado: "BORRADOR",
        scoreMetricas: resultadoSolver.metricas,
        celdas: {
          create: resultadoSolver.celdas.map(c => ({
            diaSemana: c.diaSemana,
            periodo: c.periodo,
            grupoId: c.grupoId,
            docenteId: c.docenteId,
            asignaturaId: c.asignaturaId,
            aulaId: c.aulaId || null,
            cargaId: c.cargaId || null,
            esBloqueado: !!c.esBloqueado
          }))
        }
      },
      include: {
        celdas: {
          include: {
            grupo: true,
            docente: true,
            aula: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      exitoSolver: resultadoSolver.exito,
      metricas: resultadoSolver.metricas,
      conflictos: resultadoSolver.conflictos,
      horario: horarioGenerado
    });
  } catch (error: any) {
    console.error("[api/horarios/generar] Error en POST:", error);
    return NextResponse.json({ error: "Error al generar horario con IA" }, { status: 500 });
  }
}
