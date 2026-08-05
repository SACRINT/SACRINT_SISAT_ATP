import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callGemini } from "@/lib/gemini";

// Tiempo suficiente para que Gemini responda
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { titulo, categoria, contenidoTexto } = body;

    if (!contenidoTexto || contenidoTexto.trim().length < 50) {
      return NextResponse.json(
        { error: "El contenido del documento es demasiado corto para generar un resumen." },
        { status: 400 }
      );
    }

    // Limitar el texto enviado a Gemini para evitar timeouts (primeros 3000 chars)
    const extractoParaResumen = contenidoTexto.substring(0, 3000);

    const systemInstruction = `Eres un asistente especializado en documentos normativos de la SEP (Secretaría de Educación Pública) de México. 
Tu tarea es generar descripciones cortas, precisas y profesionales de documentos oficiales escolares.`;

    const prompt = `Analiza el siguiente documento oficial y genera una descripción corta de 1 a 2 oraciones (máximo 200 caracteres en total) que explique de forma clara:
- ¿Qué tipo de documento es?
- ¿Cuál es su propósito principal?
- ¿A quién va dirigido?

Datos del documento:
- Título: "${titulo || "Sin título"}"
- Categoría: "${categoria || "General"}"
- Extracto del contenido:
${extractoParaResumen}

IMPORTANTE: 
- Responde ÚNICAMENTE con el texto de la descripción, sin comillas, sin encabezados, sin explicaciones adicionales.
- Máximo 200 caracteres.
- En español, lenguaje institucional y claro.
- Ejemplo de formato correcto: "Rúbrica oficial USICAMM para la evaluación del desempeño docente en Educación Media Superior, ciclo 2026-2027."`;

    const descripcion = await callGemini(
      systemInstruction,
      prompt,
      undefined,
      "text",
      undefined,
      false,
      undefined
    );

    // Limpiar el resultado: remover comillas, saltos de línea, y truncar a 250 chars
    const descripcionLimpia = descripcion
      .replace(/^["'`]+|["'`]+$/g, "")  // quitar comillas al inicio/fin
      .replace(/\n+/g, " ")              // saltos de línea → espacio
      .trim()
      .substring(0, 250);

    return NextResponse.json({
      success: true,
      descripcion: descripcionLimpia,
    });
  } catch (error: any) {
    console.error("[generar-descripcion] Error:", error);
    return NextResponse.json(
      { error: "No se pudo generar la descripción automática: " + (error?.message || error) },
      { status: 500 }
    );
  }
}
