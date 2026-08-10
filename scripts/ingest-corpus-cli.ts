import "dotenv/config";
import { prisma } from "../src/lib/db";
import { ingestarCorpusLocal } from "../src/lib/discovery/local-ingestor";

async function main() {
    console.log("=== INICIANDO INGESTA DEL CORPUS LOCAL EN MODO PRUEBA ===");
    
    const tenantId = process.env.TENANT_ID;
    if (!tenantId) {
        throw new Error("Variable de entorno TENANT_ID es obligatoria para ejecutar el script.");
    }
    const email = process.env.AUDITORIA_EMAIL || "supervision@seppue.gob.mx";
    const directorioCorpus = process.env.CORPUS_BASE_DIR || "C:\\NotebookLM\\BaseConocimiento";

    // 1. Obtener o crear CuentaAuditoria
    let cuenta = await prisma.cuentaAuditoria.findFirst({
        where: { tenantId },
    });

    if (!cuenta) {
        console.log(`[CONFIG] Creando CuentaAuditoria para tenant ${tenantId}...`);
        cuenta = await prisma.cuentaAuditoria.create({
            data: {
                tenantId,
                email,
                nombreTitular: "Supervisión Escolar",
                tipoFuente: "CORPUS_LOCAL",
                directorioCorpus,
            },
        });
        console.log(`[CONFIG] Cuenta creada con ID: ${cuenta.id}`);
    } else {
        console.log(`[CONFIG] Cuenta existente encontrada con ID: ${cuenta.id}`);
        // Actualizar directorio si difiere
        if (cuenta.directorioCorpus !== directorioCorpus) {
            cuenta = await prisma.cuentaAuditoria.update({
                where: { id: cuenta.id },
                data: { directorioCorpus },
            });
        }
    }

    // 2. Ejecutar ingesta local
    console.log(`[INGESTA] Procesando archivos desde ${directorioCorpus}...`);
    const resultado = await ingestarCorpusLocal({
        cuentaId: cuenta.id,
        tenantId,
        directorioCorpus,
    });

    console.log("\n=== RESULTADO DE LA INGESTA ===");
    console.log(`✓ Éxito: ${resultado.success}`);
    console.log(`✓ Hilos / Conversaciones: ${resultado.totalHilos}`);
    console.log(`✓ Total de Mensajes: ${resultado.totalMensajes} (Recibidos: ${resultado.totalRecibidos}, Enviados: ${resultado.totalEnviados})`);
    console.log(`✓ Total de Adjuntos Catalogados: ${resultado.totalAdjuntos}`);
    console.log(`✓ Duración: ${resultado.duracionSegundos} segundos`);

    // 3. Verificaciones de integridad en base de datos
    console.log("\n=== VERIFICACIÓN DE BASE DE DATOS (NEON POSTGRESQL) ===");
    const [cCount, hCount, mCount, aCount, syncCount] = await Promise.all([
        prisma.cuentaAuditoria.count({ where: { tenantId } }),
        prisma.emailConversation.count({ where: { tenantId } }),
        prisma.emailMessage.count({ where: { tenantId } }),
        prisma.emailAttachment.count({ where: { tenantId } }),
        prisma.syncState.count({ where: { tenantId } }),
    ]);

    console.log(`- Cuentas en DB: ${cCount}`);
    console.log(`- Conversaciones en DB: ${hCount}`);
    console.log(`- Mensajes de Correo en DB: ${mCount}`);
    console.log(`- Adjuntos Registrados en DB: ${aCount}`);
    console.log(`- Registros de Sincronización: ${syncCount}`);

    // Mensajes con plazos detectados
    const conPlazos = await prisma.emailMessage.count({
        where: { tenantId, tieneSenalesPlazo: true },
    });
    console.log(`- Mensajes con Señales de Plazos/Urgencia: ${conPlazos}`);

    // Mensajes con análisis semántico
    const analizados = await prisma.emailMessage.count({
        where: { tenantId, estadoAnalisis: "ANALIZADO_SEMANTICO" },
    });
    console.log(`- Mensajes con Análisis Semántico Enriquecido: ${analizados}`);

    console.log("\n>>> INGESTA COMPLETADA EXITOSAMENTE <<<");
}

main()
    .catch((e) => {
        console.error("Error fatal:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
