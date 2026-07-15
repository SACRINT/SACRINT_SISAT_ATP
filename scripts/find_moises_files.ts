import fs from "fs";
import path from "path";

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");
    for (const line of lines) {
        if (line.startsWith("DATABASE_URL=")) {
            const val = line.substring("DATABASE_URL=".length).trim().replace(/"/g, "");
            process.env.DATABASE_URL = val;
            break;
        }
    }
}

async function main() {
    const { prisma } = await import("../src/lib/db");
    const archivos = await prisma.archivo.findMany({
        where: {
            nombre: { contains: "21EBH0465E" }
        }
    });
    for (const a of archivos) {
        console.log(`Nombre: ${a.nombre}, Tipo: ${a.tipo}, URL: ${a.driveUrl}`);
    }
}

main().catch(console.error);
