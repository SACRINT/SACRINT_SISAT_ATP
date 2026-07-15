import fs from "fs";
import path from "path";

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
        if (line.startsWith("DATABASE_URL=")) {
            process.env.DATABASE_URL = line.substring("DATABASE_URL=".length).trim().replace(/"/g, "");
        }
    }
}

async function main() {
    const { prisma } = await import("../src/lib/db");

    const cicloActivo = await prisma.cicloEscolar.findFirst({ where: { activo: true } });
    console.log(`\nCiclo activo: ${cicloActivo?.nombre}`);

    const entregas = await prisma.entrega.findMany({
        where: { periodoEntrega: { cicloEscolarId: cicloActivo?.id } },
        include: {
            escuela: { select: { nombre: true, cct: true } },
            periodoEntrega: { include: { programa: { select: { nombre: true } } } },
            preRevision: true,
            archivos: { select: { id: true, tipo: true } }
        },
    });

    // Resumen por programa
    const byProgram: Record<string, {
        total: number; conArchivo: number;
        states: Record<string, number>;
        evaluadas: number; sinEvaluar: string[]
    }> = {};

    for (const e of entregas) {
        const prog = e.periodoEntrega?.programa?.nombre || "Sin Programa";
        if (!byProgram[prog]) byProgram[prog] = { total: 0, conArchivo: 0, states: {}, evaluadas: 0, sinEvaluar: [] };
        byProgram[prog].total++;
        if (e.archivos.some(a => a.tipo === "ENTREGA")) byProgram[prog].conArchivo++;
        byProgram[prog].states[e.estado] = (byProgram[prog].states[e.estado] || 0) + 1;
        if (e.preRevision) {
            byProgram[prog].evaluadas++;
        } else if (e.archivos.some(a => a.tipo === "ENTREGA")) {
            byProgram[prog].sinEvaluar.push(e.escuela.nombre);
        }
    }

    console.log("\n===== RESUMEN POR PROGRAMA =====");
    for (const [prog, data] of Object.entries(byProgram).sort(([a], [b]) => a.localeCompare(b))) {
        const alertas = data.sinEvaluar.length > 0 ? " ⚠️ SIN EVALUAR" : "";
        console.log(`\n📁 ${prog}${alertas}`);
        console.log(`   Total: ${data.total} | Con archivo: ${data.conArchivo} | Evaluadas por IA: ${data.evaluadas}`);
        for (const [state, count] of Object.entries(data.states)) {
            console.log(`   ${state}: ${count}`);
        }
        if (data.sinEvaluar.length > 0) {
            console.log(`   ❌ Sin evaluación IA: ${data.sinEvaluar.join(", ")}`);
        }
    }

    // Detalle PMC
    console.log("\n===== DETALLE PMC (Informes Finales) =====");
    const pmcEntregas = entregas
        .filter(e => e.periodoEntrega?.programa?.nombre?.toUpperCase().includes("PMC"))
        .sort((a, b) => a.escuela.nombre.localeCompare(b.escuela.nombre));

    for (const e of pmcEntregas) {
        const pr = e.preRevision;
        const tieneArchivo = e.archivos.some(a => a.tipo === "ENTREGA");
        let dictamen = "Sin evaluar";
        if (pr) {
            const res = pr.resultado as any;
            dictamen = res?.dictamen || res?.resultado || res?.resumen?.substring(0, 80) || JSON.stringify(res).substring(0, 80);
        }
        const icon = !tieneArchivo ? "✗" : !pr ? "⚠️" : "✅";
        console.log(`\n  ${icon} ${e.escuela.nombre} (${e.escuela.cct})`);
        console.log(`     Estado: ${e.estado} | Archivos: ${e.archivos.length}`);
        if (pr) console.log(`     Dictamen: ${dictamen}`);
    }

    // Llaves de API
    const apiKeys = await prisma.apiKey.findMany({ orderBy: { label: "asc" } });
    console.log(`\n===== POOL DE LLAVES (${apiKeys.length} total) =====`);
    const activas = apiKeys.filter(k => k.active).length;
    const inactivas = apiKeys.filter(k => !k.active).length;
    console.log(`   Activas: ${activas} | Inactivas (deshabilitadas por errores): ${inactivas}`);
    for (const k of apiKeys) {
        console.log(`   [${k.active ? "✓" : "✗"}] ${k.label} | Errores: ${k.errorCount}`);
    }

    // Config IA
    const config = await prisma.preRevisionConfig.findFirst();
    console.log(`\n===== CONFIGURACIÓN IA (BD) =====`);
    if (config) {
        console.log(`   Modelo Estándar: ${config.modelDefault} (${config.providerDefault})`);
        console.log(`   Modelo Premium:  ${config.modelPremium} (${config.providerPremium})`);
        console.log(`   Activo para directores: ${config.activoDirectores}`);
        console.log(`   Límite de intentos: ${config.limiteIntentos}`);
    }
}

main().catch(console.error);
