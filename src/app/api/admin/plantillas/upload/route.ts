import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsearYValidarPlantillaExcel, guardarPlantillaRegistro } from "@/lib/plantillas-sparh/sparh-engine";
import { registrarError } from "@/lib/error-log";
import { EstadoPlantilla } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId || process.env.TENANT_ID || "zona004";

        if (!session || !["admin", "supervision"].includes(user?.role || "")) {
            return NextResponse.json({ error: "Rol no autorizado. Solo administración o supervisión pueden cargar plantillas." }, { status: 403 });
        }

        const formData = await req.formData();
        const pdfFile = formData.get("pdfFile") as File | null;
        const excelFile = formData.get("excelFile") as File | null || formData.get("file") as File | null;
        const escuelaCCT = formData.get("escuelaCCT") as string | null;
        const escuelaId = formData.get("escuelaId") as string | null;
        const escuelaNombre = formData.get("escuelaNombre") as string | null;

        if (!pdfFile && !excelFile) {
            return NextResponse.json({ error: "Debe subir al menos el PDF escaneado (entregable principal) o la sábana Excel" }, { status: 400 });
        }

        const MAX_SIZE = 25 * 1024 * 1024; // 25MB
        if (pdfFile) {
            if (pdfFile.size > MAX_SIZE) {
                return NextResponse.json({ error: "El archivo PDF supera el límite de 25MB" }, { status: 400 });
            }
            const ext = pdfFile.name.split(".").pop()?.toLowerCase();
            if (ext !== "pdf") {
                return NextResponse.json({ error: "El archivo PDF debe tener extensión .pdf" }, { status: 400 });
            }
        }
        if (excelFile) {
            if (excelFile.size > MAX_SIZE) {
                return NextResponse.json({ error: "El archivo Excel supera el límite de 25MB" }, { status: 400 });
            }
            const ext = excelFile.name.split(".").pop()?.toLowerCase();
            if (ext !== "xlsx" && ext !== "xls") {
                return NextResponse.json({ error: "El archivo Excel debe tener extensión .xlsx o .xls" }, { status: 400 });
            }
        }

        // Cargar configuración de corte
        const configRecord = await prisma.plantillaCorteConfig.findUnique({
            where: { tenantId }
        });

        const config = {
            maxHorasJornadaDocente: configRecord?.maxHorasJornadaDocente || 40,
            permitirDoblePlaza: configRecord?.permitirDoblePlaza || false
        };

        let parsedResult = undefined;
        if (excelFile) {
            const arrayBuffer = await excelFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            parsedResult = await parsearYValidarPlantillaExcel(buffer, excelFile.name, config);
        }

        const filenameToUse = pdfFile ? pdfFile.name : (excelFile ? excelFile.name : "entregable.pdf");
        const crypto = require("crypto");
        const sampleBuffer = pdfFile ? Buffer.from(await pdfFile.arrayBuffer()) : (excelFile ? Buffer.from(await excelFile.arrayBuffer()) : Buffer.from(""));
        const hash = crypto.createHash("sha256").update(sampleBuffer).digest("hex");

        let estadoFinal: EstadoPlantilla = EstadoPlantilla.RECIBIDO;
        if (parsedResult) {
            const tieneErroresCriticos = parsedResult.inconsistencias.some((i: { severidad: string }) => i.severidad === "ERROR_CRITICO");
            estadoFinal = tieneErroresCriticos ? EstadoPlantilla.CON_ERRORES : EstadoPlantilla.RECIBIDO;
        }

        const reg = await prisma.plantillaPersonalRegistro.create({
            data: {
                tenantId,
                escuelaId: escuelaId || undefined,
                escuelaCCT: escuelaCCT || undefined,
                escuelaNombre: escuelaNombre || undefined,
                nombreArchivo: filenameToUse,
                sha256Hash: hash,
                pdfNombre: pdfFile ? pdfFile.name : undefined,
                fechaEntregaPdf: pdfFile ? new Date() : undefined,
                excelNombre: excelFile ? excelFile.name : undefined,
                fechaSubidaExcel: excelFile ? new Date() : undefined,
                totalRegistros: parsedResult ? parsedResult.totalRegistros : 0,
                totalHoras: parsedResult ? parsedResult.totalHoras : 0,
                estado: estadoFinal,
                metadatos: {
                    fechaCarga: new Date().toISOString(),
                    tienePdf: !!pdfFile,
                    tieneExcel: !!excelFile,
                    totalInconsistencias: parsedResult ? parsedResult.inconsistencias.length : 0
                },
                plazas: parsedResult ? {
                    create: parsedResult.plazas.map((p: {
                        escuelaCCT?: string;
                        rfc?: string;
                        curp?: string;
                        nombreDocente?: string;
                        clavePlaza?: string;
                        funcion?: string;
                        horasAsignadas: number;
                    }) => ({
                        tenantId,
                        escuelaCCT: p.escuelaCCT || escuelaCCT,
                        rfc: p.rfc,
                        curp: p.curp,
                        nombreDocente: p.nombreDocente,
                        clavePlaza: p.clavePlaza,
                        funcion: p.funcion,
                        horasAsignadas: p.horasAsignadas
                    }))
                } : undefined,
                inconsistencias: parsedResult ? {
                    create: parsedResult.inconsistencias.map((inc: {
                        tipoInconsistencia: string;
                        severidad: "INFO" | "ADVERTENCIA" | "ERROR_CRITICO";
                        filaNumero?: number;
                        columnaCampo?: string;
                        valorEncontrado?: string;
                        descripcion: string;
                    }) => ({
                        tenantId,
                        escuelaCCT: escuelaCCT,
                        tipoInconsistencia: inc.tipoInconsistencia,
                        severidad: inc.severidad,
                        filaNumero: inc.filaNumero,
                        columnaCampo: inc.columnaCampo,
                        valorEncontrado: inc.valorEncontrado,
                        descripcion: inc.descripcion
                    }))
                } : undefined
            }
        });

        return NextResponse.json({
            mensaje: "Entregables SPARH recibidos y procesados correctamente",
            registro: reg
        });
    } catch (err: unknown) {
        const session = await auth();
        const user = session?.user as { organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId || process.env.TENANT_ID || "zona004";

        const msg = err instanceof Error ? err.message : "Error al subir entregable de plantilla";
        await registrarError(tenantId, {
            mensaje: msg,
            ruta: "/api/admin/plantillas/upload",
            metodo: "POST",
            stack: err instanceof Error ? err.stack : undefined
        });

        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
