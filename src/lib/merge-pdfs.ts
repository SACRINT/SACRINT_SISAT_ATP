/**
 * merge-pdfs.ts
 * Utilidad client-side para unir múltiples PDFs en uno solo.
 * Usa pdf-lib (pura JS, funciona en el navegador sin dependencias nativas).
 *
 * Flujo:
 * 1. Descarga cada PDF en paralelo (máx 5 concurrentes) vía fetch
 * 2. Los une en orden con pdf-lib
 * 3. Activa la descarga del archivo resultante en el navegador
 */

import { PDFDocument } from "pdf-lib";

export interface PdfItem {
    /** URL de descarga (proxy /api/download?...&inline=1 para archivos de Cloudinary) */
    proxyUrl: string;
    /** CCT de la escuela — solo para logs */
    cct: string;
    /** Etiqueta del archivo — solo para logs */
    etiqueta?: string;
}

export interface MergeProgress {
    total: number;
    done: number;
    failed: number;
    failedCcts: string[]; // CCTs de las escuelas que fallaron
    stage: "downloading" | "merging" | "done";
}

/**
 * Une múltiples PDFs en uno y lo descarga en el navegador.
 *
 * Si alguno de los archivos falla al descargar (error de red, timeout, etc.),
 * lanza un Error con los detalles de cuáles escuelas fallaron.
 * De esta forma el admin siempre recibe o TODOS los PDFs o un mensaje de error claro.
 *
 * @param items      Lista de archivos a unir, en el orden deseado
 * @param fileName   Nombre del archivo resultante (ej: "GEN004_21FMS0020X_REGISTROS.PDF")
 * @param onProgress Callback para actualizar el progreso
 */
export async function mergePdfsAndDownload(
    items: PdfItem[],
    fileName: string,
    onProgress?: (p: MergeProgress) => void
): Promise<{ mergedCount: number; failedCount: number }> {
    const CONCURRENCY = 5; // máx requests paralelas
    let done = 0;
    let failed = 0;
    const failedCcts: string[] = [];

    const report = (stage: MergeProgress["stage"]) =>
        onProgress?.({ total: items.length, done, failed, failedCcts, stage });

    // ── 1. Descargar todos los PDFs en paralelo (grupos de CONCURRENCY) ──
    const buffers: (ArrayBuffer | null)[] = new Array(items.length).fill(null);

    for (let i = 0; i < items.length; i += CONCURRENCY) {
        const chunk = items.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
            chunk.map(async (item, j) => {
                const idx = i + j;
                try {
                    const res = await fetch(item.proxyUrl);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    buffers[idx] = await res.arrayBuffer();
                    done++;
                } catch (e) {
                    console.warn(`[merge-pdfs] Failed to download ${item.cct} (${item.etiqueta}):`, e);
                    failed++;
                    failedCcts.push(item.cct);
                }
                report("downloading");
            })
        );
    }

    // ── Si alguna descarga falló, lanzar error ANTES de generar el PDF ──
    // Así el admin nunca recibe un archivo incompleto sin saberlo.
    if (failed > 0) {
        throw new Error(
            `No se pudo descargar ${failed} PDF${failed > 1 ? "s" : ""}. ` +
            `Escuelas afectadas: ${failedCcts.join(", ")}. ` +
            `Vuelve a intentarlo en unos segundos.`
        );
    }

    // ── 2. Crear el PDF unificado ──
    report("merging");
    const merged = await PDFDocument.create();
    let mergedCount = 0;

    for (let i = 0; i < buffers.length; i++) {
        const buf = buffers[i];
        if (!buf) continue;
        try {
            const src = await PDFDocument.load(buf, {
                ignoreEncryption: true,
                throwOnInvalidObject: false,
            });
            const pages = await merged.copyPages(src, src.getPageIndices());
            pages.forEach((p) => merged.addPage(p));
            mergedCount++;
        } catch (e) {
            console.warn(`[merge-pdfs] Could not parse PDF from ${items[i].cct}:`, e);
            failed++;
        }
    }

    if (mergedCount === 0) {
        throw new Error("No se pudo procesar ningún PDF. Verifica que los archivos sean PDFs válidos.");
    }

    // ── 3. Guardar y descargar ──
    const pdfBytes = await merged.save();
    // Cast to ArrayBuffer to satisfy strict TypeScript Blob types
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);

    report("done");
    return { mergedCount, failedCount: failed };
}
