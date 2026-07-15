import fs from "fs";
import path from "path";

const terms = ["asistente de IA", "asistente de autoevaluación", "Autoevaluación con IA", "Inteligencia Artificial", "IA"];
const ignoreDirs = ["node_modules", ".git", ".next", "dist", "prisma"];

function walkDir(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (ignoreDirs.includes(file)) continue;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkDir(filePath);
        } else if (stat.isFile() && /\.(tsx|ts|js|jsx)$/.test(file)) {
            const content = fs.readFileSync(filePath, "utf8");
            const lines = content.split("\n");
            lines.forEach((line, idx) => {
                for (const term of terms) {
                    if (line.toLowerCase().includes(term.toLowerCase())) {
                        console.log(`${filePath}:${idx + 1}: ${line.trim()}`);
                    }
                }
            });
        }
    }
}

walkDir(path.resolve(__dirname, "../src"));
