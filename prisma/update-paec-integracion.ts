import "dotenv/config";
import { prisma } from "../src/lib/db";

// Agrega al final del prompt PAEC actual los elementos valiosos del nuevo prompt
const ADICION_PAEC = `

================================================================================
ANÁLISIS DE INTEGRACIÓN CURRICULAR (ELEMENTO ADICIONAL 2025-2026)
================================================================================
Clasifica el proyecto según su nivel real de integración curricular:

1. MULTIDISCIPLINARIO: Las asignaturas trabajan el mismo tema en paralelo pero sin que el producto de una sea insumo de otra. Señala si este es el caso y exige rediseño hacia la interdisciplinariedad.

2. INTERDISCIPLINARIO (Nivel esperado): Existe una "Cadena de Valor Pedagógica" donde el producto de una asignatura es insumo indispensable para la siguiente. El saber de una UAC modifica o fortalece la acción de las otras.

3. TRANSDISCIPLINARIO (Nivel de excelencia): La problemática comunitaria trasciende las disciplinas y el proyecto genera un cambio real y medible en la comunidad, con participación de actores externos (expertos, autoridades, padres).

Justifica con evidencias del documento por qué corresponde a esa categoría y qué se necesita para avanzar al siguiente nivel.

================================================================================
SISTEMA DE CALIFICACIÓN NUMÉRICA
================================================================================
Al finalizar el informe, asigna una calificación global:

Nivel BUENO (90-100 pts): Cumple todos los criterios normativos, con transversalidad real y protagonismo estudiantil.
Nivel REGULAR (70-89 pts): Cumple la mayoría de criterios pero con simulación parcial o transversalidad superficial.
Nivel SUFICIENTE (50-69 pts): Cumple los mínimos estructurales pero carece de profundidad pedagógica y situacionalidad.
Nivel INSUFICIENTE (0-49 pts): Omite criterios normativos críticos, usa nomenclatura incorrecta o no hay congruencia entre diagnóstico y proyecto.

Incluye: Calificación numérica sugerida | Nivel alcanzado | Razón principal del nivel asignado.`;

async function main() {
    const paec = await prisma.plantillaEvaluacion.findFirst({ where: { modulo: "PAEC" } });
    if (!paec) {
        console.error("No se encontró el prompt PAEC en la BD");
        process.exit(1);
    }
    
    if (paec.contenido.includes("ANÁLISIS DE INTEGRACIÓN CURRICULAR")) {
        console.log("ℹ️  El PAEC ya tiene la adición de integración curricular, sin cambios.");
        return;
    }
    
    await prisma.plantillaEvaluacion.update({
        where: { id: paec.id },
        data: {
            contenido: paec.contenido + ADICION_PAEC,
        }
    });
    console.log("✓ PAEC actualizado con: Análisis de Integración Curricular (Multi/Inter/Transdisciplinario) + Sistema de Calificación Numérica.");
}

main()
    .catch(e => { console.error("Error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
