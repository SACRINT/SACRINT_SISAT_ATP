import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── helpers ─────────────────────────────────────

async function requireAdmin() {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") throw new Error("NO_AUTH");
}

function err(msg: string, status = 400) {
    return NextResponse.json({ error: msg }, { status });
}

// ─── POST  (crear categoría o disciplina) ────────

export async function POST(req: NextRequest) {
    try {
        await requireAdmin();
        const body = await req.json();
        const { action } = body;

        if (action === "crearCategoria") {
            const { nombre, color } = body;
            if (!nombre?.trim()) return err("Nombre requerido");
            const maxOrden = await prisma.categoriaEvento.aggregate({ _max: { orden: true } });
            const cat = await prisma.categoriaEvento.create({
                data: {
                    nombre: nombre.trim(),
                    color: color || "#2e75b6",
                    orden: (maxOrden._max.orden ?? -1) + 1,
                },
            });
            return NextResponse.json(cat, { status: 201 });
        }

        if (action === "crearDisciplina") {
            const { categoriaId, nombre, tipo, minParticipantes, maxParticipantes, grupoExclusion } = body;
            if (!categoriaId || !nombre?.trim()) return err("categoriaId y nombre requeridos");
            const maxOrden = await prisma.disciplinaEvento.aggregate({
                where: { categoriaId },
                _max: { orden: true },
            });
            const disc = await prisma.disciplinaEvento.create({
                data: {
                    categoriaId,
                    nombre: nombre.trim(),
                    tipo: tipo || "simple",
                    minParticipantes: minParticipantes ?? 1,
                    maxParticipantes: maxParticipantes ?? 1,
                    grupoExclusion: grupoExclusion || null,
                    orden: (maxOrden._max.orden ?? -1) + 1,
                },
            });
            return NextResponse.json(disc, { status: 201 });
        }

        return err("action inválido");
    } catch (e: unknown) {
        if (e instanceof Error && e.message === "NO_AUTH") return err("No autorizado", 401);
        console.error("POST eventos-disciplinas:", e);
        return err("Error interno", 500);
    }
}

// ─── PATCH  (editar categoría o disciplina) ──────

export async function PATCH(req: NextRequest) {
    try {
        await requireAdmin();
        const body = await req.json();
        const { action, id } = body;
        if (!id) return err("id requerido");

        if (action === "editarCategoria") {
            const { nombre, color } = body;
            const data: Record<string, unknown> = {};
            if (nombre !== undefined) data.nombre = nombre.trim();
            if (color !== undefined) data.color = color;
            const cat = await prisma.categoriaEvento.update({ where: { id }, data });
            return NextResponse.json(cat);
        }

        if (action === "editarDisciplina") {
            const { nombre, tipo, minParticipantes, maxParticipantes, grupoExclusion } = body;
            const data: Record<string, unknown> = {};
            if (nombre !== undefined) data.nombre = nombre.trim();
            if (tipo !== undefined) data.tipo = tipo;
            if (minParticipantes !== undefined) data.minParticipantes = minParticipantes;
            if (maxParticipantes !== undefined) data.maxParticipantes = maxParticipantes;
            if (grupoExclusion !== undefined) data.grupoExclusion = grupoExclusion || null;
            const disc = await prisma.disciplinaEvento.update({ where: { id }, data });
            return NextResponse.json(disc);
        }

        return err("action inválido");
    } catch (e: unknown) {
        if (e instanceof Error && e.message === "NO_AUTH") return err("No autorizado", 401);
        console.error("PATCH eventos-disciplinas:", e);
        return err("Error interno", 500);
    }
}

// ─── DELETE  (eliminar categoría o disciplina) ───

export async function DELETE(req: NextRequest) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(req.url);
        const tipo = searchParams.get("tipo"); // "categoria" | "disciplina"
        const id = searchParams.get("id");
        if (!tipo || !id) return err("tipo e id requeridos");

        if (tipo === "categoria") {
            // Cascade deletion deletes child disciplines too
            await prisma.categoriaEvento.delete({ where: { id } });
            return NextResponse.json({ ok: true });
        }

        if (tipo === "disciplina") {
            await prisma.disciplinaEvento.delete({ where: { id } });
            return NextResponse.json({ ok: true });
        }

        return err("tipo inválido (usa 'categoria' o 'disciplina')");
    } catch (e: unknown) {
        if (e instanceof Error && e.message === "NO_AUTH") return err("No autorizado", 401);
        console.error("DELETE eventos-disciplinas:", e);
        return err("Error interno", 500);
    }
}
