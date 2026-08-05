import { NextResponse } from "next/server";
import PizZip from "pizzip";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo." }, { status: 400 });
    }

    const filename = file.name || "documento";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let textoExtraido = "";

    if (filename.toLowerCase().endsWith(".pdf")) {
      try {
        // Usar pdfjs-dist en modo Node.js (sin DOM, sin canvas)
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

        // Deshabilitar worker (modo serverless)
        pdfjsLib.GlobalWorkerOptions.workerSrc = "";

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          useWorkerFetch: false,
          useSystemFonts: true,
          disableFontFace: true,
        });

        const pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;
        const textParts: string[] = [];

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item: any) => ("str" in item ? item.str : ""))
            .join(" ");
          textParts.push(pageText);
        }

        textoExtraido = textParts.join("\n");
      } catch (pdfErr: any) {
        console.error("[extraer-texto] Error procesando PDF con pdfjs:", pdfErr);
        return NextResponse.json(
          { error: "Error al leer el archivo PDF: " + (pdfErr?.message || pdfErr) },
          { status: 400 }
        );
      }
    } else if (filename.toLowerCase().endsWith(".docx")) {
      try {
        const zip = new PizZip(buffer);
        const xml = zip.file("word/document.xml")?.asText() || "";
        // Extraer texto simple removiendo etiquetas XML
        textoExtraido = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      } catch (errDocx) {
        return NextResponse.json({ error: "Error extrayendo texto del archivo DOCX." }, { status: 400 });
      }
    } else if (filename.toLowerCase().endsWith(".txt") || filename.toLowerCase().endsWith(".md")) {
      textoExtraido = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: "Formato no soportado. Formatos válidos: PDF, DOCX, TXT, MD." },
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
    });
  } catch (error: any) {
    console.error("[extraer-texto] Error procesando archivo:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al procesar el archivo: " + (error?.message || error) },
      { status: 500 }
    );
  }
}
