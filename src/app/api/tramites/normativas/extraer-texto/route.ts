import { NextResponse } from "next/server";
import PizZip from "pizzip";

// ── Polyfill para Math.sumPrecise ─────────────────────────────────────────────
// pdfjs-dist (usado por unpdf) requiere Math.sumPrecise, disponible en Node 24+.
// Este polyfill lo proporciona en entornos Vercel con Node <24.
if (typeof (Math as any).sumPrecise === "undefined") {
  (Math as any).sumPrecise = function (values: Iterable<number>): number {
    let sum = 0;
    for (const v of values) {
      sum += v;
    }
    return sum;
  };
}
// ─────────────────────────────────────────────────────────────────────────────

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

    if (filename.toLowerCase().endsWith(".pdf")) {
      let extraido = false;

      // Intento 1: unpdf (con polyfill de Math.sumPrecise ya aplicado)
      try {
        const { extractText } = await import("unpdf");
        const { text } = await extractText(new Uint8Array(buffer), {
          mergePages: true,
        });
        if (text && text.trim().length > 10) {
          textoExtraido = text;
          extraido = true;
        }
      } catch (err1: any) {
        console.warn("[extraer-texto] unpdf falló, intentando pdf-parse:", err1?.message);
      }

      // Intento 2: pdf-parse como fallback
      if (!extraido) {
        try {
          const pdfParseModule = (await import("pdf-parse")) as any;
          const pdfParse = pdfParseModule.default || pdfParseModule;
          const data = await pdfParse(buffer);
          textoExtraido = data.text || "";
          extraido = true;
        } catch (err2: any) {
          console.error("[extraer-texto] pdf-parse también falló:", err2?.message);
        }
      }

      // Si ninguno funcionó, devolver error claro
      if (!extraido || textoExtraido.trim().length < 5) {
        return NextResponse.json(
          {
            error:
              "No se pudo extraer texto del PDF. Intenta convertirlo a TXT/DOCX antes de subirlo.",
          },
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
