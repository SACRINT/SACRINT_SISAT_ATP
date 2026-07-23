const fs = require("fs");
const { PDFParse } = require("pdf-parse");

async function run() {
  const dataBuffer = fs.readFileSync("C:\\NotebookLM\\documentos_referencia\\MAPA CURRICULAR FIRMADO.pdf");
  const uint8Array = new Uint8Array(dataBuffer);
  const parser = new PDFParse(uint8Array);
  await parser.load();
  const textResult = await parser.getText();
  console.log("=== MAPA CURRICULAR FIRMADO.pdf TEXT ===");
  console.log(textResult.text);
}

run().catch(err => console.error("ERR:", err));
