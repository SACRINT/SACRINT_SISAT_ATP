import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const data = await request.json();
        const { nombre, descripcion, tipo, numArchivos, orden, etiquetasArchivos, esParaSupervision, activo, visibleEnDirector, quienesPuedenSubir } = data;

        if (!nombre || !tipo) {
            return NextResponse.json({ error: "El nombre y el tipo son requeridos" }, { status: 400 });
        }

        const newPrograma = await prisma.programa.create({
            data: {
                nombre,
                descripcion,
                tipo,
                numArchivos: parseInt(numArchivos) || 1,
                orden: parseInt(orden) || 0,
                etiquetasArchivos: Array.isArray(etiquetasArchivos) ? etiquetasArchivos : [],
                esParaSupervision: esParaSupervision === true,
                activo: activo !== undefined ? activo === true : true,
                visibleEnDirector: visibleEnDirector !== undefined ? visibleEnDirector === true : true,
                quienesPuedenSubir: Array.isArray(quienesPuedenSubir) ? quienesPuedenSubir : ["director"],
            },
        });

        // ==========================================
        // CREATE ASSOCIATED PERIODS AND DELIVERIES
        // ==========================================
        const cicloActivo = await prisma.cicloEscolar.findFirst({ where: { activo: true } });
        const escuelas = await prisma.escuela.findMany();


        if (cicloActivo && escuelas.length > 0) {
            // Calculate months dynamically from the active cycle's date range
            const mesesDelCiclo: number[] = [];
            const cur = new Date(cicloActivo.inicio);
            cur.setDate(1);
            const finCiclo = new Date(cicloActivo.fin);
            while (cur <= finCiclo) {
                mesesDelCiclo.push(cur.getMonth() + 1); // 1-12
                cur.setMonth(cur.getMonth() + 1);
            }

            if (tipo === "ANUAL") {
                const periodo = await prisma.periodoEntrega.create({
                    data: { cicloEscolarId: cicloActivo.id, programaId: newPrograma.id, activo: false }
                });
                for (const esc of escuelas) {
                    await prisma.entrega.create({ data: { escuelaId: esc.id, periodoEntregaId: periodo.id } });
                }
            } else if (tipo === "SEMESTRAL") {
                for (const sem of [1, 2]) {
                    const periodo = await prisma.periodoEntrega.create({
                        data: { cicloEscolarId: cicloActivo.id, programaId: newPrograma.id, semestre: sem, activo: false }
                    });
                    for (const esc of escuelas) {
                        await prisma.entrega.create({ data: { escuelaId: esc.id, periodoEntregaId: periodo.id } });
                    }
                }
            } else if (tipo === "MENSUAL") {
                for (const mes of mesesDelCiclo) {
                    const periodo = await prisma.periodoEntrega.create({
                        data: { cicloEscolarId: cicloActivo.id, programaId: newPrograma.id, mes, activo: false }
                    });
                    for (const esc of escuelas) {
                        await prisma.entrega.create({ data: { escuelaId: esc.id, periodoEntregaId: periodo.id } });
                    }
                }
            }
        }


        // Re-fetch the complete programa with periods so frontend gets accurate data
        const completePrograma = await prisma.programa.findUnique({
            where: { id: newPrograma.id },
            include: {
                periodos: {
                    ...(cicloActivo ? { where: { cicloEscolarId: cicloActivo.id } } : {}),
                    orderBy: [{ mes: "asc" }, { semestre: "asc" }],
                    include: {
                        entregas: {
                            include: {
                                escuela: true,
                                archivos: { where: { tipo: "ENTREGA" } },
                                correcciones: {
                                    include: {
                                        admin: { select: { id: true, nombre: true } },
                                        archivo: true,
                                    },
                                    orderBy: { createdAt: "desc" },
                                },
                            },
                        },
                    },
                },
            },
        });

        revalidatePath("/admin");
        revalidatePath("/director");
        return NextResponse.json(completePrograma, { status: 201 });
    } catch (error: unknown) {
        console.error("Error creating programa:", error);
        return NextResponse.json({ error: "No se pudo crear el programa. Verifique que el nombre no esté duplicado." }, { status: 500 });
    }
}
