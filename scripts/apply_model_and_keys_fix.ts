import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const connString = process.env.DATABASE_URL || "";

async function main() {
    console.log("Aplicando corrección de configuración de modelos y estado de claves...");
    const pool = new pg.Pool({ connectionString: connString });
    
    try {
        const client = await pool.connect();

        // 1. Actualizar el modelo default a "gemini-flash-latest" (Gemini 1.5 Flash estable) en PreRevisionConfig
        const updateConfigRes = await client.query(`
            UPDATE "PreRevisionConfig"
            SET "modelDefault" = 'gemini-flash-latest'
            WHERE id = 'singleton'
        `);
        console.log(`[+] Modelo por defecto actualizado a 'gemini-flash-latest' en PreRevisionConfig. Filas afectadas: ${updateConfigRes.rowCount}`);

        // 2. Desactivar las 3 claves específicas que retornaron HTTP 403 permanentemente
        const blockedKeys = [
            "SISAT-ATP(sacrint.developer)",
            "SISAT-ATP(sacrint.musica)",
            "SISAT-ATP(contacto.heroesdelapatria.sep)"
        ];

        for (const label of blockedKeys) {
            const updateKeyRes = await client.query(`
                UPDATE "ApiKey"
                SET active = false, "errorCount" = 5
                WHERE label = $1
            `, [label]);
            console.log(`[+] Llave "${label}" marcada como inactiva (HTTP 403). Filas afectadas: ${updateKeyRes.rowCount}`);
        }

        // 3. Reactivar las llaves sanas y poner su errorCount a 0
        const reactivateRes = await client.query(`
            UPDATE "ApiKey"
            SET active = true, "errorCount" = 0
            WHERE label NOT IN ($1, $2, $3) AND provider = 'gemini'
        `, blockedKeys);
        console.log(`[+] Llaves sanas restablecidas y listas para usar. Filas afectadas: ${reactivateRes.rowCount}`);

        client.release();
        console.log("\n¡Fijación de base de datos completada con éxito absoluto!");
    } catch (error: any) {
        console.error("Error al aplicar cambios en base de datos:", error.message);
    } finally {
        await pool.end();
    }
}

main();
