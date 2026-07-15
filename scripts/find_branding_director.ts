import fs from "fs";
import path from "path";

const filePath = path.resolve(__dirname, "../src/app/director/DirectorPortal.tsx");
if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
        if (line.includes("SISAT-ATP") || line.includes("Supervisión") || line.includes("Director")) {
            console.log(`${idx + 1}: ${line.trim()}`);
        }
    });
} else {
    console.log("DirectorPortal.tsx not found");
}
