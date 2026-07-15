import fs from "fs";
import path from "path";

const ignoreDirs = ["node_modules", ".git", ".next", "dist", "prisma"];
const searchStrings = ["evaluando la entrega", "re-evaluando", "re-intentar análisis", "con inteligencia artificial", "análisis con ia"];

function search(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (!ignoreDirs.includes(file)) {
                search(filePath);
            }
        } else {
            if (/\.(tsx|ts|js|jsx)$/.test(file)) {
                const content = fs.readFileSync(filePath, "utf8");
                const lines = content.split("\n");
                lines.forEach((line, idx) => {
                    for (const str of searchStrings) {
                        if (line.toLowerCase().includes(str.toLowerCase())) {
                            console.log(`${filePath}:${idx + 1}: ${line.trim()}`);
                        }
                    }
                });
            }
        }
    }
}

search(path.resolve(__dirname, ".."));
