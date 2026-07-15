import fs from "fs";
import path from "path";

const ignoreDirs = ["node_modules", ".git", ".next", "dist", "prisma"];

function walkDir(dir: string, callback: (filePath: string) => void) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (ignoreDirs.includes(file)) continue;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkDir(filePath, callback);
        } else if (stat.isFile() && /\.(tsx|ts|js|jsx)$/.test(file)) {
            callback(filePath);
        }
    }
}

console.log("Searching for '/pre-revision' calls...");
walkDir(path.resolve(__dirname, "../src"), (filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    if (content.includes("/pre-revision")) {
        console.log(`Found call in ${filePath}`);
    }
});
