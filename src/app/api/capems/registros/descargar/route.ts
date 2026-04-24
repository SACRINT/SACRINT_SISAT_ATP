import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import JSZip from "jszip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function configureCloudinary() {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
}

function parseCloudinaryUrl(url: string) {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(
        /res\.cloudinary\.com\/([^/]+)\/(\w+)\/upload\/(?:v\d+\/)?(.+)$/
    );
    if (!match) return null;
    const resourceType = match[2];
    const fullPath = match[3];
    const lastDotIndex = fullPath.lastIndexOf(".");
    const format = lastDotIndex > 0 ? fullPath.slice(lastDotIndex + 1) : "";
    const publicId = resourceType === "raw"
        ? fullPath
        : (lastDotIndex > 0 ? fullPath.slice(0, lastDotIndex) : fullPath);
    return { resourceType, publicId, format };
}

async function downloadFile(url: string): Promise<ArrayBuffer | null> {
    configureCloudinary();
    const parsed = parseCloudinaryUrl(url);
    if (!parsed) return null;

    const resourceTypes = ["image", "raw", "video"];
    for (const resType of resourceTypes) {
        let tryId = parsed.publicId;
        if (resType === "raw" && !tryId.endsWith(`.${parsed.format}`)) {
            tryId = tryId + "." + parsed.format;
        } else if (resType !== "raw" && tryId.match(/\.\w{2,5}$/)) {
            tryId = tryId.replace(/\.[^/.]+$/, "");
        }
        try {
            const resource = await cloudinary.api.resource(tryId, {
                resource_type: resType,
                type: "upload",
            });
            if (!resource) continue;
            const privateUrl = cloudinary.utils.private_download_url(
                resource.public_id,
                resource.format || parsed.format,
                { resource_type: resType, type: "upload", attachment: true }
            );
            const response = await fetch(privateUrl);
            if (response.ok) return response.arrayBuffer();
        } catch {
            continue;
        }
    }

    // Last resort: direct fetch
    try {
        const resp = await fetch(url);
        if (resp.ok) return resp.arrayBuffer();
    } catch { /* ignore */ }

    return null;
}

// GET /api/capems/registros/descargar?capemId=xxx (optional)
export async function GET(request: NextRequest) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const capemId = searchParams.get("capemId");

    const where: Record<string, any> = {};
    if (capemId) where.capemId = capemId;
    // Only download records that have a file
    where.archivoDriveUrl = { not: null };

    const registros = await prisma.capemFichaRegistro.findMany({
        where,
        include: {
            ficha: { select: { nombre: true } },
            capem: { select: { nombre: true } },
            escuela: { select: { cct: true, nombre: true } },
        },
        orderBy: [{ escuela: { nombre: "asc" } }, { capem: { orden: "asc" } }, { ficha: { orden: "asc" } }],
    });

    if (registros.length === 0) {
        return NextResponse.json({ error: "No hay archivos para descargar" }, { status: 404 });
    }

    const zip = new JSZip();
    let filesAdded = 0;

    for (const reg of registros) {
        if (!reg.archivoDriveUrl) continue;

        const data = await downloadFile(reg.archivoDriveUrl);
        if (!data) continue;

        // Build file path: CAPEM_X/CCT_FichaNombre.ext
        const ext = reg.archivoNombre?.split(".").pop() || "pdf";
        const safeCct = reg.escuela.cct.replace(/[^a-zA-Z0-9]/g, "_");
        const safeCapem = reg.capem.nombre.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "").replace(/ /g, "_");
        const safeFicha = reg.ficha.nombre.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "").replace(/ /g, "_").slice(0, 50);
        const fileName = `${safeCct}_${safeFicha}.${ext}`;
        const folderPath = `${safeCapem}/${fileName}`;

        zip.file(folderPath, data);
        filesAdded++;
    }

    if (filesAdded === 0) {
        return NextResponse.json({ error: "No se pudieron descargar los archivos" }, { status: 502 });
    }

    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
    const capemLabel = capemId ? registros[0]?.capem.nombre.replace(/ /g, "_") : "Todos_CAPEMS";
    const zipName = `CAPEMS_${capemLabel}_${new Date().toISOString().slice(0, 10)}.zip`;

    return new NextResponse(zipBuffer, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${zipName}"`,
            "Content-Length": zipBuffer.byteLength.toString(),
        },
    });
}
