import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const connString = process.env.DATABASE_URL || "";

async function testKey(key: string, label: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;
    const payload = {
        contents: [{ parts: [{ text: "Hola, responde únicamente con la palabra OK." }] }]
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "(Vacío)";
            console.log(`[OK] Llave: ${label} -> Respuesta: ${text}`);
            return true;
        } else {
            const errText = await response.text();
            let errJson: any = {};
            try { errJson = JSON.parse(errText); } catch {}
            const msg = errJson.error?.message || errText;
            console.log(`[FALLO] Llave: ${label} -> HTTP ${response.status}: ${msg}`);
            return false;
        }
    } catch (err: any) {
        console.log(`[ERROR RED] Llave: ${label} -> ${err.message}`);
        return false;
    }
}

async function main() {
    console.log("Iniciando prueba directa de API Keys desde PostgreSQL...");
    const pool = new pg.Pool({ connectionString: connString });
    
    try {
        const client = await pool.connect();
        const res = await client.query("SELECT id, label, key, active FROM \"ApiKey\" ORDER BY id ASC");
        client.release();

        console.log(`Encontradas ${res.rows.length} llaves en la base de datos.`);
        
        let activas = 0;
        let exitosas = 0;
        for (const row of res.rows) {
            const { label, key, active } = row;
            if (!active) {
                console.log(`[-] Llave: ${label} (Inactiva en BD, omitiendo)`);
                continue;
            }
            activas++;
            const success = await testKey(key, label);
            if (success) exitosas++;
            // Espera de 500ms entre pruebas
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`\nResumen: ${exitosas} exitosas de ${activas} llaves activas analizadas.`);
    } catch (error: any) {
        console.error("Error al conectar con la base de datos:", error.message);
    } finally {
        await pool.end();
    }
}

main();
