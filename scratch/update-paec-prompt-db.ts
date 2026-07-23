import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
    const template = await prisma.plantillaEvaluacion.findUnique({
        where: { id: "seed-paec-master" }
    });

    if (!template) {
        console.error("Template seed-paec-master not found");
        return;
    }

    let content = template.contenido;

    // Replace the rules in the prompt content to reflect the new semester guidelines for 2026-2027 and 2027-2028.
    
    // 1. Update the overall rules section
    content = content.replace(
        `1.  **Nomenclatura Curricular Estricta:**\n    *   Para **1.º y 2.º Semestre**: USA EXCLUSIVAMENTE **"PROPÓSITOS FORMATIVOS"** y **"CONTENIDOS"**. (Está prohibido usar "Progresiones" aquí).\n    *   Para **3.º a 6.º Semestre** (si aplica): Usa **"PROGRESIONES DE APRENDIZAJE"**.`,
        `1.  **Nomenclatura Curricular Estricta (Normativa Ciclos 2026-2027 y 2027-2028):**\n    *   Para el ciclo escolar **2026-2027**: Los alumnos de **1.º, 2.º, 3.º y 4.º semestre** deben usar exclusivamente **"PROPÓSITOS FORMATIVOS"** y **"CONTENIDOS"** (ya NO usan progresiones). Los únicos semestres que usarán **"PROGRESIONES DE APRENDIZAJE"** son el **5.º y 6.º semestre**.\n    *   Para el ciclo escolar **2027-2028** y posteriores: **TODOS** los semestres (1.º a 6.º) usarán exclusivamente **"PROPÓSITOS FORMATIVOS"** y **"CONTENIDOS"**, y ya ninguno utilizará progresiones.`
    );

    // 2. Update the prompt rules in rule 113+
    content = content.replace(
        `Nomenclatura Curricular Estricta [Fuente: PAEC 2025]: \nSi diseñas actividades para 1.º y 2.º Semestre, DEBES usar y citar "Propósitos Formativos" y "Contenidos". (PROHIBIDO inventar "Progresiones" para estos semestres).\nSi diseñas actividades para 3.º a 6.º Semestre, DEBES usar y citar "Progresiones de Aprendizaje".`,
        `Nomenclatura Curricular Estricta [Fuente: Lineamientos PAEC]:\n- **Ciclo Escolar 2026-2027**: Para **1.º, 2.º, 3.º y 4.º semestre** DEBES usar y citar "Propósitos Formativos" y "Contenidos". (PROHIBIDO usar "Progresiones" para estos semestres). Únicamente para **5.º y 6.º semestre** DEBES usar y citar "Progresiones de Aprendizaje".\n- **Ciclo Escolar 2027-2028 y posteriores**: **TODOS** los semestres (1.º a 6.º) usarán exclusivamente "Propósitos Formativos" y "Contenidos", quedando eliminado el uso de progresiones.`
    );

    // 3. Update the Mapeo Curricular warning
    content = content.replace(
        `*   En la columna de referencia curricular, usa **"PROPÓSITOS FORMATIVOS"**. (NO uses "Progresiones" aquí, eso es solo para 3.º en adelante).`,
        `*   En la columna de referencia curricular, usa **"PROPÓSITOS FORMATIVOS" y "CONTENIDOS"** para 1.º a 4.º semestre en el ciclo 2026-2027 (o para todos los semestres en el ciclo 2027-2028). Solo usa "Progresiones" para 5.º y 6.º semestre en el ciclo 2026-2027.`
    );

    await prisma.plantillaEvaluacion.update({
        where: { id: "seed-paec-master" },
        data: { contenido: content }
    });

    console.log("Template seed-paec-master updated successfully!");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
