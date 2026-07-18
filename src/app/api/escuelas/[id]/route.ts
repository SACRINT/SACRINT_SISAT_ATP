import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const escuelaId = params.id;

        const data = await request.json();
        const { nombre, email, director, password, municipio, zonaEscolar, rfc, curp, clavePresupuestal, fechaIngreso, esDePrueba, esSupervision, permisos } = data;

        const updateData: any = {
            nombre: typeof nombre === "string" ? nombre : undefined,
            email: typeof email === "string" ? email : undefined,
            director: typeof director === "string" ? director : undefined,
            municipio: typeof municipio === "string" ? municipio : undefined,
            zonaEscolar: typeof zonaEscolar === "string" ? zonaEscolar : undefined,
            esDePrueba: typeof esDePrueba === "boolean" ? esDePrueba : undefined,
            esSupervision: typeof esSupervision === "boolean" ? esSupervision : undefined,
            permisos: permisos !== undefined ? permisos : undefined,
        };

        if (password && password.trim().length > 0) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        // Upsert directorExpediente if extended data is provided
        if (rfc !== undefined || curp !== undefined || clavePresupuestal !== undefined || fechaIngreso !== undefined) {
             updateData.directorExpediente = {
                 upsert: {
                     create: {
                         rfc: rfc || "",
                         curp: curp || "",
                         clavePresupuestal: clavePresupuestal || "",
                         fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null,
                     },
                     update: {
                         rfc: rfc !== undefined ? rfc : undefined,
                         curp: curp !== undefined ? curp : undefined,
                         clavePresupuestal: clavePresupuestal !== undefined ? clavePresupuestal : undefined,
                         fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : undefined,
                     }
                 }
             };
        }

        const escuelaUpdate = await prisma.escuela.update({
            where: { id: escuelaId },
            data: updateData,
            include: { directorExpediente: true }
        });

        return NextResponse.json(escuelaUpdate);
    } catch (error: unknown) {
        console.error("Error updating escuela:", error);
        return NextResponse.json({ error: "Ocurrió un error al actualizar los datos del centro de trabajo" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const escuelaId = params.id;

        await prisma.escuela.delete({
            where: { id: escuelaId },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting escuela:", error);
        return NextResponse.json({ error: "No se pudo eliminar la escuela. Ocurrió un error interno." }, { status: 500 });
    }
}
