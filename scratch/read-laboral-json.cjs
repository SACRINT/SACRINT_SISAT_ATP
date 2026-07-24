const fs = require("fs");
const data = JSON.parse(fs.readFileSync("C:\\NotebookLM\\documentos_referencia\\Horarios\\laboral_grouped.json", "utf8"));
console.log("=== CAPACITACIONES LABORALES (" + Object.keys(data).length + ") ===");
Object.keys(data).forEach((cap, i) => {
  console.log(`${i+1}. ${cap} (${data[cap].length} UACs)`);
});
