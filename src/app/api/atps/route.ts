import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin" || (session.user as any)?.dbRole !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const admins = await prisma.admin.findMany({
            select: {
                id: true,
                email: true,
                nombre: true,
                role: true,
            },
            orderBy: { nombre: "asc" }
        });

        return NextResponse.json(admins);
    } catch (error) {
        return NextResponse.json({ error: "Error al obtener administradores" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin" || (session.user as any)?.dbRole !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const data = await request.json();

        // Check if email already exists
        const exists = await prisma.admin.findUnique({ where: { email: data.email } });
        if (exists) {
            return NextResponse.json({ error: "El correo ya está registrado" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(data.password, 12);

        const admin = await prisma.admin.create({
            data: {
                nombre: data.nombre,
                email: data.email,
                password: hashedPassword,
                role: data.role || "ATP_LECTOR",
            }
        });

        return NextResponse.json({
            id: admin.id,
            nombre: admin.nombre,
            email: admin.email,
            role: admin.role
        });
    } catch (error) {
        return NextResponse.json({ error: "Error al crear administrador" }, { status: 500 });
    }
}
