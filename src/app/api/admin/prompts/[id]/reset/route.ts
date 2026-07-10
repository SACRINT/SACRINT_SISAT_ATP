import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

// Helper to extract text from a local DOCX file
async function extractTextFromDocxFile(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
    }
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    const docFile = zip.file("word/document.xml");
    if (!docFile) {
        throw new Error("No word/document.xml found in DOCX file");
    }
    const docXml = await docFile.async("string");
    const matches = docXml.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
    const text = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
    return text;
}

// POST: Restablecer una plantilla al valor original por defecto (leyendo el archivo Word)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;

        // Fetch current template
        const template = await prisma.plantillaEvaluacion.findUnique({
            where: { id }
        });

        if (!template) {
            return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
        }

        let defaultText = "";
        let defaultName = "";

        if (template.modulo === "PMC") {
            const docxPath = "C:\\NotebookLM\\sisat-atp\\ORIENTACIONES PMC 2025-2026\\PROMPT MAESTRO PARA EVALUAR PMC.docx";
            defaultText = await extractTextFromDocxFile(docxPath);
            defaultName = "Prompt Maestro para Evaluar PMC 2025-2026";
        } else if (template.modulo === "PAEC") {
            const docxPath = "C:\\NotebookLM\\sisat-atp\\DATOS PAEC-PEC\\PROMPT MAESTRO PARA PAEC 2025-2026 COMPLETO.docx";
            defaultText = await extractTextFromDocxFile(docxPath);
            defaultName = "Prompt Maestro para Evaluar PAEC 2025-2026";
        } else if (template.modulo === "INFORME_FINAL") {
            defaultText = `INSTRUCCIONES DE EVALUACIÓN DEL INFORME FINAL DEL PLAN DE MEJORA CONTINUA (PMC)
 
Eres un Asesor Técnico Pedagógico (ATP) experto en planeación y evaluación escolar. Evalúa el "Informe Final" entregado por el plantel educativo.
En este informe, el director y el colegiado docente deben reportar las evidencias del cumplimiento de las metas planeadas en su PMC original y presentar las justificaciones de aquellas metas que no se lograron cumplir.
 
CRITERIOS DE EVALUACIÓN:
1. **Evidencias de Cumplimiento:**
   - Verifica si el informe detalla de forma clara el porcentaje de logro obtenido para cada una de las metas planeadas en el PMC.
   - Evalúa si se describen o anexan las evidencias (documentos, estadísticas, registros, reportes) que demuestran el cumplimiento.
2. **Justificación de Metas No Alcanzadas:**
   - Comprueba si las metas no cumplidas cuentan con una justificación clara, detallada y coherente (factores de riesgo, ausentismo, fallas de infraestructura, etc.).
   - Evalúa si se proponen acciones remediales o de ajuste para el siguiente ciclo escolar.
3. **Estructura y Formalidad:**
   - El documento debe contar con las firmas y sellos oficiales de la dirección escolar en las páginas finales.
 
ESTRUCTURA DE RESPUESTA EN TU INFORME:
- **Valoración General:** Resumen formal y analítico del cierre de ciclo del plantel.
- **Fortalezas y Metas Cumplidas:** Lista de logros destacados y metas alcanzadas que cuentan con evidencia de impacto.
- **Justificaciones de Metas Pendientes:** Análisis de los argumentos presentados por la escuela sobre las metas no logradas, indicando si son válidos o carecen de sustento.
- **Ajustes y Cierre Administrativo:** Recomendaciones para la planeación del siguiente ciclo escolar y validación de firmas/sellos oficiales.`;
            defaultName = "Prompt Maestro para Evaluar Informe Final 2025-2026";
        } else {
            return NextResponse.json({ error: "Módulo no soportado para restablecer" }, { status: 400 });
        }

        const updated = await prisma.plantillaEvaluacion.update({
            where: { id },
            data: {
                nombre: defaultName,
                contenido: defaultText,
                activo: true
            }
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("Reset Prompt error:", error);
        return NextResponse.json({ error: error.message || "Error al restablecer plantilla" }, { status: 500 });
    }
}
