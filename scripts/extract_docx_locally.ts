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
    const { extractTextFromDocx } = await import("../src/lib/pre-revision");

    const id = "cmr10q6ek000704l73k6v8hgp";
    const entrega = await prisma.entrega.findUnique({
        where: { id },
        include: { archivos: true }
    });

    if (!entrega) {
        console.error("Entrega not found in DB!");
        return;
    }

    const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
    if (!file) {
        console.error("No file with driveUrl found!");
        return;
    }

    console.log(`Downloading DOCX directly from DB URL: ${encodeURI(decodeURIComponent(file.driveUrl!))}`);
    try {
        const res = await fetch(encodeURI(decodeURIComponent(file.driveUrl!)));
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const text = await extractTextFromDocx(buffer);
        console.log(`Success! Extracted ${text.length} chars.`);

        const dirPath = path.resolve(__dirname, "../scratch/extracted_texts");
        const filePath = path.join(dirPath, `${id}.json`);
        fs.writeFileSync(filePath, JSON.stringify({ entregaId: id, text, savedAt: new Date().toISOString() }, null, 2));
        console.log(`Saved to ${filePath}`);
    } catch (err: any) {
        console.error(`Error:`, err.message || err);
    }
}

main().catch(console.error);
