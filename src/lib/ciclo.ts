import { cookies } from "next/headers";
import { prisma } from "./db";

export async function obtenerCicloActual() {
    try {
        const cookieStore = await cookies();
        const selectedCicloId = cookieStore.get("selectedCicloId")?.value;

        let ciclo = null;
        if (selectedCicloId) {
            ciclo = await prisma.cicloEscolar.findUnique({
                where: { id: selectedCicloId },
            });
        }

        if (!ciclo) {
            ciclo = await prisma.cicloEscolar.findFirst({
                where: { activo: true },
            });
        }

        return ciclo;
    } catch (error) {
        console.error("Error obteniendo ciclo actual:", error);
        // Fallback directly to active cycle in case cookies() is called in an environment where it's restricted
        return prisma.cicloEscolar.findFirst({
            where: { activo: true },
        });
    }
}
