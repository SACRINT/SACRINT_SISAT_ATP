import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";

export interface IngestOptions {
    cuentaId: string;
    tenantId?: string;
    directorioCorpus?: string;
}

export interface IngestResult {
    success: boolean;
    totalHilos: number;
    totalMensajes: number;
    totalRecibidos: number;
    totalEnviados: number;
    totalAdjuntos: number;
    duracionSegundos: number;
    error?: string;
}

function normalizeRelativePath(fullPath: string | null | undefined, baseDir: string): string | null {
    if (!fullPath) return null;
    let norm = fullPath;
    if (norm.startsWith(baseDir)) {
        norm = norm.substring(baseDir.length);
    }
    // Reemplazar barras invertidas de Windows por / o estandarizar
    return norm.replace(/^[\\/]+/, "");
}

export async function ingestarCorpusLocal(options: IngestOptions): Promise<IngestResult> {
    const inicio = Date.now();
    const tenantId = options.tenantId;

    if (!tenantId) {
        throw new Error("tenantId es requerido para la ingesta.");
    }

    // 1. Obtener la cuenta
    const cuenta = await prisma.cuentaAuditoria.findUnique({
        where: { id: options.cuentaId },
    });

    if (!cuenta) {
        throw new Error(`CuentaAuditoria con id ${options.cuentaId} no encontrada.`);
    }

    const baseDir = options.directorioCorpus || cuenta.directorioCorpus || process.env.CORPUS_BASE_DIR;

    if (!baseDir) {
        throw new Error("Directorio del corpus no configurado. Especifíquelo en la configuración de la cuenta o en la variable de entorno CORPUS_BASE_DIR.");
    }

    const rutaIndex = path.join(baseDir, "index", "index.json");
    const rutaThreads = path.join(baseDir, "index", "threads.json");
    const rutaSemantico = path.join(baseDir, "Analisis", "analisis_semantico.json");

    if (!fs.existsSync(rutaIndex)) {
        throw new Error(`No se encontró el archivo de índice en: ${rutaIndex}`);
    }

    // Registrar estado SyncState inicial
    const syncState = await prisma.syncState.create({
        data: {
            tenantId,
            cuentaId: cuenta.id,
            tipoCorrida: "INGESTA_LOCAL_CORPUS",
            estado: "EN_PROCESO",
            iniciadoEn: new Date(),
        },
    });

    await prisma.cuentaAuditoria.update({
        where: { id: cuenta.id },
        data: { estadoIngestion: "PROCESANDO" },
    });

    try {
        // 2. Cargar análisis semántico si existe
        let semanticoMap: Record<string, any> = {};
        if (fs.existsSync(rutaSemantico)) {
            console.log(`[INGESTOR] Cargando analisis semántico desde ${rutaSemantico}...`);
            const semanticoRaw = fs.readFileSync(rutaSemantico, "utf-8");
            semanticoMap = JSON.parse(semanticoRaw);
        }

        // 3. Ingestar Hilos (EmailConversation) si threads.json existe
        let hilosCount = 0;
        if (fs.existsSync(rutaThreads)) {
            console.log(`[INGESTOR] Cargando hilos desde ${rutaThreads}...`);
            const threadsRaw = fs.readFileSync(rutaThreads, "utf-8");
            const threads: any[] = JSON.parse(threadsRaw);

            const CHUNK_SIZE = 500;
            for (let i = 0; i < threads.length; i += CHUNK_SIZE) {
                const chunk = threads.slice(i, i + CHUNK_SIZE);
                const dataToInsert = chunk.map((t) => ({
                    tenantId,
                    cuentaId: cuenta.id,
                    hiloId: t.hilo_id,
                    asuntoNormalizado: t.asunto_normalizado || "(sin asunto)",
                    numMensajes: t.num_mensajes || 1,
                    confianzaHilo: t.confianza || 100,
                    razonUnion: t.razon || null,
                    fechaInicio: new Date(t.fecha_inicio || Date.now()),
                    fechaFin: new Date(t.fecha_fin || Date.now()),
                    participantesJson: t.participantes || [],
                    mensajesIdsJson: t.mensajes_ids || [],
                }));

                await prisma.emailConversation.createMany({
                    data: dataToInsert,
                    skipDuplicates: true,
                });
            }
            hilosCount = threads.length;
            console.log(`[INGESTOR] ${hilosCount} hilos insertados/actualizados.`);
        }

        // 4. Ingestar Mensajes y Adjuntos desde index.json
        console.log(`[INGESTOR] Cargando mensajes desde ${rutaIndex}...`);
        const indexRaw = fs.readFileSync(rutaIndex, "utf-8");
        const messages: any[] = JSON.parse(indexRaw);

        let totalRecibidos = 0;
        let totalEnviados = 0;
        let totalAdjuntos = 0;
        let fechaMin: Date | null = null;
        let fechaMax: Date | null = null;

        const CHUNK_SIZE = 500;
        const allAdjuntosToInsert: any[] = [];

        for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
            const chunk = messages.slice(i, i + CHUNK_SIZE);
            const messagesToInsert = chunk.map((m) => {
                const fecha = new Date(m.fecha);
                if (!fechaMin || fecha < fechaMin) fechaMin = fecha;
                if (!fechaMax || fecha > fechaMax) fechaMax = fecha;

                const esEnviado = m.bandeja === "Enviados";
                if (esEnviado) totalEnviados++;
                else totalRecibidos++;

                const sem = semanticoMap[m.id];

                // Extraer adjuntos
                if (Array.isArray(m.adjuntos)) {
                    for (const adj of m.adjuntos) {
                        totalAdjuntos++;
                        allAdjuntosToInsert.push({
                            tenantId,
                            cuentaId: cuenta.id,
                            mensajeId: m.id,
                            nombre: adj.nombre || "adjunto_sin_nombre",
                            categoria: adj.tipo || "Otros",
                            extension: adj.extension || "",
                            tamanoBytes: adj.tamano || 0,
                            rutaOriginal: normalizeRelativePath(adj.ruta_adjunto, baseDir),
                            rutaMd: normalizeRelativePath(adj.ruta_md, baseDir),
                        });
                    }
                }

                let fechaLimite: Date | null = null;
                if (sem?.fecha_limite?.detectada && sem.fecha_limite.fecha) {
                    const parsed = new Date(sem.fecha_limite.fecha);
                    if (!isNaN(parsed.getTime())) fechaLimite = parsed;
                }

                return {
                    id: m.id,
                    tenantId,
                    cuentaId: cuenta.id,
                    hiloId: m.hilo_id || null,
                    bandeja: m.bandeja || "BandejaEntrada",
                    esEnviado,
                    fechaMensaje: fecha,
                    remitenteNombre: m.from?.name || null,
                    remitenteEmail: m.from?.email || null,
                    destinatariosJson: m.to || [],
                    conCopiaJson: m.cc || [],
                    asunto: m.subject || "(Sin Asunto)",
                    asuntoNormalizado: m.asunto_normalizado || null,
                    categoriaTematica: m.categoria_tematica || null,
                    rutaMd: normalizeRelativePath(m.ruta_md, baseDir),
                    bodyHash: m.body_hash || null,
                    tamanoCuerpoChars: m.tamano_cuerpo_chars || 0,
                    tieneAdjuntos: (m.adjuntos?.length > 0) || false,
                    numAdjuntos: m.num_adjuntos || m.adjuntos?.length || 0,
                    tieneSenalesPlazo: m.tiene_senales_plazo || false,
                    esDuplicado: m.es_duplicado || false,
                    duplicadoDeId: m.duplicado_de || null,
                    estadoAnalisis: sem ? "ANALIZADO_SEMANTICO" : "METADATOS_CARGADOS",
                    resumenIA: sem?.resumen || null,
                    clasificacionOrigen: sem?.clasificacion?.origen || null,
                    clasificacionTipo: sem?.clasificacion?.tipo || null,
                    clasificacionAccion: sem?.clasificacion?.accion_requerida || null,
                    fechaLimiteDetectada: fechaLimite,
                    prioridadIA: sem?.fecha_limite?.prioridad || (m.tiene_senales_plazo ? "ALTA" : "MEDIA"),
                    entidadesJson: sem?.entidades || null,
                };
            });

            await prisma.emailMessage.createMany({
                data: messagesToInsert,
                skipDuplicates: true,
            });
        }
        console.log(`[INGESTOR] ${messages.length} mensajes insertados/actualizados.`);

        // 5. Ingestar Adjuntos en chunks
        console.log(`[INGESTOR] Insertando ${allAdjuntosToInsert.length} adjuntos...`);
        for (let i = 0; i < allAdjuntosToInsert.length; i += CHUNK_SIZE) {
            const chunk = allAdjuntosToInsert.slice(i, i + CHUNK_SIZE);
            await prisma.emailAttachment.createMany({
                data: chunk,
                skipDuplicates: true,
            });
        }
        console.log(`[INGESTOR] ${allAdjuntosToInsert.length} adjuntos insertados/actualizados.`);

        // 6. Actualizar CuentaAuditoria con totales y fechas
        await prisma.cuentaAuditoria.update({
            where: { id: cuenta.id },
            data: {
                totalMensajes: messages.length,
                totalRecibidos,
                totalEnviados,
                totalHilos: hilosCount,
                totalAdjuntos,
                fechaInicioCorpus: fechaMin,
                fechaFinCorpus: fechaMax,
                estadoIngestion: "INGESTADO",
                ultimaIngestion: new Date(),
            },
        });

        // 7. Completar SyncState
        const duracionSegundos = Math.round((Date.now() - inicio) / 1000);
        await prisma.syncState.update({
            where: { id: syncState.id },
            data: {
                estado: "COMPLETADO",
                mensajesIngestados: messages.length,
                mensajesAnalizados: Object.keys(semanticoMap).length,
                finalizadoEn: new Date(),
            },
        });

        return {
            success: true,
            totalHilos: hilosCount,
            totalMensajes: messages.length,
            totalRecibidos,
            totalEnviados,
            totalAdjuntos,
            duracionSegundos,
        };
    } catch (err: any) {
        console.error("[INGESTOR] Error en ingesta local:", err);
        await prisma.syncState.update({
            where: { id: syncState.id },
            data: {
                estado: "ERROR",
                errorMensaje: err?.message || String(err),
                finalizadoEn: new Date(),
            },
        });
        await prisma.cuentaAuditoria.update({
            where: { id: cuenta.id },
            data: { estadoIngestion: "ERROR" },
        });
        throw err;
    }
}
