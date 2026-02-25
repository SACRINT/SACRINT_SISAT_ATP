import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EstadoEntrega } from "@prisma/client";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const data = await req.json();
        const { cct, nombre, localidad, email, password, director } = data;

        if (!cct || !nombre || !localidad || !email || !password) {
            return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
        }

        const existingCCT = await prisma.escuela.findUnique({ where: { cct } });
        if (existingCCT) {
            return NextResponse.json({ error: "La CCT ya está registrada" }, { status: 400 });
        }

        const existingEmail = await prisma.escuela.findUnique({ where: { email } });
        if (existingEmail) {
            return NextResponse.json({ error: "El correo ya está registrado" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const nuevaEscuela = await prisma.escuela.create({
            data: {
                cct,
                nombre,
                localidad,
                email,
                password: hashedPassword,
                director: director || null,
            }
        });

        // Obtener el ciclo activo y sus periodos para asignarle las entregas
        const cicloActivo = await prisma.cicloEscolar.findFirst({
            where: { activo: true },
            include: { periodos: true }
        });

        if (cicloActivo && cicloActivo.periodos.length > 0) {
            const entregasToCreate = cicloActivo.periodos.map((periodo: any) => ({
                escuelaId: nuevaEscuela.id,
                periodoEntregaId: periodo.id,
                estado: EstadoEntrega.NO_ENTREGADO
            }));

            await prisma.entrega.createMany({
                data: entregasToCreate
            });
        }

        return NextResponse.json(nuevaEscuela);

    } catch (error: any) {
        console.error("Error creating escuela:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
