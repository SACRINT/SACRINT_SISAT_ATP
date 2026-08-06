import { NextResponse } from "next/server";
import PizZip from "pizzip";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { callGemini } from "@/lib/gemini";

// Allow up to 60s for OCR on scanned PDFs via Gemini
export const maxDuration = 60;

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

    if (filename.toLowerCase().endsWith(".pdf")) {
      // ── Paso 1: Intentar extracción directa con pdf-parse ────────────
      try {
        const data = await pdfParse(buffer);
        textoExtraido = data.text || "";
      } catch (err: any) {
        console.warn("[extraer-texto] pdf-parse falló, continuando a OCR:", err?.message);
      }

      // ── Paso 2: Fallback OCR con Gemini si el texto es demasiado corto
      // (PDF escaneado / basado en imágenes sin texto digital embebido)
      if (textoExtraido.trim().length < 100) {
        console.log(
          `[extraer-texto] PDF con poco texto digital (${textoExtraido.trim().length} chars). ` +
          "Activando OCR con Gemini..."
        );
        try {
          textoExtraido = await callGemini(
            "Eres un asistente especializado en extraer texto de documentos oficiales de la SEP.",
            "Extrae y transcribe TODO el texto de este documento PDF exactamente como aparece, " +
            "manteniendo la estructura: encabezados, párrafos, listas y tablas. " +
            "Responde ÚNICAMENTE con el texto extraído, sin comentarios ni explicaciones adicionales.",
            buffer,
            "application/pdf"
          );
          usedOcr = true;
          console.log("[extraer-texto] OCR con Gemini exitoso. Chars extraídos:", textoExtraido.length);
        } catch (ocrErr: any) {
          console.error("[extraer-texto] Gemini OCR falló:", ocrErr?.message);
          return NextResponse.json(
            {
              error:
                "No se pudo extraer texto del PDF. " +
                "El archivo parece ser un PDF escaneado y el servicio de OCR no está disponible en este momento. " +
                "Intenta convertirlo a TXT/DOCX o ingresar el texto manualmente.",
            },
            { status: 400 }
          );
        }
      }
    } else if (filename.toLowerCase().endsWith(".docx")) {
      try {
        const zip = new PizZip(buffer);
        const xml = zip.file("word/document.xml")?.asText() || "";
        // Extraer texto simple removiendo etiquetas XML
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
