import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { importarDescubrimientos } from "@/lib/discovery/importar-descubrimientos";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        
        if (!session || !["admin", "supervision", "atp"].includes(user?.role || "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Usuario sin organización o tenant asignado" }, { status: 401 });
        }

        // Obtener directorio configurado en CuentaAuditoria si existe
        const cuenta = await prisma.cuentaAuditoria.findFirst({
            where: { tenantId },
        });

        let body: Record<string, string> = {};
        try {
            body = (await req.json()) as Record<string, string>;
        } catch {
            // body opcional
        }

        const directorioCorpus = body.directorioCorpus || cuenta?.directorioCorpus || process.env.CORPUS_BASE_DIR;

        const resultado = await importarDescubrimientos({
            tenantId,
            directorioCorpus,
        });

        return NextResponse.json(resultado);
    } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : "Error al importar planes y descubrimientos";
        console.error("Error al importar planes y descubrimientos:", error);
        return NextResponse.json(
            { error: errMessage },
            { status: 500 }
        );
    }
}
