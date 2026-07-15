import fs from "fs";
import path from "path";

function search(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (file !== "node_modules" && file !== ".git" && file !== ".next") {
                search(filePath);
            }
        } else {
            const content = fs.readFileSync(filePath, "utf8");
            if (content.toLowerCase().includes("evaluado exitosamente")) {
                console.log(`Found in: ${filePath}`);
                // Print surrounding lines
                const lines = content.split("\n");
                lines.forEach((line, idx) => {
                    if (line.toLowerCase().includes("evaluado exitosamente")) {
                        console.log(`  L${idx+1}: ${line.trim()}`);
                    }
                });
            }
        }
    }
}

search(path.resolve(__dirname, ".."));
