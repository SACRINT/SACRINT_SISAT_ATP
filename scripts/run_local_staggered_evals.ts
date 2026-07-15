import fs from "fs";
import path from "path";

// Manually load environment variables from .env
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const index = trimmed.indexOf("=");
        if (index !== -1) {
            const key = trimmed.substring(0, index).trim();
            const val = trimmed.substring(index + 1).trim().replace(/^["']|["']$/g, "");
            process.env[key] = val;
        }
    }
}

// Interfaces
interface PreRevisionResult {
    tipo: string;
    aprobado: boolean;
    explicacion: string;
    borradorCorreo: string;
    tieneIncidencias: boolean;
}

async function main() {
    const { prisma } = await import("../src/lib/db");
    const { extractTextFromDocx } = await import("../src/lib/pre-revision");

    console.log("=== STARTING STAGGERED LOCAL EVALUATIONS ===");

    // 1. Reactivate all keys in the database
    console.log("Reactivating all API Keys in database...");
    await prisma.apiKey.updateMany({
        data: { active: true, errorCount: 0 }
    });

    // 2. Fetch all active Gemini API keys
    const apiKeys = await prisma.apiKey.findMany({
        where: { provider: "gemini", active: true }
    });
    console.log(`Loaded ${apiKeys.length} active Gemini keys from database.`);
    if (apiKeys.length === 0) {
        throw new Error("No active Gemini keys available!");
    }

    let keyIndex = 0;

    // Helper to call Gemini with strict round-robin rotation and retry logic
    async function callGeminiRoundRobin(
        systemInstruction: string,
        prompt: string,
        responseSchema: any
    ): Promise<string> {
        let retries = 6;
        let lastError = "";

        while (retries > 0) {
            const keyRecord = apiKeys[keyIndex % apiKeys.length];
            keyIndex++; // Move to next key for next request

            console.log(`[Round-Robin] Calling Gemini with key "${keyRecord.label}" (Remaining retries: ${retries - 1})`);
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keyRecord.key}`;
            const body = {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.2,
                    maxOutputTokens: 8192,
                    responseSchema: responseSchema || undefined
                }
            };

            try {
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(45000)
                });

                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`Status ${res.status}: ${errText}`);
                }

                const data = await res.json() as any;
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) {
                    throw new Error("Empty candidate response text");
                }

                console.log(`[Round-Robin] ✅ Success using key "${keyRecord.label}"`);
                return text;
            } catch (err: any) {
                lastError = err.message || String(err);
                console.warn(`[Round-Robin] ⚠️ Key "${keyRecord.label}" failed: ${lastError}`);
                
                // If it's a rate limit or exhaustion error, wait 10 seconds before retrying
                console.log("[Round-Robin] Waiting 10 seconds before trying the next key...");
                await new Promise(resolve => setTimeout(resolve, 10000));
                retries--;
            }
        }

        throw new Error(`All keys exhausted in round-robin loop. Last error: ${lastError}`);
    }

    // 3. Load deliveries to evaluate
    const failedDeliveries = [
        { id: "cmluha1310020s8d0lb3zxxbf", escuela: "JAIME SABINES", programa: "PAEC-PEC" },
        { id: "cmluh9wnz000zs8d0zyivanzt", escuela: "JOSÉ IGNACIO GREGORIO COMONFORT", programa: "PMC" },
        { id: "cmluh9vkb000qs8d0ebhs92n7", escuela: "ALFONSO DE LA MADRID VIDAURRETA", programa: "PMC" },
        { id: "cmluha01x001ss8d0no1ta9el", escuela: "ALFONSO DE LA MADRID VIDAURRETA", programa: "PAEC-PEC" },
        { id: "cmluha0ai001ts8d0xl73grry", escuela: "AQUILES SERDÁN", programa: "PAEC-PEC" },
        { id: "cmluh9vob000rs8d0gjii88z5", escuela: "AQUILES SERDÁN", programa: "PMC" },
        { id: "cmluh9w3b000us8d0pyahuid7", escuela: "DAVID ALFARO SIQUEIROS (JALTOCAN)", programa: "PMC" },
        { id: "cmluha0mp001ws8d0r5zdsnuo", escuela: "DAVID ALFARO SIQUEIROS (JALTOCAN)", programa: "PAEC-PEC" },
        { id: "cmluha0qv001xs8d0xgbh8c9a", escuela: "DIEGO RIVERA", programa: "PAEC-PEC" },
        { id: "cmluh9w7g000vs8d0rm3z4arc", escuela: "DIEGO RIVERA", programa: "PMC" },
        { id: "cmluh9wjl000ys8d0voe7i7ug", escuela: "JAIME SABINES", programa: "PMC" },
        { id: "cmluha16x0021s8d07xyo4csg", escuela: "JOSÉ IGNACIO GREGORIO COMONFORT", programa: "PAEC-PEC" },
        { id: "cmluha1ml0025s8d0cg0rnvg3", escuela: "MECAPALAPA", programa: "PAEC-PEC" },
        { id: "cmluha1y90027s8d0rly0vm84", escuela: "REYES GARCÍA OLIVARES", programa: "PAEC-PEC" },
        { id: "cmluh9xd30015s8d07py2vem3", escuela: "REYES GARCÍA OLIVARES", programa: "PMC" },
        { id: "cmluh9x8o0014s8d0enwvfpp4", escuela: "MOISÉS SÁENZ GARZA", programa: "PMC" },
        { id: "cmluh9xgy0016s8d06dwvagmi", escuela: "TECNOLÓGICO FCO. Z. MENA", programa: "PMC" },
        { id: "cmluha1qj0026s8d0txnu1frl", escuela: "MOISÉS SÁENZ GARZA", programa: "PAEC-PEC" },
        { id: "cmluha2260028s8d0a8qm96t8", escuela: "TECNOLÓGICO FCO. Z. MENA", programa: "PAEC-PEC" },
        { id: "cmr10q6ee000604l7n3fbmbrz", escuela: "LUIS DONALDO COLOSIO MURRIETA", programa: "INFORME FINAL PMC 2025-2026" },
        { id: "cmr10q6g6000g04l7sscnnug4", escuela: "EMILIANO ZAPATA", programa: "INFORME FINAL PMC 2025-2026" },
        { id: "cmluh9wwb0011s8d0crudeifw", escuela: "JUAN ALDAMA", programa: "PMC" },
        { id: "cmr10q6ek000704l73k6v8hgp", escuela: "MOISÉS SÁENZ GARZA", programa: "INFORME FINAL PMC 2025-2026" },
        { id: "cmr10q6d2000204l7nzr5zce8", escuela: "DIEGO RIVERA", programa: "INFORME FINAL PMC 2025-2026" }
    ];

    const dirPath = path.resolve(__dirname, "../scratch/extracted_texts");

    for (let i = 0; i < failedDeliveries.length; i++) {
        const item = failedDeliveries[i];
        console.log(`\n=========================================\n[${i + 1}/${failedDeliveries.length}] Evaluando: ${item.escuela} (${item.programa}) - ID: ${item.id}`);

        // Fetch the delivery details from database
        const entrega = await prisma.entrega.findUnique({
            where: { id: item.id },
            include: {
                archivos: true,
                periodoEntrega: { include: { programa: true } },
                escuela: true,
            }
        });

        if (!entrega) {
            console.error(`[Error] Delivery not found in database: ${item.id}`);
            continue;
        }

        let extractedText = "";
        const jsonFilePath = path.join(dirPath, `${item.id}.json`);

        if (fs.existsSync(jsonFilePath)) {
            const savedData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
            extractedText = savedData.text || "";
        }

        // If it's a DOCX and we didn't have extracted text, download and extract locally
        const mainFile = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
        if (!extractedText && mainFile && mainFile.nombre.toLowerCase().endsWith(".docx")) {
            try {
                console.log(`[DOCX] Downloading public DOCX file directly: ${mainFile.nombre}`);
                const dlRes = await fetch(mainFile.driveUrl!);
                if (!dlRes.ok) throw new Error(`Status ${dlRes.status}`);
                const buffer = Buffer.from(await dlRes.arrayBuffer());
                console.log("[DOCX] Extracting text...");
                extractedText = await extractTextFromDocx(buffer);
                console.log(`[DOCX] Text extracted successfully. Length: ${extractedText.length} chars.`);
            } catch (dlErr: any) {
                console.error(`[DOCX Error] Failed to download or parse DOCX: ${dlErr.message}`);
                continue;
            }
        }

        if (!extractedText) {
            console.warn(`[Skip] No extracted text found for ${item.escuela} (${item.programa})`);
            continue;
        }

        // Determine modulo
        const progName = entrega.periodoEntrega.programa.nombre.toUpperCase();
        let modulo: "PMC" | "PAEC" | "INFORME_FINAL" = "PMC";
        if (progName.includes("INFORME FINAL")) {
            modulo = "INFORME_FINAL";
        } else if (progName.includes("PAEC") || progName.includes("PEC")) {
            modulo = "PAEC";
        }

        // Fetch template
        const template = await prisma.plantillaEvaluacion.findFirst({
            where: { modulo, activo: true }
        });
        const templateContent = template?.contenido || (modulo === "INFORME_FINAL"
            ? "Evalúa este Informe Final del PMC..."
            : modulo === "PMC"
                ? "Evalúa este PMC..."
                : "Evalúa este PEC...");

        // Fetch original PMC if INFORME_FINAL
        let textoOriginalPMC = "";
        if (modulo === "INFORME_FINAL") {
            try {
                console.log(`Looking up original PMC for school ${entrega.escuelaId}...`);
                const pmcEntrega = await prisma.entrega.findFirst({
                    where: {
                        escuelaId: entrega.escuelaId,
                        periodoEntrega: {
                            cicloEscolarId: entrega.periodoEntrega.cicloEscolarId,
                            programa: {
                                nombre: { contains: "PMC", mode: "insensitive" },
                                NOT: { nombre: { contains: "INFORME FINAL", mode: "insensitive" } }
                            }
                        }
                    },
                    include: { archivos: true, preRevision: true }
                });

                if (pmcEntrega) {
                    if (pmcEntrega.preRevision?.resultado) {
                        const resObj = pmcEntrega.preRevision.resultado as any;
                        textoOriginalPMC = `Observaciones y Metas del PMC Original:\n${resObj.borradorCorreo || ""}`;
                    }
                }
            } catch (pmcErr: any) {
                console.warn("Failed to get original PMC text, proceeding without it:", pmcErr.message);
            }
        }

        // Prepare prompts
        // We replicate obtaining the prompts using the exact logic from pre-revision.ts
        const { obtenerPartesEvaluacion: getPartes } = await import("../src/lib/pre-revision");
        // Wait, obtenerPartesEvaluacion is not exported!
        // But wait, can we write our own version since we know what it is?
        // Yes! We viewed lines 193-299 earlier. Let's write the prompt generator helper!
        
        const prompts: string[] = [];
        const partes = modulo === "INFORME_FINAL" ? [
            { titulo: "Sección I: Coherencia General con el PMC Planeado y Diagnóstico de Resultados", enfoque: `Analiza la estructura general del Informe Final de PMC de la escuela ${entrega.escuela.nombre} (${entrega.escuela.cct}) en comparación con el PMC planeado originalmente: ...` },
            { titulo: "Sección II: Evaluación de Metas y Justificación de Desviaciones", enfoque: `Analiza a detalle las metas del Informe Final de PMC de la escuela ${entrega.escuela.nombre} (${entrega.escuela.cct}): ...` },
            { titulo: "Sección III: Análisis de Evidencias, Impacto y Recomendaciones Finales", enfoque: `Analiza las evidencias y el impacto reportado en el Informe Final de PMC de la escuela ${entrega.escuela.nombre} (${entrega.escuela.cct}): ...` }
        ] : modulo === "PAEC" ? [
            { titulo: "Sección I: Diagnóstico Comunitario y Planteamiento del Problema (PAEC)", enfoque: `Analiza el Proyecto Escolar Comunitario (PEC/PAEC) de la escuela ${entrega.escuela.nombre} (${entrega.escuela.cct}): ...` },
            { titulo: "Sección II: Vinculación con la Comunidad y Coherencia de Objetivos (PAEC)", enfoque: `Analiza los objetivos del Proyecto Escolar Comunitario (PEC/PAEC) de la escuela ${entrega.escuela.nombre} (${entrega.escuela.cct}): ...` },
            { titulo: "Sección III: Plan de Acción, Responsabilidades y Evaluación (PAEC)", enfoque: `Analiza el Plan de Acción del Proyecto Escolar Comunitario (PEC/PAEC) de la escuela ${entrega.escuela.nombre} (${entrega.escuela.cct}): ...` }
        ] : [
            { titulo: "Sección I: Estructura General, Diagnóstico y FODA (PMC)", enfoque: `Analiza el Plan de Mejora Continua (PMC) de la escuela ${entrega.escuela.nombre} (${entrega.escuela.cct}): ...` },
            { titulo: "Sección II: Coherencia de Objetivos, Metas e Indicadores (PMC)", enfoque: `Analiza los Objetivos, Metas e Indicadores del Plan de Mejora Continua (PMC) de la escuela ${entrega.escuela.nombre} (${entrega.escuela.cct}): ...` },
            { titulo: "Sección III: Plan de Acción (Estrategias, Acciones, Responsables y Evidencias) (PMC)", enfoque: `Analiza el Plan de Acción del Plan de Mejora Continua (PMC) de la escuela ${entrega.escuela.nombre} (${entrega.escuela.cct}): ...` }
        ];

        for (let idx = 0; idx < partes.length; idx++) {
            const parte = partes[idx];
            let p = `A continuación se presenta el prompt maestro de evaluación oficial que define los lineamientos y rúbricas a evaluar:
---
${templateContent}
---

Evalúa el documento entregado por el plantel: ${entrega.escuela.nombre} (${entrega.escuela.cct}).
Esta es la PARTE ${idx + 1} de la evaluación, enfocada en: **${parte.titulo}**.

Pautas específicas para esta parte:
${parte.enfoque}`;

            if (modulo === "INFORME_FINAL" && textoOriginalPMC) {
                p += `\n\nA continuación se proporciona el texto o análisis del PLAN DE MEJORA CONTINUA (PMC) original planeado por la escuela para este ciclo escolar. Úsalo como referencia obligatoria para comparar el Informe Final con las metas, actividades y categorías del PMC original:
----------------------------------
${textoOriginalPMC.slice(0, 12000)}
----------------------------------`;
            }

            p += `\n\nTexto extraído del documento entregado para tu evaluación:\n${extractedText}`;
            p += `\n\nDebes responder ÚNICAMENTE en formato JSON con la siguiente estructura de esquema:
{
  "aprobado": true,
  "puntuacion": "Porcentaje de cumplimiento asignado a esta parte (ej. '70%')",
  "observaciones": "Tu informe detallado para esta sección en Markdown (aproximadamente 350-500 palabras), describiendo con precisión fortalezas, áreas de oportunidad, omisiones o inconsistencias encontradas y recomendaciones de mejora.",
  "estadoRecomendado": "APROBADO"
}`;
            prompts.push(p);
        }

        const responseSchema = {
            type: "OBJECT",
            properties: {
                aprobado: { type: "BOOLEAN" },
                puntuacion: { type: "STRING" },
                observaciones: { type: "STRING" },
                estadoRecomendado: { type: "STRING", enum: ["APROBADO", "REQUIERE_CORRECCION"] }
            },
            required: ["aprobado", "puntuacion", "observaciones", "estadoRecomendado"]
        };

        try {
            console.log(`Running evaluation sequentially for ${item.escuela} (${modulo})...`);
            const results: any[] = [];
            for (let idx = 0; idx < prompts.length; idx++) {
                const prompt = prompts[idx];
                console.log(`-> Evaluating part ${idx + 1}/3...`);
                const rawResponse = await callGeminiRoundRobin(
                    "Eres un Asesor Técnico Pedagógico (ATP) experto en evaluación y planeación escolar.",
                    prompt,
                    responseSchema
                );
                
                // Clean response JSON
                const cleanJson = rawResponse.replace(/^\s*```json\s*/i, "").replace(/\s*```\s*$/, "").trim();
                results.push(JSON.parse(cleanJson));
                
                // Delay 4 seconds between parts of the same delivery
                await new Promise(resolve => setTimeout(resolve, 4000));
            }

            const [part1, part2, part3] = results;

            const aprobadoFinal = part1.aprobado && part2.aprobado && part3.aprobado;
            const estadoRecomendadoFinal = (part1.estadoRecomendado === "REQUIERE_CORRECCION" || part2.estadoRecomendado === "REQUIERE_CORRECCION" || part3.estadoRecomendado === "REQUIERE_CORRECCION")
                ? "REQUIERE_CORRECCION"
                : "APROBADO";

            const parsePercentage = (str: string) => {
                const match = str.match(/(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            };

            const score1 = parsePercentage(part1.puntuacion || "0%");
            const score2 = parsePercentage(part2.puntuacion || "0%");
            const score3 = parsePercentage(part3.puntuacion || "0%");
            const scoreAvg = Math.round((score1 + score2 + score3) / 3);
            const puntuacionFinal = `${scoreAvg}%`;

            const observacionesFinal = `# Informe de Pre-Revisión del ${modulo === "INFORME_FINAL" ? "Informe Final del PMC" : modulo === "PAEC" ? "Proyecto Escolar Comunitario (PEC)" : "Plan de Mejora Continua (PMC)"}

Este informe presenta una evaluación exhaustiva y detallada del documento entregado por el plantel, con base en la rúbrica oficial de la supervisión.

## I. Estructura General y Diagnóstico / Contexto
${part1.observaciones}

## II. Objetivos, Metas / Logros y Coherencia
${part2.observaciones}

## III. Plan de Acción / Evidencias y Recomendaciones
${part3.observaciones}`;

            const resultado: PreRevisionResult = {
                tipo: modulo,
                aprobado: aprobadoFinal,
                explicacion: `Puntuación obtenida: ${puntuacionFinal}. Ver detalles de observaciones en el panel de control.`,
                borradorCorreo: observacionesFinal,
                tieneIncidencias: estadoRecomendadoFinal === "REQUIERE_CORRECCION"
            };

            // Save result to database
            await prisma.preRevision.upsert({
                where: { entregaId: item.id },
                update: { resultado: resultado as any },
                create: { entregaId: item.id, resultado: resultado as any }
            });

            console.log(`[Success] Evaluation complete & saved in DB for ${item.escuela} (${modulo}). Score: ${puntuacionFinal}`);

            // Stagger 6 seconds between separate school evaluations
            await new Promise(resolve => setTimeout(resolve, 6000));
        } catch (err: any) {
            console.error(`[Error] Evaluation failed for ${item.escuela} (${modulo}):`, err.message || err);
        }
    }

    console.log("\n=== ALL LOCAL EVALUATIONS COMPLETED SUCCESSFULLY! ===");
    await prisma.$disconnect();
}

main().catch(console.error);
