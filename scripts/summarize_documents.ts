import fs from "fs";
import path from "path";

async function main() {
    const dirPath = path.resolve(__dirname, "../scratch/extracted_texts");
    const files = fs.readdirSync(dirPath);
    console.log(`Total files: ${files.length}`);
    
    for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const filePath = path.join(dirPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        console.log("-----------------------------------------");
        console.log(`File: ${file}, ID: ${data.entregaId}`);
        console.log(`Length: ${data.text?.length || 0} chars`);
        console.log(`Excerpt: ${data.text?.substring(0, 300).replace(/\n/g, " ")}`);
    }
}

main().catch(console.error);
