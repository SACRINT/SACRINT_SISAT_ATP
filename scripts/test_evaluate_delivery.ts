import dotenv from "dotenv";
dotenv.config();

import { analizarEntregaConIA } from "../src/lib/pre-revision";

async function main() {
    const entregaId = "cmr10q6ge000i04l7cvmyso7k";
    console.log(`Iniciando prueba local de pre-evaluación para la entrega: ${entregaId}...`);
    try {
        await analizarEntregaConIA(entregaId);
        console.log("¡Éxito! La pre-evaluación local se completó correctamente.");
    } catch (error: any) {
        console.error("Fallo durante la evaluación local:", error);
    }
}

main();
