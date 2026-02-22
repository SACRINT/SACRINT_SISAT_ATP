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

        const body = await request.json();
        const { nombre, descripcion, fechaLimite, numArchivos } = body;

        if (!nombre || nombre.trim() === "") {
            return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
        }

        // Get active cycle
        const ciclo = await prisma.cicloEscolar.findFirst({
            where: { activo: true }
        });

        if (!ciclo) {
            return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 400 });
        }

        // Validate unique program name
        const exist = await prisma.programa.findUnique({
            where: { nombre: nombre.trim() }
        });

        if (exist) {
            return NextResponse.json({ error: "Ya existe un programa o tarea con ese nombre" }, { status: 400 });
        }

        // Execute in transaction
        const nuevoPrograma = await prisma.$transaction(async (tx) => {
            // 1. Create the new Programa
            const programa = await tx.programa.create({
                data: {
                    nombre: nombre.trim(),
                    descripcion: descripcion || "Comisión o tarea extraordinaria",
                    tipo: "ANUAL", // Unique delivery pattern
                    numArchivos: numArchivos ? parseInt(numArchivos) : 1,
                    orden: 99, // Placed at the very end
                }
            });

            // 2. Create the unified PeriodoEntrega
            const periodo = await tx.periodoEntrega.create({
                data: {
                    cicloEscolarId: ciclo.id,
                    programaId: programa.id,
                    activo: true,
                    fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
                }
            });

            // 3. Create an empty Entrega for ALL schools
            const escuelas = await tx.escuela.findMany();

            const entregasData = escuelas.map((esc) => ({
                escuelaId: esc.id,
                periodoEntregaId: periodo.id,
                estado: "NO_ENTREGADO" as const, // Cast to enum
            }));

            if (entregasData.length > 0) {
                await tx.entrega.createMany({
                    data: entregasData
                });
            }

            return programa;
        });

        return NextResponse.json(nuevoPrograma);
    } catch (error: unknown) {
        console.error("Error creating extraordinary task:", error);
        return NextResponse.json({ error: "Ocurrió un error al crear la nueva tarea" }, { status: 500 });
    }
}
