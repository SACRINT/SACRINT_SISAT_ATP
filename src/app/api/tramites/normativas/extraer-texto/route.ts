import { NextResponse } from "next/server";
import PizZip from "pizzip";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { PDFDocument } from "pdf-lib";
import { callGemini } from "@/lib/gemini";

// Permitir hasta 60s en Vercel para extracción y OCR
export const maxDuration = 60;

const PROMPT_SISTEMA_OCR =
  "Eres un asistente especializado en digitalizar y extraer texto de normativas, circulares y documentos oficiales de la SEP y Educación Media Superior.";

const PROMPT_USUARIO_OCR =
  "Extrae y transcribe TODO el texto de este documento oficial exactamente como aparece. " +
  "Mantén intacta toda la información: fechas, procesos, calendarios, tablas, notas y nombres. " +
  "Formatea las tablas como tablas Markdown legibles. " +
  "Responde ÚNICAMENTE con el texto extraído en formato Markdown limpio, sin introducciones ni comentarios adicionales.";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo." },
        { status: 400 }
      );
    }

    const filename = file.name || "documento";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let textoExtraido = "";
    let usedOcr = false;
    let totalPaginas = 1;

    if (filename.toLowerCase().endsWith(".pdf")) {
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        totalPaginas = pdfDoc.getPageCount();
      } catch (loadErr: any) {
        console.warn("[extraer-texto] No se pudo cargar con pdf-lib, intentando pdfParse directo:", loadErr?.message);
      }

      if (totalPaginas <= 3) {
        // Documentos cortos (1 a 3 páginas)
        let parsedText = "";
        try {
          const data = await pdfParse(buffer);
          parsedText = data.text || "";
        } catch (err: any) {
          console.warn("[extraer-texto] pdf-parse falló en PDF corto:", err?.message);
        }

        const densPorPagina = parsedText.trim().length / (totalPaginas || 1);
        if (densPorPagina < 80) {
          console.log(`[extraer-texto] PDF corto escaneado (densidad ${densPorPagina.toFixed(0)} c/p). Ejecutando Gemini OCR...`);
          try {
            textoExtraido = await callGemini(
              PROMPT_SISTEMA_OCR,
              PROMPT_USUARIO_OCR,
              buffer,
              "application/pdf"
            );
            usedOcr = true;
          } catch (ocrErr: any) {
            console.error("[extraer-texto] Gemini OCR falló:", ocrErr?.message);
            if (parsedText.trim().length > 0) {
              textoExtraido = parsedText;
            } else {
              throw new Error("El PDF es escaneado y el servicio OCR no respondió a tiempo. Intente con otro archivo o conviértalo a TXT.");
            }
          }
        } else {
          textoExtraido = parsedText;
        }
      } else {
        // Documentos multi-página: procesar en lotes (chunks) de 3 páginas
        console.log(`[extraer-texto] Procesando PDF multi-página híbrido (${totalPaginas} páginas)...`);
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const CHUNK_SIZE = 3;
        const totalChunks = Math.ceil(totalPaginas / CHUNK_SIZE);
        const partesTexto: string[] = [];

        for (let i = 0; i < totalChunks; i++) {
          const startPage = i * CHUNK_SIZE;
          const endPage = Math.min((i + 1) * CHUNK_SIZE, totalPaginas);
          const pageIndices = Array.from({ length: endPage - startPage }, (_, k) => startPage + k);

          const subPdf = await PDFDocument.create();
          const copiedPages = await subPdf.copyPages(pdfDoc, pageIndices);
          copiedPages.forEach((p) => subPdf.addPage(p));
          const subBytes = await subPdf.save();
          const subBuffer = Buffer.from(subBytes);

          let chunkDigitalText = "";
          try {
            const data = await pdfParse(subBuffer);
            chunkDigitalText = data.text || "";
          } catch (err) {
            // Continuar hacia OCR
          }

          const chunkDensity = chunkDigitalText.trim().length / pageIndices.length;

          if (chunkDensity < 80) {
            console.log(`[extraer-texto] Páginas ${startPage + 1}-${endPage} son escaneadas (${chunkDensity.toFixed(0)} c/p). Aplicando OCR Gemini...`);
            try {
              const ocrResult = await callGemini(
                PROMPT_SISTEMA_OCR,
                PROMPT_USUARIO_OCR,
                subBuffer,
                "application/pdf"
              );
              partesTexto.push(ocrResult.trim());
              usedOcr = true;
            } catch (chunkOcrErr: any) {
              console.warn(`[extraer-texto] OCR falló en lote ${startPage + 1}-${endPage}:`, chunkOcrErr?.message);
              if (chunkDigitalText.trim()) {
                partesTexto.push(chunkDigitalText.trim());
              }
            }
          } else {
            console.log(`[extraer-texto] Páginas ${startPage + 1}-${endPage} tienen texto digital (${chunkDigitalText.trim().length} chars).`);
            partesTexto.push(chunkDigitalText.trim());
          }
        }

        textoExtraido = partesTexto.filter(Boolean).join("\n\n");
      }
    } else if (filename.toLowerCase().endsWith(".docx")) {
      try {
        const zip = new PizZip(buffer);
        const xml = zip.file("word/document.xml")?.asText() || "";
        textoExtraido = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      } catch (errDocx) {
        return NextResponse.json(
          { error: "Error extrayendo texto del archivo DOCX." },
          { status: 400 }
        );
      }
    } else if (
      filename.toLowerCase().endsWith(".txt") ||
      filename.toLowerCase().endsWith(".md")
    ) {
      textoExtraido = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        {
          error:
            "Formato no soportado. Formatos válidos: PDF, DOCX, TXT, MD.",
        },
        { status: 400 }
      );
    }

    // Limpiar espacios en blanco excesivos y saltos duplicados
    const textoLimpio = textoExtraido
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({
      success: true,
      filename,
      texto: textoLimpio,
      totalCaracteres: textoLimpio.length,
      totalPaginas,
      usedOcr,
    });
  } catch (error: any) {
    console.error("[extraer-texto] Error procesando archivo:", error);
    return NextResponse.json(
      {
        error:
          "Ocurrió un error al procesar el archivo: " +
          (error?.message || error),
      },
      { status: 500 }
    );
  }
}
