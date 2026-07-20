import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasBackendAccess } from "@/lib/permissions";

// PATCH: ATP changes delivery status
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; dbRole?: string; permisos?: any } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        if (!hasBackendAccess(user, "avances", "write")) {
            return NextResponse.json({ error: "No autorizado (sin permisos de escritura en avances)" }, { status: 403 });
        }

        const { id } = await params;
        const { estado, observaciones } = await req.json();

        let extraData: any = {};
        if (estado === "APROBADO") {
            const current = await prisma.entrega.findUnique({
                where: { id },
                include: { escuela: true, periodoEntrega: { include: { programa: true } } }
            }) as any;
            if (current && !current.cvd) {
                const crypto = require("crypto");
                const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
                const cleanCct = current.escuela.cct.replace(/\s+/g, "");
                const cvd = `CVD-${cleanCct}-${randomHex}`;
                const dataToSign = `${current.escuela.id}-${current.periodoEntrega.programa.nombre}-${new Date().toISOString()}-Ing.AlejandroEscamilla`;
                const signature = crypto.createHash("sha256").update(dataToSign).digest("hex").substring(0, 32).toUpperCase();
                extraData.cvd = cvd;
                extraData.firmaDigital = signature;
            }
        }

        const validEstados = [
            "PENDIENTE",
            "EN_REVISION",
            "REQUIERE_CORRECCION",
            "APROBADO",
            "NO_APROBADO",
            "NO_ENTREGADO",
            "EXENTO",
            "ENTREGADO_FISICO",
        ];

        if (!validEstados.includes(estado)) {
            return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
        }

        const entrega = await prisma.entrega.update({
            where: { id },
            data: {
                estado,
                observacionesATP: observaciones ?? undefined,
                fechaRevision: new Date(),
                ...extraData
            },
        });

        return NextResponse.json({ success: true, entrega });
    } catch (error: unknown) {
        console.error("Estado update error:", error);
        return NextResponse.json({ error: "Error al actualizar estado" }, { status: 500 });
    }
}
