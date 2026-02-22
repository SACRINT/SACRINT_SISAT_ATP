import { NextRequest, NextResponse } from "next/server";
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
        const { nombre, descripcion, tipo, numArchivos, orden } = data;

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
            },
        });

        // ==========================================
        // CREATE ASSOCIATED PERIODS AND DELIVERIES
        // ==========================================
        const cicloActivo = await prisma.cicloEscolar.findFirst({ where: { activo: true } });
        const escuelas = await prisma.escuela.findMany();

        if (cicloActivo && escuelas.length > 0) {
            const MESES_CICLO = [
                { mes: 8, año: 2025 }, { mes: 9, año: 2025 }, { mes: 10, año: 2025 }, { mes: 11, año: 2025 }, { mes: 12, año: 2025 },
                { mes: 1, año: 2026 }, { mes: 2, año: 2026 }, { mes: 3, año: 2026 }, { mes: 4, año: 2026 }, { mes: 5, año: 2026 }, { mes: 6, año: 2026 }, { mes: 7, año: 2026 }
            ];

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
                for (const { mes } of MESES_CICLO) {
                    const periodo = await prisma.periodoEntrega.create({
                        data: { cicloEscolarId: cicloActivo.id, programaId: newPrograma.id, mes, activo: false }
                    });
                    for (const esc of escuelas) {
                        await prisma.entrega.create({ data: { escuelaId: esc.id, periodoEntregaId: periodo.id } });
                    }
                }
            }
        }

        return NextResponse.json(newPrograma, { status: 201 });
    } catch (error: unknown) {
        console.error("Error creating programa:", error);
        return NextResponse.json({ error: "No se pudo crear el programa. Verifique que el nombre no esté duplicado." }, { status: 500 });
    }
}
