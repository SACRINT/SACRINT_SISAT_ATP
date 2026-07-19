import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { obtenerCicloActual } from "@/lib/ciclo";
import SupervisionPortal from "./SupervisionPortal";

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

    // Fetch all schools for the "Monitoreo" section
    const escuelas = await prisma.escuela.findMany({
        where: { esDePrueba: false, esSupervision: false },
        orderBy: { nombre: "asc" },
        select: {
            id: true,
            cct: true,
            nombre: true,
            localidad: true,
            municipio: true,
            zonaEscolar: true,
            director: true,
            ultimoIngreso: true,
            directorExpediente: true,
            personal: {
                where: { cargo: "RESPONSABLE" },
                select: { curp: true, rfc: true },
                take: 1,
            },
            entregas: {
                where: {
                    periodoEntrega: { cicloEscolarId: (await obtenerCicloActual())?.id, activo: true },
                },
                include: {
                    periodoEntrega: { include: { programa: true } },
                    archivos: { where: { tipo: "ENTREGA" } },
                    preRevision: true,
                    correcciones: {
                        include: { archivo: true },
                        orderBy: { createdAt: "desc" },
                    },
                },
            },
        }
    });

    const ciclo = await obtenerCicloActual();
    if (!ciclo) {
        return <div>No hay ciclo escolar activo</div>;
    }

    const todosCiclos = await prisma.cicloEscolar.findMany({
        orderBy: { inicio: "desc" },
    });

    // Get entregas for the supervision itself
    const entregas = await prisma.entrega.findMany({
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

    const programas = await prisma.programa.findMany({
        where: { esParaSupervision: true },
        include: {
            periodos: {
                where: { cicloEscolarId: ciclo.id, activo: true },
            },
        },
        orderBy: { orden: "asc" },
    });

    // Group entregas by programa
    const programasMap: Record<string, any> = {};

    for (const ent of entregas) {
        // filter out entregas for programs that are not esParaSupervision
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

    const programasAgrupados = Object.values(programasMap);

    const recursos = await prisma.recurso.findMany({
        orderBy: { createdAt: "desc" },
        include: { programa: true },
    });

    return (
        <SupervisionPortal
            supervision={JSON.parse(JSON.stringify(supervision))}
            escuelas={JSON.parse(JSON.stringify(escuelas))}
            programas={JSON.parse(JSON.stringify(programasAgrupados))}
            ciclo={ciclo.nombre}
            cicloId={ciclo.id}
            cicloObj={JSON.parse(JSON.stringify(ciclo))}
            todosCiclos={JSON.parse(JSON.stringify(todosCiclos))}
            anuncioGlobal={ciclo.anuncioGlobal || undefined}
            recursos={JSON.parse(JSON.stringify(recursos))}
        />
    );
}
