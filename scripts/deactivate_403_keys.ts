import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const connString = "postgresql://neondb_owner:npg_YenjqCp7d5XR@ep-summer-cloud-aielq0hd-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
    console.log("Desactivando claves con error HTTP 403 en Neon PostgreSQL...");
    const pool = new pg.Pool({ connectionString: connString });
    
    try {
        const client = await pool.connect();
        const blockedLabels = [
            "SISAT-ATP(sacrint.developer)",
            "SISAT-ATP(sacrint.musica)",
            "SISAT-ATP(heroesdelapatria.sep)"
        ];

        for (const label of blockedLabels) {
            const res = await client.query(`
                UPDATE "ApiKey"
                SET active = false, "errorCount" = 5
                WHERE label = $1
            `, [label]);
            console.log(`[+] Clave "${label}" inhabilitada. Filas afectadas: ${res.rowCount}`);
        }
        client.release();
    } catch (error: any) {
        console.error("Error al actualizar claves:", error.message);
    } finally {
        await pool.end();
    }
}

main();
