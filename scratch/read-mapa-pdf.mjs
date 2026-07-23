import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

async function readPdf() {
  const filePath = "C:\\NotebookLM\\documentos_referencia\\MAPA CURRICULAR FIRMADO.pdf";
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  console.log("=== MAPA CURRICULAR FIRMADO.pdf TEXT ===");
  console.log(data.text);
}

readPdf().catch(console.error);
