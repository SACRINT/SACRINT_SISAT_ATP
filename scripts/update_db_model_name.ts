import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const connString = "postgresql://neondb_owner:npg_YenjqCp7d5XR@ep-summer-cloud-aielq0hd-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
    console.log("Actualizando modelo por defecto de la BD a 'gemini-1.5-flash' para sincronizar con la interfaz...");
    const pool = new pg.Pool({ connectionString: connString });
    
    try {
        const client = await pool.connect();
        const res = await client.query(`
            UPDATE "PreRevisionConfig"
            SET "modelDefault" = 'gemini-1.5-flash'
            WHERE id = 'singleton'
        `);
        console.log(`[+] Modelo por defecto actualizado a 'gemini-1.5-flash'. Filas afectadas: ${res.rowCount}`);
        client.release();
    } catch (error: any) {
        console.error("Error al actualizar la base de datos:", error.message);
    } finally {
        await pool.end();
    }
}

main();
