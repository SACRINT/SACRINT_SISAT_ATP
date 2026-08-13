import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH: ATP toggles a periodo's active status
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;
        const { activo } = await req.json();

        const periodo = await prisma.periodoEntrega.update({
            where: { id },
            data: { activo: Boolean(activo) },
            include: { programa: true },
        });

        // Verificar si el programa tiene al menos un periodo activo en este ciclo
        const periodosCiclo = await prisma.periodoEntrega.findMany({
            where: {
                cicloEscolarId: periodo.cicloEscolarId,
                programaId: periodo.programaId,
            },
        });

        const programaTienePeriodoActivo = periodosCiclo.some((p) => p.activo);

        // Sincronizar escuelas: actualizar programasInactivos
        const todasEscuelas = await prisma.escuela.findMany({ select: { id: true, permisos: true } });
        const updatesEscuelas = todasEscuelas.map((esc) => {
            const permisos = (esc.permisos as any) || {};
            let inactivos: string[] = Array.isArray(permisos.programasInactivos) ? [...permisos.programasInactivos] : [];
            if (periodo.programa?.nombre) {
                inactivos = inactivos.filter((p: string) => p !== periodo.programa.nombre);
            }
            if (programaTienePeriodoActivo) {
                inactivos = inactivos.filter((p: string) => p !== periodo.programaId);
            } else {
                if (!inactivos.includes(periodo.programaId)) {
                    inactivos.push(periodo.programaId);
                }
            }
            return prisma.escuela.update({
                where: { id: esc.id },
                data: { permisos: { ...permisos, programasInactivos: inactivos } },
            });
        });
        await Promise.all(updatesEscuelas);

        revalidatePath("/admin");
        revalidatePath("/director");

        return NextResponse.json({ success: true, periodo });
    } catch (error: unknown) {
        console.error("Periodo update error:", error);
        return NextResponse.json({ error: "Error al actualizar periodo" }, { status: 500 });
    }
}
