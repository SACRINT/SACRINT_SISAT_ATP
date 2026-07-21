import { analizarEntregaConIA } from '../src/lib/pre-revision';
async function run() {
    console.log("Starting analysis...");
    await analizarEntregaConIA('cmrr8xcqm001304l9luls4jpy');
    console.log("Analysis finished.");
}
run();
