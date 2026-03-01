import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DirectorPortal from "./DirectorPortal";

export default async function DirectorPage() {
    const session = await auth();

    const user = session?.user as { role?: string; cct?: string } | undefined;

    if (!session || user?.role !== "director") {
        redirect("/login");
    }

    const cct = user?.cct;
    if (!cct) redirect("/login");

    const escuela = await prisma.escuela.findUnique({
        where: { cct },
    });

    if (!escuela) redirect("/login");

    // Get active ciclo escolar
    const ciclo = await prisma.cicloEscolar.findFirst({
        where: { activo: true },
    });

    if (!ciclo) {
        return <div>No hay ciclo escolar activo</div>;
    }

    // Get all entregas for this school in the active ciclo, with periodos and archivos
    const entregas = await prisma.entrega.findMany({
        where: {
            escuelaId: escuela.id,
            periodoEntrega: {
                cicloEscolarId: ciclo.id,
                activo: true,
            },
        },
        include: {
            periodoEntrega: {
                include: {
                    programa: true,
                },
            },
            archivos: { orderBy: { createdAt: "desc" } },
            correcciones: {
                include: {
                    archivo: true,
                    admin: { select: { nombre: true } },
                },
                orderBy: { createdAt: "desc" },
            },
        },
        orderBy: {
            periodoEntrega: { programa: { orden: "asc" } },
        },
    });

    const recursos = await prisma.recurso.findMany({
        include: { programa: true },
        orderBy: { createdAt: "desc" },
    });

    // Fetch custom configs for this school
    const configuraciones = await prisma.configuracionPrograma.findMany({
        where: { escuelaId: escuela.id }
    });
    const configMap = new Map(configuraciones.map(c => [c.programaId, c.numArchivos]));

    // Group entregas by programa
    const programasMap: Record<string, {
        programa: { id: string; nombre: string; numArchivos: number; tipo: string };
        entregas: typeof entregas;
    }> = {};

    for (const ent of entregas) {
        const prog = ent.periodoEntrega.programa;
        if (!programasMap[prog.id]) {
            const customNumArchivos = configMap.get(prog.id);
            programasMap[prog.id] = {
                programa: {
                    id: prog.id,
                    nombre: prog.nombre,
                    numArchivos: customNumArchivos !== undefined ? customNumArchivos : prog.numArchivos,
                    tipo: prog.tipo
                },
                entregas: [],
            };
        }
        programasMap[prog.id].entregas.push(ent);
    }

    const programasAgrupados = Object.values(programasMap);

    // Fetch configs globales para los tabs
    const [eventosConfig, circularConfig] = await Promise.all([
        prisma.eventosConfig.findUnique({ where: { id: "singleton" } }),
        prisma.circular05Config.findUnique({ where: { id: "singleton" } })
    ]);

    const isEventosActive = eventosConfig?.activo ?? false;
    const isCircularActive = circularConfig?.activo ?? false;

    return (
        <DirectorPortal
            escuela={JSON.parse(JSON.stringify(escuela))}
            programas={JSON.parse(JSON.stringify(programasAgrupados))}
            ciclo={ciclo.nombre}
            recursos={JSON.parse(JSON.stringify(recursos))}
            isEventosActive={isEventosActive}
            isCircularActive={isCircularActive}
        />
    );
}
