import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const user = session.user as { role?: string; cct?: string };
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim() || "";

        if (!query || query.length < 2) {
            return NextResponse.json({ escuelas: [], personal: [], programas: [], recursos: [] });
        }

        // If user is Admin
        if (user.role === "admin") {
            const [escuelas, personal, programas] = await Promise.all([
                prisma.escuela.findMany({
                    where: {
                        OR: [
                            { nombre: { contains: query, mode: "insensitive" } },
                            { cct: { contains: query, mode: "insensitive" } },
                            { localidad: { contains: query, mode: "insensitive" } },
                        ],
                    },
                    select: { id: true, cct: true, nombre: true, localidad: true },
                    take: 5,
                }),
                prisma.personal.findMany({
                    where: {
                        OR: [
                            { nombre: { contains: query, mode: "insensitive" } },
                            { apellidoPaterno: { contains: query, mode: "insensitive" } },
                            { apellidoMaterno: { contains: query, mode: "insensitive" } },
                            { curp: { contains: query, mode: "insensitive" } },
                        ],
                    },
                    include: {
                        escuela: { select: { id: true, cct: true, nombre: true } },
                    },
                    take: 10,
                }),
                prisma.programa.findMany({
                    where: {
                        nombre: { contains: query, mode: "insensitive" },
                    },
                    select: { id: true, nombre: true, tipo: true },
                    take: 5,
                }),
            ]);

            return NextResponse.json({ escuelas, personal, programas, recursos: [] });
        }

        // If user is Director
        if (user.role === "director") {
            const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
            if (!escuela) {
                return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
            }

            const [personal, programas, recursos] = await Promise.all([
                prisma.personal.findMany({
                    where: {
                        escuelaId: escuela.id,
                        OR: [
                            { nombre: { contains: query, mode: "insensitive" } },
                            { apellidoPaterno: { contains: query, mode: "insensitive" } },
                            { apellidoMaterno: { contains: query, mode: "insensitive" } },
                            { curp: { contains: query, mode: "insensitive" } },
                        ],
                    },
                    take: 10,
                }),
                prisma.programa.findMany({
                    where: {
                        nombre: { contains: query, mode: "insensitive" },
                    },
                    select: { id: true, nombre: true, tipo: true },
                    take: 5,
                }),
                prisma.recurso.findMany({
                    where: {
                        OR: [
                            { titulo: { contains: query, mode: "insensitive" } },
                            { descripcion: { contains: query, mode: "insensitive" } },
                            { archivoNombre: { contains: query, mode: "insensitive" } },
                        ],
                    },
                    include: {
                        programa: { select: { nombre: true } },
                    },
                    take: 5,
                }),
            ]);

            return NextResponse.json({ escuelas: [], personal, programas, recursos });
        }

        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    } catch (error) {
        console.error("Error en búsqueda global:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
