import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Punto 1: Helper compartido — crea periodos + entregas para un programa en
// un ciclo. Idempotente: si ya existe PeriodoEntrega para (cicloId, programaId)
// no hace nada (continue). Devuelve el número de periodos creados.
// ─────────────────────────────────────────────────────────────────────────────
async function crearPeriodosProgramaEnCiclo(
    programaId: string,
    cicloId: string,
    mesesDelCiclo: number[],
    escuelas: { id: string }[]
): Promise<number> {
    const programa = await prisma.programa.findUnique({
        where: { id: programaId },
        select: { tipo: true },
    });
    if (!programa) return 0;

    // Idempotency: skip if already has a period in this cycle
    const existente = await prisma.periodoEntrega.findFirst({
        where: { cicloEscolarId: cicloId, programaId },
    });
    if (existente) return 0;

    const tipo = programa.tipo;
    let creados = 0;

    if (tipo === "ANUAL") {
        const periodo = await prisma.periodoEntrega.create({
            data: { cicloEscolarId: cicloId, programaId, activo: false },
        });
        if (escuelas.length > 0) {
            await prisma.entrega.createMany({
                data: escuelas.map((e) => ({
                    escuelaId: e.id,
                    periodoEntregaId: periodo.id,
                })),
                skipDuplicates: true,
            });
        }
        creados = 1;
    } else if (tipo === "SEMESTRAL") {
        for (const semestre of [1, 2]) {
            const periodo = await prisma.periodoEntrega.create({
                data: { cicloEscolarId: cicloId, programaId, semestre, activo: false },
            });
            if (escuelas.length > 0) {
                await prisma.entrega.createMany({
                    data: escuelas.map((e) => ({
                        escuelaId: e.id,
                        periodoEntregaId: periodo.id,
                    })),
                    skipDuplicates: true,
                });
            }
            creados++;
        }
    } else if (tipo === "MENSUAL") {
        for (const mes of mesesDelCiclo) {
            const periodo = await prisma.periodoEntrega.create({
                data: { cicloEscolarId: cicloId, programaId, mes, activo: false },
            });
            if (escuelas.length > 0) {
                await prisma.entrega.createMany({
                    data: escuelas.map((e) => ({
                        escuelaId: e.id,
                        periodoEntregaId: periodo.id,
                    })),
                    skipDuplicates: true,
                });
            }
            creados++;
        }
    }

    return creados;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: calcula el array de meses (1-12) para un rango de fechas
// ─────────────────────────────────────────────────────────────────────────────
function calcularMesesDelCiclo(inicio: Date, fin: Date): number[] {
    const meses: number[] = [];
    const cur = new Date(inicio);
    cur.setDate(1);
    const finCiclo = new Date(fin);
    while (cur <= finCiclo) {
        meses.push(cur.getMonth() + 1);
        cur.setMonth(cur.getMonth() + 1);
    }
    return meses;
}

// GET - Listar todos los ciclos escolares (solo admins)
export async function GET() {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;

        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const ciclos = await prisma.cicloEscolar.findMany({
            orderBy: { inicio: "desc" },
        });

        return NextResponse.json(ciclos);
    } catch (error: unknown) {
        console.error("Error fetching ciclos:", error);
        return NextResponse.json({ error: "Error al cargar los ciclos escolares" }, { status: 500 });
    }
}

// POST - Crear un nuevo ciclo escolar (solo admins)
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;

        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { nombre, inicio, fin } = await request.json();

        if (!nombre || !inicio || !fin) {
            return NextResponse.json({ error: "Campos incompletos" }, { status: 400 });
        }

        const exists = await prisma.cicloEscolar.findUnique({ where: { nombre } });
        if (exists) {
            return NextResponse.json({ error: "El ciclo escolar ya existe" }, { status: 400 });
        }

        const nuevoCiclo = await prisma.cicloEscolar.create({
            data: {
                nombre,
                inicio: new Date(inicio),
                fin: new Date(fin),
                activo: false,
            },
        });

        return NextResponse.json({ success: true, ciclo: nuevoCiclo });
    } catch (error: unknown) {
        console.error("Error creating ciclo:", error);
        return NextResponse.json({ error: "Error al crear el ciclo escolar" }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Punto 3: PATCH extendido
// Acepta:
//   copiarProgramaIds?: string[]  → activa el ciclo + crea periodos para esos programas
//   agregarProgramaIds?: string[] → agrega programas al ciclo (puede ser el activo)
//   eliminarProgramaIds?: string[] → elimina periodos de esos programas en el ciclo
// Si solo llegan agregarProgramaIds/eliminarProgramaIds NO cambia el flag activo.
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;

        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const {
            id,
            copiarProgramaIds,
            agregarProgramaIds,
            eliminarProgramaIds,
        }: {
            id: string;
            copiarProgramaIds?: string[];
            agregarProgramaIds?: string[];
            eliminarProgramaIds?: string[];
        } = await request.json();

        if (!id) {
            return NextResponse.json({ error: "ID de ciclo no proporcionado" }, { status: 400 });
        }

        const targetCiclo = await prisma.cicloEscolar.findUnique({ where: { id } });
        if (!targetCiclo) {
            return NextResponse.json({ error: "El ciclo escolar no existe" }, { status: 404 });
        }

        const escuelas = await prisma.escuela.findMany({ select: { id: true } });
        const mesesDelCiclo = calcularMesesDelCiclo(targetCiclo.inicio, targetCiclo.fin);

        let programasMigrados = 0;
        let programasAgregados = 0;
        let programasEliminados = 0;

        // ── copiarProgramaIds: modo activación ────────────────────────────
        if (Array.isArray(copiarProgramaIds) && copiarProgramaIds.length > 0) {
            for (const pid of copiarProgramaIds) {
                const creados = await crearPeriodosProgramaEnCiclo(pid, id, mesesDelCiclo, escuelas);
                if (creados > 0) programasMigrados++; // cuenta programas, no periodos
            }
        }

        // ── agregarProgramaIds: agregar al ciclo (sin activar) ────────────
        if (Array.isArray(agregarProgramaIds) && agregarProgramaIds.length > 0) {
            for (const pid of agregarProgramaIds) {
                const creados = await crearPeriodosProgramaEnCiclo(pid, id, mesesDelCiclo, escuelas);
                if (creados > 0) programasAgregados++; // cuenta programas, no periodos
            }
        }

        // ── eliminarProgramaIds: borrar Entregas PRIMERO (FK restrict) ────
        if (Array.isArray(eliminarProgramaIds) && eliminarProgramaIds.length > 0) {
            for (const pid of eliminarProgramaIds) {
                // 1. Borrar Entregas del ciclo+programa (cascada elimina archivos/correcciones/preRevision/chat)
                await prisma.entrega.deleteMany({
                    where: { periodoEntrega: { cicloEscolarId: id, programaId: pid } },
                });
                // 2. Borrar PeriodoEntrega (ahora sin FK viva)
                await prisma.periodoEntrega.deleteMany({
                    where: { cicloEscolarId: id, programaId: pid },
                });
            }
            programasEliminados = eliminarProgramaIds.length; // cuenta programas
        }

        // ── Activar ciclo solo si viene copiarProgramaIds (modo activación) ─
        if (Array.isArray(copiarProgramaIds)) {
            await prisma.$transaction([
                prisma.cicloEscolar.updateMany({
                    where: { id: { not: id } },
                    data: { activo: false },
                }),
                prisma.cicloEscolar.update({
                    where: { id },
                    data: { activo: true },
                }),
            ]);
        }

        return NextResponse.json({
            success: true,
            programasMigrados,
            programasAgregados,
            programasEliminados,
            message: Array.isArray(copiarProgramaIds)
                ? `Ciclo ${targetCiclo.nombre} activado`
                : "Programas del ciclo actualizados",
        });
    } catch (error: unknown) {
        console.error("Error updating ciclo:", error);
        return NextResponse.json({ error: "Error al actualizar el ciclo escolar" }, { status: 500 });
    }
}
