import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { INSTITUCION_FALLBACK } from "@/lib/institucion";

export async function GET() {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        if (!session || !["admin", "supervision", "atp"].includes(user?.role || "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        let config = await prisma.autoridadesConfig.findUnique({
            where: { id: "singleton" },
        });

        if (!config) {
            config = await prisma.autoridadesConfig.create({
                data: { id: "singleton" }
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error("Error fetching autoridades config:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const data = await req.json();

        const config = await prisma.autoridadesConfig.upsert({
            where: { id: "singleton" },
            update: {
                nombreSupervision: data.nombreSupervision,
                zona: data.zona,
                cct: data.cct,
                municipio: data.municipio,
                entidad: data.entidad,
                numeroOficioBase: data.numeroOficioBase,
                emailReporteNivel: data.emailReporteNivel,
                supervisor: data.supervisor,
                supervisorRFC: data.supervisorRFC,
                supervisorFecha: data.supervisorFecha,
                supervisorClave: data.supervisorClave,
                coordinadorRegional: data.coordinadorRegional,
                directorNivel: data.directorNivel,
                atp1Nombre: data.atp1Nombre,
                atp1RFC: data.atp1RFC,
                atp1Fecha: data.atp1Fecha,
                atp1Clave: data.atp1Clave,
                atp2Nombre: data.atp2Nombre,
                atp2RFC: data.atp2RFC,
                atp2Fecha: data.atp2Fecha,
                atp2Clave: data.atp2Clave,
                atp3Nombre: data.atp3Nombre,
                atp3RFC: data.atp3RFC,
                atp3Fecha: data.atp3Fecha,
                atp3Clave: data.atp3Clave,
                atp4Nombre: data.atp4Nombre,
                atp4RFC: data.atp4RFC,
                atp4Fecha: data.atp4Fecha,
                atp4Clave: data.atp4Clave,
            },
            create: {
                id: "singleton",
                nombreSupervision: data.nombreSupervision || INSTITUCION_FALLBACK.nombreSupervision,
                zona: data.zona || INSTITUCION_FALLBACK.zona,
                cct: data.cct || INSTITUCION_FALLBACK.cct,
                municipio: data.municipio || INSTITUCION_FALLBACK.municipio,
                entidad: data.entidad || INSTITUCION_FALLBACK.entidad,
                numeroOficioBase: data.numeroOficioBase || INSTITUCION_FALLBACK.numeroOficioBase,
                emailReporteNivel: data.emailReporteNivel || INSTITUCION_FALLBACK.emailReporteNivel,
                supervisor: data.supervisor,
                supervisorRFC: data.supervisorRFC,
                supervisorFecha: data.supervisorFecha,
                supervisorClave: data.supervisorClave,
                coordinadorRegional: data.coordinadorRegional,
                directorNivel: data.directorNivel,
                atp1Nombre: data.atp1Nombre,
                atp1RFC: data.atp1RFC,
                atp1Fecha: data.atp1Fecha,
                atp1Clave: data.atp1Clave,
                atp2Nombre: data.atp2Nombre,
                atp2RFC: data.atp2RFC,
                atp2Fecha: data.atp2Fecha,
                atp2Clave: data.atp2Clave,
                atp3Nombre: data.atp3Nombre,
                atp3RFC: data.atp3RFC,
                atp3Fecha: data.atp3Fecha,
                atp3Clave: data.atp3Clave,
                atp4Nombre: data.atp4Nombre,
                atp4RFC: data.atp4RFC,
                atp4Fecha: data.atp4Fecha,
                atp4Clave: data.atp4Clave,
            }
        });

        return NextResponse.json(config);
    } catch (error) {
        console.error("Error updating autoridades config:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
