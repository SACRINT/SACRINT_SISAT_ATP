import fs from "fs";
import path from "path";

const ignoreDirs = ["node_modules", ".git", ".next", "dist", "prisma"];

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
                    if (line.includes("observacionesATP")) {
                        console.log(`${filePath}:${idx + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    }
}

search(path.resolve(__dirname, ".."));
