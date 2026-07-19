import { prisma } from "../src/lib/db";
import { validarDocumentoPersonalConIA } from "../src/lib/ocr-validator";

async function main() {
    console.log("🔍 Buscando personal sin Clave Presupuestal con Comprobante de Pago subido...");

    const personalConComprobantePeroSinClave = await prisma.personal.findMany({
        where: {
            clavePresupuestal: null,
            documentos: {
                some: {
                    tipoDocumento: "COMPROBANTE_PAGO",
                    archivoDriveUrl: { not: null },
                    noTiene: false,
                }
            }
        },
        include: {
            documentos: {
                where: {
                    tipoDocumento: "COMPROBANTE_PAGO",
                    archivoDriveUrl: { not: null },
                    noTiene: false,
                }
            }
        }
    });

    console.log(`✅ Se encontraron ${personalConComprobantePeroSinClave.length} trabajadores en esta situación.`);

    for (const persona of personalConComprobantePeroSinClave) {
        const docId = persona.documentos[0]?.id;
        if (!docId) continue;

        console.log(`🤖 Ejecutando IA para: ${persona.nombre} ${persona.apellidoPaterno} (Doc ID: ${docId})`);
        
        try {
            await validarDocumentoPersonalConIA(docId);
            // wait a little bit to avoid rate limits
            await new Promise(r => setTimeout(r, 2000));
        } catch (error) {
            console.error(`❌ Error con la IA para ${persona.nombre}:`, error);
        }
    }

    console.log("🎉 Proceso finalizado.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
