import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { obtenerCicloActual } from "@/lib/ciclo";
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

    // Verificar si la plataforma está en Modo Mantenimiento
    const configGlobal = await prisma.preRevisionConfig.findUnique({ where: { id: "singleton" } });
    if (configGlobal?.mantenimiento && !escuela.esDePrueba) {
        redirect("/mantenimiento");
    }

    // Get selected or active ciclo escolar
    const ciclo = await obtenerCicloActual();

    if (!ciclo) {
        return <div>No hay ciclo escolar activo</div>;
    }

    const todosCiclos = await prisma.cicloEscolar.findMany({
        orderBy: { inicio: "desc" },
    });

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
        programa: { id: string; nombre: string; numArchivos: number; tipo: string; etiquetasArchivos?: string[] };
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
                    tipo: prog.tipo,
                    etiquetasArchivos: (prog.etiquetasArchivos as string[]) || []
                },
                entregas: [],
            };
        }
        programasMap[prog.id].entregas.push(ent);
    }

    // Verificar permisos específicos de la escuela (JSON)
    const permisosEscuela = (escuela.permisos as any) || {};
    const isHorariosActive = permisosEscuela.horariosDesactivado !== true;
    const programasInactivos: string[] = permisosEscuela.programasInactivos || [];

    // Filtrar programas inactivos para esta escuela
    const programasFiltrados = Object.values(programasMap).filter(
        (p) => !programasInactivos.includes(p.programa.id)
    );

    // Fetch configs globales para los tabs
    const [sidebarConfig, eventosConfig, circularConfig, olimpiadaConfig, paecConfig, capemsConfig, expedientesConfig] = await Promise.all([
        prisma.adminSidebarConfig.findUnique({ where: { id: "singleton" } }),
        prisma.eventosConfig.findUnique({ where: { id: "singleton" } }),
        prisma.circular05Config.findUnique({ where: { id: "singleton" } }),
        prisma.olimpiadaConfig.findUnique({ where: { id: "singleton" } }),
        prisma.encuentroPAECConfig.findUnique({ where: { id: "singleton" } }),
        prisma.capemsConfig.findFirst(),
        prisma.expedientesConfig.findUnique({ where: { id: "singleton" } }),
    ]);

    const isEventosActive = (eventosConfig?.activo ?? false) && (sidebarConfig?.showEventos ?? true);
    const isCircularActive = (circularConfig?.activo ?? false) && (sidebarConfig?.showCircular05 ?? true);
    const isOlimpiadaActive = (olimpiadaConfig?.activo ?? false) && (sidebarConfig?.showOlimpiada ?? true);
    const isPAECActive = (paecConfig?.activo ?? false) && (sidebarConfig?.showPAEC ?? true);
    const isCapemsActive = (capemsConfig?.activo ?? false) && (sidebarConfig?.showCapems ?? true);
    const isExpedientesActive = (expedientesConfig?.activo ?? false) && (sidebarConfig?.showExpedientes ?? true);

    return (
        <DirectorPortal
            escuela={JSON.parse(JSON.stringify(escuela))}
            programas={JSON.parse(JSON.stringify(programasFiltrados))}
            ciclo={ciclo.nombre}
            cicloId={ciclo.id}
            cicloObj={JSON.parse(JSON.stringify(ciclo))}
            todosCiclos={JSON.parse(JSON.stringify(todosCiclos))}
            anuncioGlobal={ciclo.anuncioGlobal || undefined}
            recursos={JSON.parse(JSON.stringify(recursos))}
            isEventosActive={isEventosActive}
            isCircularActive={isCircularActive}
            isOlimpiadaActive={isOlimpiadaActive}
            isPAECActive={isPAECActive}
            isCapemsActive={isCapemsActive}
            isExpedientesActive={isExpedientesActive}
            isDocumentosActive={true}
            isHorariosActive={isHorariosActive}
        />
    );
}
