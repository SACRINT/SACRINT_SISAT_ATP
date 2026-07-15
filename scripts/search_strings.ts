import fs from "fs";
import path from "path";

const searchTerms = ["asistente de IA", "Inteligencia Artificial", "IA", "evaluado exitosamente"];
const ignoreDirs = ["node_modules", ".git", ".next", "dist", "prisma"];

function walkDir(dir: string, callback: (filePath: string) => void) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (ignoreDirs.includes(file)) continue;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkDir(filePath, callback);
        } else if (stat.isFile() && /\.(tsx|ts|js|jsx|json|md)$/.test(file)) {
            callback(filePath);
        }
    }
}

console.log("Searching for strings...");
walkDir(path.resolve(__dirname, "../src"), (filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    for (const term of searchTerms) {
        if (content.toLowerCase().includes(term.toLowerCase())) {
            console.log(`Found "${term}" in ${filePath}`);
        }
    }
});
