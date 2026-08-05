import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callGemini } from "@/lib/gemini";

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
        { error: "El contenido del documento es demasiado corto para analizar." },
        { status: 400 }
      );
    }

    // Limitar el texto enviado a Gemini (primeros 3000 chars)
    const extracto = contenidoTexto.substring(0, 3000);

    const systemInstruction = `Eres un asistente especializado en documentos normativos de la SEP (Secretaría de Educación Pública) de México.
Analizas documentos institucionales y extraes metadatos precisos para catalogarlos.`;

    const prompt = `Analiza el siguiente documento oficial y responde ÚNICAMENTE con un JSON válido con dos campos, sin markdown, sin explicaciones, sin texto adicional.

Datos del documento:
- Título: "${titulo || "Sin título"}"
- Categoría: "${categoria || "General"}"
- Extracto del contenido:
${extracto}

Responde SOLO con este JSON exacto (sin comillas extra, sin markdown, sin comentarios):
{
  "descripcion": "Texto de 1-2 oraciones en español institucional que explique qué es el documento, su propósito y a quién va dirigido. Máximo 220 caracteres.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

Reglas para los tags:
- Entre 3 y 7 palabras clave relevantes
- En minúsculas y sin acentos
- Incluir: tipo de documento, área educativa, institución, ciclo escolar si aparece
- Ejemplos: ["usicamm", "evaluacion-docente", "ems", "2026-2027", "rubrica"]`;

    const rawResponse = await callGemini(
      systemInstruction,
      prompt,
      undefined,
      "text",
      undefined,
      false,
      undefined
    );

    // Limpiar y parsear el JSON que devuelve Gemini
    let descripcion = "";
    let tags: string[] = [];

    try {
      // Quitar posibles bloques ```json ... ``` que Gemini a veces agrega
      const cleaned = rawResponse
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      descripcion = (parsed.descripcion || "")
        .replace(/^["'`]+|["'`]+$/g, "")
        .replace(/\n+/g, " ")
        .trim()
        .substring(0, 250);

      tags = Array.isArray(parsed.tags)
        ? parsed.tags
            .map((t: string) => t.toString().trim().toLowerCase().substring(0, 50))
            .filter((t: string) => t.length > 0)
            .slice(0, 7)
        : [];
    } catch {
      // Si Gemini no devolvió JSON válido, intentar extraer solo la descripción del texto
      descripcion = rawResponse
        .replace(/^["'`]+|["'`]+$/g, "")
        .replace(/\n+/g, " ")
        .trim()
        .substring(0, 250);
      tags = [];
    }

    return NextResponse.json({
      success: true,
      descripcion,
      tags,
    });
  } catch (error: any) {
    console.error("[generar-descripcion] Error:", error);
    return NextResponse.json(
      { error: "No se pudo analizar el documento: " + (error?.message || error) },
      { status: 500 }
    );
  }
}
