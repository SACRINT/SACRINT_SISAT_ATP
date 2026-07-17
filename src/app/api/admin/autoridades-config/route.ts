import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const session = await auth();
        if (!session || (session.user as any).role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        let config = await prisma.autoridadesConfig.findUnique({
            where: { id: "singleton" },
        });

        if (!config) {
            config = await prisma.autoridadesConfig.create({
                data: { id: "singleton" }
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error("Error fetching autoridades config:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || (session.user as any).role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const data = await req.json();

        const config = await prisma.autoridadesConfig.upsert({
            where: { id: "singleton" },
            update: {
                supervisor: data.supervisor,
                coordinadorRegional: data.coordinadorRegional,
                directorNivel: data.directorNivel,
                atp: data.atp,
            },
            create: {
                id: "singleton",
                supervisor: data.supervisor,
                coordinadorRegional: data.coordinadorRegional,
                directorNivel: data.directorNivel,
                atp: data.atp,
            }
        });

        return NextResponse.json(config);
    } catch (error) {
        console.error("Error updating autoridades config:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
