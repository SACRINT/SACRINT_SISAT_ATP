import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
    const session = await auth();

    if (!session || (session.user as any)?.role !== "admin") {
        redirect("/login");
    }

    // Fetch all data for the dashboard
    const programas = await prisma.programa.findMany({
        orderBy: { orden: "asc" },
        include: {
            entregas: {
                include: { escuela: true },
            },
        },
    });

    const escuelas = await prisma.escuela.findMany({
        orderBy: { nombre: "asc" },
        include: {
            entregas: {
                include: { programa: true },
            },
        },
    });

    // Calculate stats
    const totalEntregas = await prisma.entrega.count();
    const completas = await prisma.entrega.count({ where: { estatus: "COMPLETO" } });
    const pendientes = await prisma.entrega.count({ where: { estatus: "PENDIENTE" } });
    const noEntregadas = await prisma.entrega.count({ where: { estatus: "NO_ENTREGADO" } });

    return (
        <AdminDashboard
            programas={JSON.parse(JSON.stringify(programas))}
            escuelas={JSON.parse(JSON.stringify(escuelas))}
            stats={{ totalEntregas, completas, pendientes, noEntregadas }}
            userName={(session.user as any)?.name || "Admin"}
        />
    );
}
