import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Listar llaves de API (con máscara por seguridad)
export async function GET() {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        // Reactivar automáticamente llaves bloqueadas hace más de 15 minutos
        const checkTime = new Date(Date.now() - 15 * 60 * 1000);
        await prisma.apiKey.updateMany({
            where: {
                active: false,
                errorCount: { gte: 5 },
                updatedAt: { lte: checkTime },
            },
            data: {
                active: true,
                errorCount: 0,
            },
        });

        const keys = await prisma.apiKey.findMany({
            orderBy: { createdAt: "desc" },
        });

        // Enmascarar las llaves antes de enviarlas al cliente
        const maskedKeys = keys.map(k => {
            let masked = "****";
            if (k.key && k.key.length > 8) {
                masked = `${k.key.slice(0, 6)}...${k.key.slice(-4)}`;
            }
            return {
                ...k,
                key: masked, // no exponer la llave completa
            };
        });

        return NextResponse.json(maskedKeys);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error al listar las llaves" }, { status: 500 });
    }
}

// POST - Crear una nueva llave de API
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { provider, key, label, isPremium } = body;

        if (!provider || !key || !label) {
            return NextResponse.json({ error: "Proveedor, Clave y Etiqueta son requeridos" }, { status: 400 });
        }

        const newKey = await prisma.apiKey.create({
            data: {
                provider,
                key: key.trim(),
                label: label.trim(),
                isPremium: !!isPremium,
                active: true,
            },
        });

        // Retornar enmascarado
        return NextResponse.json({
            ...newKey,
            key: `${key.slice(0, 6)}...${key.slice(-4)}`
        }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error al registrar la llave" }, { status: 500 });
    }
}
