import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoria = searchParams.get("categoria");

    const where: any = {};
    if (categoria && categoria !== "TODAS") {
      where.categoria = categoria;
    }

    const normativas = await prisma.documentoNormativo.findMany({
      where,
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json({ success: true, normativas });
  } catch (error: any) {
    console.error("[api/tramites/normativas] Error en GET:", error);
    return NextResponse.json({ error: "Error al cargar normativas" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { id, categoria, titulo, descripcion, contenidoTexto, tags, archivoNombre, archivoUrl } = body;

    if (!categoria || !titulo || !contenidoTexto) {
      return NextResponse.json(
        { error: "Categoría, título y contenido del documento son requeridos." },
        { status: 400 }
      );
    }

    const tagsArray = Array.isArray(tags)
      ? tags
      : typeof tags === "string"
      ? tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    let normativa;
    if (id) {
      normativa = await prisma.documentoNormativo.update({
        where: { id },
        data: {
          categoria,
          titulo,
          descripcion,
          contenidoTexto,
          tags: tagsArray,
          archivoNombre,
          archivoUrl,
          updatedAt: new Date()
        }
      });
    } else {
      normativa = await prisma.documentoNormativo.create({
        data: {
          categoria,
          titulo,
          descripcion,
          contenidoTexto,
          tags: tagsArray,
          archivoNombre,
          archivoUrl
        }
      });
    }

    return NextResponse.json({ success: true, normativa });
  } catch (error: any) {
    console.error("[api/tramites/normativas] Error en POST:", error);
    return NextResponse.json({ error: "Error al guardar la normativa" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id es requerido" }, { status: 400 });
    }

    await prisma.documentoNormativo.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: "Normativa eliminada exitosamente." });
  } catch (error: any) {
    console.error("[api/tramites/normativas] Error en DELETE:", error);
    return NextResponse.json({ error: "Error al eliminar la normativa" }, { status: 500 });
  }
}
