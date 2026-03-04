import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";

// GET: Fetch olimpiada config
export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const config = await prisma.olimpiadaConfig.findUnique({ where: { id: "singleton" } });
    return NextResponse.json(config || { activo: false, convocatoriaUrl: null });
}

// POST: Update config (JSON for toggle, FormData for file upload)
export async function POST(req: NextRequest) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || !["ATP", "ATP_ADMIN", "SUPER_ADMIN"].includes(user?.role || "")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") || "";

    // File upload via FormData
    if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const field = formData.get("field") as string | null; // "convocatoria"

        if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        const { url } = await uploadFileToCloudinary(buffer, file.name, file.type, "OLIMPIADA_MATEMATICAS");

        const data: Record<string, string> = {};
        if (field === "convocatoria" || !field) {
            data.convocatoriaUrl = url;
        }

        const config = await prisma.olimpiadaConfig.upsert({
            where: { id: "singleton" },
            update: data,
            create: { id: "singleton", activo: false, ...data },
        });

        return NextResponse.json(config);
    }

    // JSON toggle
    const body = await req.json();
    const config = await prisma.olimpiadaConfig.upsert({
        where: { id: "singleton" },
        update: { activo: body.activo },
        create: { id: "singleton", activo: body.activo ?? false },
    });

    return NextResponse.json(config);
}
