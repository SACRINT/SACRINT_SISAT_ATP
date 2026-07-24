const fs = require("fs");
const laboralData = JSON.parse(fs.readFileSync("C:\\NotebookLM\\documentos_referencia\\Horarios\\laboral_grouped.json", "utf8"));

console.log("=== DETALLE DE UACs POR FORMACIÓN LABORAL ===");
Object.keys(laboralData).forEach((capName) => {
  const cap = laboralData[capName];
  console.log(`\n================ ${capName} ================`);
  const sem3 = cap["3"] || [];
  const sem5 = cap["5"] || [];
  console.log("  3º Semestre:", sem3.map(u => u.uacName || u.name || u));
  console.log("  5º Semestre:", sem5.map(u => u.uacName || u.name || u));
});
