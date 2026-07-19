import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { obtenerCicloActual } from "@/lib/ciclo";
import AdminDashboard from "../admin/AdminDashboard";

export default async function SupervisionPage() {
    const session = await auth();
    const user = session?.user as { role?: string; cct?: string } | undefined;

    if (!session || user?.role !== "supervision") {
        redirect("/login");
    }

    const cct = user?.cct;
    if (!cct) redirect("/login");

    const supervision = await prisma.escuela.findUnique({
        where: { cct },
    });

    if (!supervision || !supervision.esSupervision) redirect("/login");

    // Get selected or active ciclo
    const ciclo = await obtenerCicloActual();

    if (!ciclo) {
        return <div style={{ padding: "2rem", textAlign: "center" }}>No hay ciclo escolar activo</div>;
    }

    const todosCiclos = await prisma.cicloEscolar.findMany({
        orderBy: { inicio: "desc" },
    });

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
                            preRevision: true,
                            correcciones: {
                                include: {
                                    admin: { select: { id: true, nombre: true } },
                                    archivo: true,
                                },
                                orderBy: { createdAt: "desc" }
                            },
                        },
                    },
                },
            },
        },
    });

    // Fetch escuelas
    const escuelas = await prisma.escuela.findMany({
        orderBy: { nombre: "asc" },
        select: {
            id: true,
            cct: true,
            nombre: true,
            localidad: true,
            municipio: true,
            zonaEscolar: true,
            director: true,
            email: true,
            total: true,
            ultimoIngreso: true,
            directorExpediente: true,
            esDePrueba: true,
            esSupervision: true,
            permisos: true,
            // Incluir el personal con cargo RESPONSABLE para cruzar datos del director
            personal: {
                where: { cargo: "RESPONSABLE" },
                select: {
                    id: true,
                    nombre: true,
                    apellidoPaterno: true,
                    apellidoMaterno: true,
                    curp: true,
                    rfc: true,
                    clavePresupuestal: true,
                    fechaIngreso: true,
                    telefono: true,
                    correoElectronico: true,
                },
                take: 1,
            },
            entregas: {
                where: {
                    periodoEntrega: { cicloEscolarId: ciclo.id, activo: true },
                },
                include: {
                    periodoEntrega: { include: { programa: { select: { nombre: true, esParaSupervision: true } } } },
                    archivos: { where: { tipo: "ENTREGA" } },
                    preRevision: true,
                    correcciones: {
                        include: {
                            admin: { select: { id: true, nombre: true } },
                            archivo: true,
                        },
                        orderBy: { createdAt: "desc" },
                    },
                },
            },
        },
    });

    // Compute zone statistics for the dashboard
    const zonaMap = new Map<string, { zona: string; total: number; aprobadas: number; entregadas: number; escuelas: number }>();
    for (const esc of escuelas) {
        if (esc.esDePrueba || esc.esSupervision) continue; // Excluir escuelas de prueba y supervision de las estadisticas

        const zona = esc.zonaEscolar || "Sin Zona";
        if (!zonaMap.has(zona)) zonaMap.set(zona, { zona, total: 0, aprobadas: 0, entregadas: 0, escuelas: 0 });
        const entry = zonaMap.get(zona)!;
        entry.escuelas += 1;
        entry.total += esc.entregas.length;
        entry.aprobadas += esc.entregas.filter(e => e.estado === "APROBADO").length;
        entry.entregadas += esc.entregas.filter(e => e.estado !== "NO_ENTREGADO").length;
    }
    const zonaStats = Array.from(zonaMap.values()).sort((a, b) => a.zona.localeCompare(b.zona));

    // Fetch recursos
    const recursos = await prisma.recurso.findMany({
        orderBy: { createdAt: "desc" },
        include: { programa: true }
    });

    // Fetch admin sidebar config (singleton)
    const sidebarConfigRaw = await prisma.adminSidebarConfig.findFirst();
    const sidebarConfig = {
        showRecursos: sidebarConfigRaw?.showRecursos ?? true,
        showEventos: sidebarConfigRaw?.showEventos ?? true,
        showCircular05: sidebarConfigRaw?.showCircular05 ?? true,
        showOlimpiada: sidebarConfigRaw?.showOlimpiada ?? true,
        showPAEC: sidebarConfigRaw?.showPAEC ?? true,
        showCapems: sidebarConfigRaw?.showCapems ?? true,
        showExpedientes: sidebarConfigRaw?.showExpedientes ?? true,
    };

    // Calculate stats from active periods only
    const activeEntregas = programas.flatMap((p) =>
        p.periodos.filter((per) => per.activo).flatMap((per) => 
            per.entregas.filter(e => !e.escuela.esDePrueba && !e.escuela.esSupervision)
        )
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

    // Fetch entregas for supervision (to show in 'Mis Entregas')
    const entregasSupervision = await prisma.entrega.findMany({
        where: {
            escuelaId: supervision.id,
            periodoEntrega: {
                cicloEscolarId: ciclo.id,
                activo: true,
            },
        },
        include: {
            periodoEntrega: {
                include: { programa: true },
            },
            archivos: { orderBy: { createdAt: "desc" } },
            correcciones: {
                include: { archivo: true, admin: { select: { nombre: true } } },
                orderBy: { createdAt: "desc" },
            },
        },
        orderBy: { updatedAt: "desc" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const programasMap: Record<string, any> = {};
    for (const ent of entregasSupervision) {
        const prog = ent.periodoEntrega.programa;
        if (!prog.esParaSupervision) continue;
        if (!programasMap[prog.id]) {
            programasMap[prog.id] = {
                programa: {
                    id: prog.id,
                    nombre: prog.nombre,
                    numArchivos: prog.numArchivos,
                    tipo: prog.tipo,
                    etiquetasArchivos: prog.etiquetasArchivos || []
                },
                entregas: [],
            };
        }
        programasMap[prog.id].entregas.push(ent);
    }
    const programasSupervision = Object.values(programasMap);

    return (
        <AdminDashboard
            programas={JSON.parse(JSON.stringify(programas))}
            escuelas={JSON.parse(JSON.stringify(escuelas))}
            recursos={JSON.parse(JSON.stringify(recursos))}
            stats={stats}
            zonaStats={zonaStats}
            ciclo={ciclo.nombre}
            cicloId={ciclo.id}
            cicloObj={JSON.parse(JSON.stringify(ciclo))}
            todosCiclos={JSON.parse(JSON.stringify(todosCiclos))}
            anuncioGlobal={ciclo.anuncioGlobal || null}
            userName={session.user?.name || "Supervisor"}
            dbRole="SUPERVISION"
            supervisionEscuela={JSON.parse(JSON.stringify(supervision))}
            programasSupervision={JSON.parse(JSON.stringify(programasSupervision))}
            permisos={supervision.permisos || {}}
            sidebarConfig={sidebarConfig}
        />
    );
}
