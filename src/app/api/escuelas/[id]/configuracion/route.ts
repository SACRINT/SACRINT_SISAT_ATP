import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const config = await prisma.configuracionPrograma.findMany({
            where: { escuelaId: params.id }
        });

        return NextResponse.json(config);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { configuraciones } = body; // Array of { programaId, numArchivos }

        if (!Array.isArray(configuraciones)) {
            return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
        }

        // Use transaction to delete existing and create new ones
        await prisma.$transaction(async (tx) => {
            await tx.configuracionPrograma.deleteMany({
                where: { escuelaId: params.id }
            });

            if (configuraciones.length > 0) {
                await tx.configuracionPrograma.createMany({
                    data: configuraciones.map((c: any) => ({
                        escuelaId: params.id,
                        programaId: c.programaId,
                        numArchivos: c.numArchivos
                    }))
                });
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
