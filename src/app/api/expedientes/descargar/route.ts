import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import JSZip from "jszip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function configureCloudinary() {
    cloudinary.config({
        cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
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

function safeName(name: string) {
    return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-zA-Z0-9_ -]/g, "")
        .replace(/\s+/g, "_");
}

export async function GET(request: NextRequest) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const escuelaId = searchParams.get("escuelaId");

    const where: Record<string, any> = {
        archivoDriveUrl: { not: null },
    };

    if (escuelaId) {
        where.personal = { escuelaId };
    }

    const documentos = await prisma.documentoPersonal.findMany({
        where,
        include: {
            personal: {
                include: {
                    escuela: { select: { cct: true, nombre: true } },
                },
            },
        },
        orderBy: [
            { personal: { escuela: { nombre: "asc" } } },
            { personal: { apellidoPaterno: "asc" } },
            { personal: { apellidoMaterno: "asc" } },
            { personal: { nombre: "asc" } },
            { orden: "asc" },
        ],
    });

    if (documentos.length === 0) {
        return NextResponse.json({ error: "No hay archivos para descargar" }, { status: 404 });
    }

    const zip = new JSZip();
    let filesAdded = 0;

    for (const doc of documentos) {
        if (!doc.archivoDriveUrl) continue;

        const data = await downloadFile(doc.archivoDriveUrl);
        if (!data) continue;

        const p = doc.personal;
        const escuelaName = safeName(`${p.escuela.cct}_${p.escuela.nombre}`);
        const personalName = safeName(`${p.apellidoPaterno}_${p.apellidoMaterno}_${p.nombre}`);
        
        const ext = doc.archivoNombre?.split(".").pop() || "pdf";
        const cleanDocLabel = safeName(doc.etiqueta || doc.tipoDocumento);
        const fileName = `${cleanDocLabel}.${ext}`;

        let folderPath = "";
        if (escuelaId) {
            // Downloading for single school: PersonalName/DocName.ext
            folderPath = `${personalName}/${fileName}`;
        } else {
            // Downloading for all schools: SchoolName/PersonalName/DocName.ext
            folderPath = `${escuelaName}/${personalName}/${fileName}`;
        }

        // Handle duplicates in zip by adding a counter if needed
        let uniquePath = folderPath;
        let counter = 1;
        while (zip.file(uniquePath)) {
            uniquePath = folderPath.replace(new RegExp(`\\.${ext}$`), `_(${counter}).${ext}`);
            counter++;
        }

        zip.file(uniquePath, data);
        filesAdded++;
    }

    if (filesAdded === 0) {
        return NextResponse.json({ error: "No se pudieron descargar los archivos" }, { status: 502 });
    }

    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
    const label = escuelaId ? documentos[0]?.personal.escuela.nombre : "Todas_Las_Escuelas";
    const zipName = `Expedientes_${safeName(label)}_${new Date().toISOString().slice(0, 10)}.zip`;

    return new NextResponse(zipBuffer, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${zipName}"`,
            "Content-Length": zipBuffer.byteLength.toString(),
        },
    });
}
