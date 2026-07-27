import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { callGemini } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── Sistema de instrucciones para la IA ─────────────────────────────────────
const SYSTEM_INSTRUCTION = `Eres un Asesor Técnico Pedagógico (ATP) experto en redacción de informes
oficiales de supervisión escolar en México. Redactas informes formales de cumplimiento de
documentación de fin de ciclo escolar dirigidos al Supervisor Escolar.

REGLA CRÍTICA — Debes distinguir con claridad absoluta estos dos tipos de situación:

TIPO A — ENTREGÓ PERO NO ATENDIÓ CORRECCIONES (estado: REQUIERE_CORRECCION):
  • La escuela SÍ presentó el documento ante la supervisión.
  • El ATP señaló correcciones, pero el director NO las ha realizado.
  • Severidad: MODERADA — entregó, pero el expediente quedó con observaciones sin subsanar.
  • Redacción: "presentó el documento, sin embargo las correcciones indicadas por el ATP no han
    sido atendidas", "realizó la entrega pero no subsanó las observaciones señaladas",
    "el documento fue recibido con observaciones que permanecen pendientes".

TIPO B — NUNCA ENTREGÓ (estado: PENDIENTE, NO_ENTREGADO, NO_APROBADO):
  • La escuela NUNCA presentó el documento. Incumplimiento total en ese documento.
  • Severidad: GRAVE — el plantel no cumplió con su obligación de entrega.
  • Redacción: "no fue presentado en ningún momento", "el plantel adeuda completamente este
    documento", "incumplimiento total", "no realizó entrega alguna ante la supervisión".

ESTAS DOS SITUACIONES NO SON EQUIVALENTES:
  - TIPO A (entregó pero no corrigió) = menor gravedad → lenguaje de observación
  - TIPO B (nunca entregó) = mayor gravedad → lenguaje de penalización explícita

Escribe en español formal, tercera persona, estilo de informe oficial de supervisión escolar.
Cada narrativa debe tener entre 3 y 5 oraciones, concisas, directas y sin ambigüedades.
No uses emojis ni símbolos especiales. Responde ÚNICAMENTE en formato JSON según el esquema.`;

// ─── Esquema de respuesta JSON para Gemini ────────────────────────────────────
const AI_RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
        narrativaPorEscuela: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    cct: { type: "STRING" },
                    narrativa: { type: "STRING" }
                },
                required: ["cct", "narrativa"]
            }
        },
        observacionesGenerales: { type: "STRING" },
        conclusion: { type: "STRING" }
    },
    required: ["narrativaPorEscuela", "observacionesGenerales", "conclusion"]
};

// ─── GET — Genera el reporte completo con IA ──────────────────────────────────
export async function GET() {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!session || !["admin", "supervision", "atp"].includes(role)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        // 1. Ciclo activo + configuración de autoridades
        const [cicloActivo, autoridades] = await Promise.all([
            prisma.cicloEscolar.findFirst({ where: { activo: true } }),
            prisma.autoridadesConfig.findUnique({ where: { id: "singleton" } }).catch(() => null),
        ]);

        if (!cicloActivo) {
            return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 400 });
        }

        // 2. Consultar todas las escuelas con detalle completo de entregas
        const escuelas = await prisma.escuela.findMany({
            where: { esDePrueba: false, esSupervision: false },
            include: {
                entregas: {
                    where: {
                        periodoEntrega: { cicloEscolarId: cicloActivo.id }
                    },
                    include: {
                        periodoEntrega: {
                            include: { programa: true }
                        },
                        correcciones: {
                            orderBy: { createdAt: "desc" },
                            take: 1
                        }
                    }
                }
            }
        });

        // 3. Procesar y clasificar cada escuela
        const escuelasData = escuelas.map((esc: any) => {
            const entregas: any[] = esc.entregas || [];
            const entregasRequeridas = entregas.filter((e: any) => e.estado !== "EXENTO");
            const totalRequeridas = entregasRequeridas.length;

            const aprobadas = entregasRequeridas.filter((e: any) =>
                ["APROBADO", "ENTREGADO_FISICO"].includes(e.estado)
            );
            const enRevision = entregasRequeridas.filter((e: any) => e.estado === "EN_REVISION");
            // TIPO A: entregó pero el director no atendió las correcciones
            const conCorreccionesPendientes = entregasRequeridas.filter((e: any) =>
                e.estado === "REQUIERE_CORRECCION"
            );
            // TIPO B: nunca entregó nada — incumplimiento total
            const noEntregados = entregasRequeridas.filter((e: any) =>
                ["PENDIENTE", "NO_ENTREGADO", "NO_APROBADO"].includes(e.estado)
            );

            // Puntualidad: ¿todas las aprobadas fueron en tiempo?
            const todasATiempo =
                aprobadas.length === totalRequeridas &&
                totalRequeridas > 0 &&
                aprobadas.every((e: any) => {
                    if (!e.fechaSubida || !e.periodoEntrega?.fechaLimite) return false;
                    const limite = new Date(e.periodoEntrega.fechaLimite);
                    limite.setHours(23, 59, 59, 999);
                    return new Date(e.fechaSubida) <= limite;
                });

            const cumplimiento = totalRequeridas > 0 ? (aprobadas.length / totalRequeridas) * 100 : 100;

            let medalla = "NINGUNA";
            if (cumplimiento === 100 && todasATiempo) medalla = "ORO";
            else if (cumplimiento === 100) medalla = "PLATA";
            else if (cumplimiento >= 80) medalla = "BRONCE";

            return {
                cct: esc.cct,
                nombre: esc.nombre,
                director: esc.director || "Sin director registrado",
                medalla,
                cumplimiento: Math.round(cumplimiento * 10) / 10,
                totalRequeridas,
                totalAprobadas: aprobadas.length,
                totalEnRevision: enRevision.length,
                totalCorreccionesPendientes: conCorreccionesPendientes.length,
                totalNoEntregados: noEntregados.length,
                entregaFueraDeTiempo: cumplimiento === 100 && !todasATiempo,
                docsAprobados: aprobadas.map((e: any) => e.periodoEntrega?.programa?.nombre ?? "—"),
                docsEnRevision: enRevision.map((e: any) => e.periodoEntrega?.programa?.nombre ?? "—"),
                // TIPO A: entregaron pero no corrigieron
                docsConCorreccionesPendientes: conCorreccionesPendientes.map((e: any) => ({
                    programa: e.periodoEntrega?.programa?.nombre ?? "—",
                    observaciones: e.correcciones?.[0]?.texto ?? null
                })),
                // TIPO B: nunca entregaron
                docsNoEntregados: noEntregados.map((e: any) => ({
                    programa: e.periodoEntrega?.programa?.nombre ?? "—",
                    estado: e.estado
                }))
            };
        });

        // 4. Ordenar: ORO > PLATA > BRONCE > NINGUNA; empate → menos NO_ENTREGADOS primero; luego menos CORRECCIONES
        const medallaOrder: Record<string, number> = { ORO: 4, PLATA: 3, BRONCE: 2, NINGUNA: 1 };
        escuelasData.sort((a: any, b: any) => {
            if (medallaOrder[a.medalla] !== medallaOrder[b.medalla])
                return medallaOrder[b.medalla] - medallaOrder[a.medalla];
            if (b.cumplimiento !== a.cumplimiento) return b.cumplimiento - a.cumplimiento;
            // Mismo cumplimiento: menos NO_ENTREGADOS = mejor posición
            if (a.totalNoEntregados !== b.totalNoEntregados)
                return a.totalNoEntregados - b.totalNoEntregados;
            // Mismo NO_ENTREGADOS: menos correcciones pendientes = mejor posición
            if (a.totalCorreccionesPendientes !== b.totalCorreccionesPendientes)
                return a.totalCorreccionesPendientes - b.totalCorreccionesPendientes;
            return a.nombre.localeCompare(b.nombre);
        });

        // 5. Resumen estadístico
        const resumen = {
            total: escuelasData.length,
            conOro: escuelasData.filter((e: any) => e.medalla === "ORO").length,
            conPlata: escuelasData.filter((e: any) => e.medalla === "PLATA").length,
            conBronce: escuelasData.filter((e: any) => e.medalla === "BRONCE").length,
            sinMedalla: escuelasData.filter((e: any) => e.medalla === "NINGUNA").length,
            conCorreccionesPendientes: escuelasData.filter((e: any) => e.totalCorreccionesPendientes > 0).length,
            conDocsNoEntregados: escuelasData.filter((e: any) => e.totalNoEntregados > 0).length,
            ningunoATiempo: escuelasData.every((e: any) => e.medalla !== "ORO"),
            promedioZona: escuelasData.length > 0
                ? Math.round((escuelasData.reduce((s: number, e: any) => s + e.cumplimiento, 0) / escuelasData.length) * 10) / 10
                : 0
        };

        // 6. Construir el prompt para la IA
        const promptLines: string[] = [
            `Ciclo Escolar: ${cicloActivo.nombre}`,
            `Fecha: ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}`,
            `Total de escuelas en la zona: ${escuelasData.length}`,
            `Promedio de cumplimiento de la zona: ${resumen.promedioZona}%`,
            "",
            "=== DATOS DETALLADOS POR ESCUELA ===",
            ""
        ];

        for (const esc of escuelasData) {
            promptLines.push(`───────────────────────────────────────────`);
            promptLines.push(`ESCUELA: ${esc.nombre}`);
            promptLines.push(`CCT: ${esc.cct} | Director(a): ${esc.director}`);
            promptLines.push(`Medalla: ${esc.medalla} | Cumplimiento: ${esc.cumplimiento}% (${esc.totalAprobadas} de ${esc.totalRequeridas} documentos aprobados)`);

            if (esc.medalla === "ORO") {
                promptLines.push(`→ Cumplió al 100% EN TIEMPO Y FORMA. Reconocimiento al director(a).`);
            } else if (esc.medalla === "PLATA") {
                promptLines.push(`→ Cumplió al 100% pero FUERA DEL PLAZO oficial.`);
            }

            if (esc.docsConCorreccionesPendientes && esc.docsConCorreccionesPendientes.length > 0) {
                promptLines.push(`--- TIPO A: ENTREGÓ PERO NO ATENDIÓ CORRECCIONES (${esc.docsConCorreccionesPendientes.length} documento(s)) ---`);
                for (const doc of esc.docsConCorreccionesPendientes) {
                    const obs = doc.observaciones ? ` | Observación ATP: "${doc.observaciones}"` : "";
                    promptLines.push(`   * ${doc.programa}${obs}`);
                }
            }

            if (esc.docsNoEntregados && esc.docsNoEntregados.length > 0) {
                promptLines.push(`--- TIPO B: NUNCA ENTREGÓ — INCUMPLIMIENTO TOTAL (${esc.docsNoEntregados.length} documento(s)) ---`);
                for (const doc of esc.docsNoEntregados) {
                    promptLines.push(`   * ${doc.programa} [${doc.estado}] ← NO presentado en ningún momento`);
                }
            }

            if (esc.totalEnRevision > 0) {
                promptLines.push(`--- EN REVISIÓN (pendiente de dictamen): ${esc.docsEnRevision.join(", ")} ---`);
            }

            promptLines.push("");
        }

        promptLines.push("=== INSTRUCCIONES PARA REDACTAR LA NARRATIVA ===");
        promptLines.push("Para CADA escuela genera una narrativa de 3-5 oraciones formales que:");
        promptLines.push("- ORO: reconozca el cumplimiento total y puntual del director(a)");
        promptLines.push("- PLATA: reconozca el 100% de entrega, pero señale la impuntualidad");
        promptLines.push("- BRONCE/NINGUNA con TIPO A: indique que entregó pero NO atendió correcciones (lenguaje moderado)");
        promptLines.push("- BRONCE/NINGUNA con TIPO B: penalice claramente los documentos NUNCA entregados (lenguaje de gravedad)");
        promptLines.push("- Si hay AMBOS tipos A y B: diferencíalos EXPLÍCITAMENTE en la narrativa con distinta severidad");
        promptLines.push("- Menciona el nombre del/la director(a) y el nombre específico de los documentos involucrados");
        promptLines.push("- TIPO B usa: 'no presentó en ningún momento', 'incumplimiento total en', 'el plantel adeuda'");
        promptLines.push("- TIPO A usa: 'entregó el documento pero no subsanó las correcciones señaladas'");
        promptLines.push("");
        promptLines.push("observacionesGenerales: redacta 4-6 observaciones relevantes de la zona (formato párrafo, no lista)");
        promptLines.push("conclusion: párrafo formal de conclusión del informe al Supervisor Escolar");

        const prompt = promptLines.join("\n");

        // 7. Llamada a la IA
        let aiResult: {
            narrativaPorEscuela: { cct: string; narrativa: string }[];
            observacionesGenerales: string;
            conclusion: string;
        } | null = null;

        try {
            const aiResponse = await callGemini(
                SYSTEM_INSTRUCTION,
                prompt,
                undefined,
                "text/plain",
                AI_RESPONSE_SCHEMA,
                false
            );
            const parsed = JSON.parse(aiResponse);
            if (parsed.narrativaPorEscuela && parsed.observacionesGenerales && parsed.conclusion) {
                aiResult = parsed;
            }
        } catch (aiErr) {
            console.error("[reporte-cumplimiento] Fallo IA, usando narrativas de respaldo:", aiErr);
        }

        // 8. Narrativas de respaldo si la IA falló
        if (!aiResult) {
            aiResult = {
                narrativaPorEscuela: escuelasData.map((esc: any) => ({
                    cct: esc.cct,
                    narrativa: generarNarrativaFallback(esc)
                })),
                observacionesGenerales: `Durante el ciclo escolar ${cicloActivo.nombre}, la Zona Escolar 004 registró un cumplimiento promedio del ${resumen.promedioZona}%. Se identificaron escuelas con distintos niveles de cumplimiento, observándose casos de documentos no presentados y correcciones sin atender. Se exhorta a los directivos a regularizar su situación documentaria a la brevedad posible.`,
                conclusion: `El presente informe expone el estado documentario de los ${resumen.total} planteles de la Zona 004 al cierre del ciclo escolar ${cicloActivo.nombre}. El supervisor escolar deberá dar seguimiento prioritario a los centros de trabajo con adeudo documentario para garantizar la regularización total de la zona.`
            };
        }

        // 9. Respuesta final
        return NextResponse.json({
            cicloNombre: cicloActivo.nombre,
            fechaGeneracion: new Date().toISOString(),
            supervisor: autoridades?.supervisor ?? "SUPERVISOR ESCOLAR",
            atpNombre: autoridades?.atp1Nombre ?? "ASESOR TÉCNICO PEDAGÓGICO",
            escuelas: escuelasData,
            narrativaPorEscuela: aiResult.narrativaPorEscuela,
            observacionesGenerales: aiResult.observacionesGenerales,
            conclusion: aiResult.conclusion,
            resumen
        });

    } catch (error: any) {
        console.error("[reporte-cumplimiento] Error general:", error);
        return NextResponse.json(
            { error: error.message || "Error al generar el reporte" },
            { status: 500 }
        );
    }
}

// ─── Narrativa de respaldo (sin IA) ───────────────────────────────────────────
function generarNarrativaFallback(esc: any): string {
    if (esc.medalla === "ORO") {
        return `El plantel "${esc.nombre}", a cargo del(la) director(a) ${esc.director}, cumplió con la entrega total de los ${esc.totalAprobadas} documentos requeridos para el cierre del ciclo escolar, haciéndolo dentro del plazo oficial establecido. Su cumplimiento al 100% en tiempo y forma constituye un ejemplo de gestión documentaria oportuna y eficiente para la zona.`;
    }
    if (esc.medalla === "PLATA") {
        return `El plantel "${esc.nombre}", con el(la) director(a) ${esc.director}, completó la entrega de la totalidad de los ${esc.totalAprobadas} documentos requeridos (100% de cumplimiento). Sin embargo, dicha entrega fue realizada fuera del plazo oficial establecido por la supervisión, situación que se hace constar formalmente en el presente informe. No existen correcciones pendientes sobre la documentación recibida.`;
    }

    const partes: string[] = [];
    partes.push(`El plantel "${esc.nombre}", a cargo del(la) director(a) ${esc.director}, presentó ${esc.totalAprobadas} de los ${esc.totalRequeridas} documentos requeridos para el cierre del ciclo escolar, alcanzando un ${esc.cumplimiento}% de cumplimiento.`);

    if (esc.docsNoEntregados && esc.docsNoEntregados.length > 0) {
        const docs = esc.docsNoEntregados.map((d: any) => d.programa).join(", ");
        partes.push(`Se hace constar que los siguientes documentos NO fueron presentados en ningún momento ante la supervisión escolar, constituyendo un incumplimiento total en dichas obligaciones: ${docs}. Esta omisión representa una falta grave en la responsabilidad documentaria del plantel.`);
    }

    if (esc.docsConCorreccionesPendientes && esc.docsConCorreccionesPendientes.length > 0) {
        const docs = esc.docsConCorreccionesPendientes.map((d: any) => d.programa).join(", ");
        partes.push(`Adicionalmente, se realizaron observaciones de corrección sobre los documentos: ${docs}; sin embargo, las correcciones señaladas por el ATP no han sido atendidas a la fecha del presente informe. Si bien el plantel realizó la entrega de dichos documentos, la falta de atención a las correcciones indicadas mantiene su expediente en situación irregular.`);
    }

    partes.push(`Se exhorta al(la) director(a) a regularizar su situación documentaria a la brevedad posible.`);
    return partes.join(" ");
}
