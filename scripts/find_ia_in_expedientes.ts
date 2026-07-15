import fs from "fs";
import path from "path";

const filePath = path.resolve(__dirname, "../src/app/admin/_componentes/GestionExpedientes.tsx");
const content = fs.readFileSync(filePath, "utf8");
const lines = content.split("\n");
lines.forEach((line, idx) => {
    if (line.toLowerCase().includes("ia") || line.toLowerCase().includes("inteligencia artificial") || line.toLowerCase().includes("evaluado")) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
