import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";

// GET: Fetch PAEC config
export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const config = await prisma.encuentroPAECConfig.findUnique({ where: { id: "singleton" } });
    return NextResponse.json(config || { activo: false, convocatoriaUrl: null, encuentroUrl: null });
}

// POST: Update config (JSON for toggle, FormData for file upload)
export async function POST(req: NextRequest) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") || "";

    // File upload via FormData
    if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const field = formData.get("field") as string | null; // "convocatoria" or "encuentro"

        if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        const { url } = await uploadFileToCloudinary(buffer, file.name, file.type, "ENCUENTRO_PAEC");

        const data: Record<string, string> = {};
        if (field === "convocatoria") {
            data.convocatoriaUrl = url;
        } else if (field === "encuentro") {
            data.encuentroUrl = url;
        } else {
            data.convocatoriaUrl = url; // default
        }

        const config = await prisma.encuentroPAECConfig.upsert({
            where: { id: "singleton" },
            update: data,
            create: { id: "singleton", activo: false, ...data },
        });

        return NextResponse.json(config);
    }

    // JSON toggle
    const body = await req.json();
    const config = await prisma.encuentroPAECConfig.upsert({
        where: { id: "singleton" },
        update: { activo: body.activo },
        create: { id: "singleton", activo: body.activo ?? false },
    });

    return NextResponse.json(config);
}
