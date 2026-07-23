import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(req.url);
    const escuelaId = searchParams.get("escuelaId") || user.escuelaId || user.id;

    // Obtener catálogo global (escuelaId: null) + materias personalizadas de la escuela
    const asignaturas = await prisma.horarioAsignaturaCatalogo.findMany({
      where: {
        OR: [
          { escuelaId: null },
          ...(escuelaId ? [{ escuelaId }] : [])
        ]
      },
      orderBy: [
        { semester: "asc" },
        { uacName: "asc" }
      ]
    });

    return NextResponse.json({ asignaturas });
  } catch (error: any) {
    console.error("[api/horarios/catalogos] Error en GET:", error);
    return NextResponse.json({ error: "Error al obtener catálogo de asignaturas" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await req.json();
    const { uacName, semester, component, totalHours, escuelaId } = body;

    if (!uacName || !semester) {
      return NextResponse.json({ error: "Nombre y semestre son requeridos" }, { status: 400 });
    }

    const targetEscuelaId = escuelaId || user.escuelaId || user.id;
    const hours = Number(totalHours) || 48;
    const horasSemanales = Math.max(1, Math.round(hours / 16));

    const nuevaAsignatura = await prisma.horarioAsignaturaCatalogo.create({
      data: {
        escuelaId: targetEscuelaId || null,
        uacName,
        semester: Number(semester),
        component: component || "personalizado",
        totalHours: hours,
        horasSemanales,
        colorHex: "#ec4899" // Rosa para personalizadas
      }
    });

    return NextResponse.json({ success: true, asignatura: nuevaAsignatura });
  } catch (error: any) {
    console.error("[api/horarios/catalogos] Error en POST:", error);
    return NextResponse.json({ error: "Error al crear asignatura personalizada" }, { status: 500 });
  }
}
