import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
    const session = await auth();

    if (!session || (session.user as any)?.role !== "admin") {
        redirect("/login");
    }

    // Get active ciclo
    const ciclo = await prisma.cicloEscolar.findFirst({
        where: { activo: true },
    });

    if (!ciclo) {
        return <div style={{ padding: "2rem", textAlign: "center" }}>No hay ciclo escolar activo</div>;
    }

    // Fetch programas with periodos and entregas
    const programas = await prisma.programa.findMany({
        orderBy: { orden: "asc" },
        include: {
            periodos: {
                where: { cicloEscolarId: ciclo.id },
                orderBy: [{ mes: "asc" }, { semestre: "asc" }],
                include: {
                    entregas: {
                        include: {
                            escuela: true,
                            archivos: { where: { tipo: "ENTREGA" } },
                            correcciones: true,
                        },
                    },
                },
            },
        },
    });

    // Fetch escuelas
    const escuelas = await prisma.escuela.findMany({
        orderBy: { nombre: "asc" },
        include: {
            entregas: {
                where: {
                    periodoEntrega: { cicloEscolarId: ciclo.id, activo: true },
                },
                include: {
                    periodoEntrega: { include: { programa: true } },
                    archivos: { where: { tipo: "ENTREGA" } },
                },
            },
        },
    });

    // Calculate stats from active periods only
    const activeEntregas = programas.flatMap((p) =>
        p.periodos.filter((per) => per.activo).flatMap((per) => per.entregas)
    );

    const stats = {
        totalEntregas: activeEntregas.length,
        aprobadas: activeEntregas.filter((e) => e.estado === "APROBADO").length,
        pendientes: activeEntregas.filter((e) => e.estado === "PENDIENTE").length,
        enRevision: activeEntregas.filter((e) => e.estado === "EN_REVISION").length,
        requiereCorreccion: activeEntregas.filter((e) => e.estado === "REQUIERE_CORRECCION").length,
        noAprobado: activeEntregas.filter((e) => e.estado === "NO_APROBADO").length,
        noEntregadas: activeEntregas.filter((e) => e.estado === "NO_ENTREGADO").length,
    };

    return (
        <AdminDashboard
            programas={JSON.parse(JSON.stringify(programas))}
            escuelas={JSON.parse(JSON.stringify(escuelas))}
            stats={stats}
            ciclo={ciclo.nombre}
            userName={(session.user as any)?.name || "Admin"}
        />
    );
}
