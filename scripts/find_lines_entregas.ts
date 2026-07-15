import fs from "fs";
import path from "path";

const filePath = path.resolve(__dirname, "../src/app/director/_componentes/EntregasListado.tsx");
const content = fs.readFileSync(filePath, "utf8");
const lines = content.split("\n");
lines.forEach((line, idx) => {
    if (line.includes("/pre-revision")) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
