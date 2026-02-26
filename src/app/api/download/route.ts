import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

/**
 * GET /api/download?url=<cloudinary_url>&name=<filename>&publicId=<driveId>
 *
 * Proxy de descarga para archivos de Cloudinary.
 * 
 * Estrategia:
 * 1. Usar Admin API para encontrar el recurso y obtener su resource_type correcto
 * 2. Generar un private_download_url (que usa api.cloudinary.com, NO el CDN)
 * 3. Fetch del archivo desde esa URL autenticada
 * 
 * El CDN de Cloudinary (res.cloudinary.com) bloquea PDFs y otros archivos
 * en cuentas free-tier, pero la API endpoint sí los entrega.
 */

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

    const cloudName = match[1];
    const resourceType = match[2];
    const fullPath = match[3];
    const lastDotIndex = fullPath.lastIndexOf(".");
    const format = lastDotIndex > 0 ? fullPath.slice(lastDotIndex + 1) : "";
    const publicId = resourceType === "raw"
        ? fullPath
        : (lastDotIndex > 0 ? fullPath.slice(0, lastDotIndex) : fullPath);

    return { cloudName, resourceType, publicId, format, fullPath };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get("url");
    const fileName = searchParams.get("name") || "archivo";
    const directPublicId = searchParams.get("publicId");

    if (!fileUrl) {
        return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
    }

    if (!fileUrl.includes("res.cloudinary.com")) {
        return NextResponse.json({ error: "Only Cloudinary URLs are allowed" }, { status: 403 });
    }

    const parsed = parseCloudinaryUrl(fileUrl);
    if (!parsed) {
        return NextResponse.json({ error: "Could not parse Cloudinary URL" }, { status: 400 });
    }

    const publicId = directPublicId || parsed.publicId;
    const configuredCloud = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!configuredCloud || !apiKey || !apiSecret) {
        return NextResponse.json({ error: "Cloudinary credentials not configured" }, { status: 500 });
    }

    if (parsed.cloudName !== configuredCloud) {
        return NextResponse.json({ error: `Cloud mismatch: ${parsed.cloudName} vs ${configuredCloud}` }, { status: 400 });
    }

    configureCloudinary();

    const errors: string[] = [];
    const resourceTypes = ["image", "raw", "video"];

    console.log(`[download] publicId=${publicId}, format=${parsed.format}, directId=${!!directPublicId}`);

    for (const resType of resourceTypes) {
        // Build the correct public_id for this resource_type
        let tryId = publicId;
        if (resType === "raw" && !publicId.endsWith(`.${parsed.format}`)) {
            // raw resource_type includes file extension in public_id
            tryId = publicId + "." + parsed.format;
        } else if (resType !== "raw" && publicId.match(/\.\w{2,5}$/)) {
            // image/video resource_type does NOT include extension
            tryId = publicId.replace(/\.[^/.]+$/, "");
        }

        try {
            // Step 1: Check if resource exists with Admin API
            console.log(`[download] Checking Admin API: resType=${resType}, id=${tryId}`);
            const resource = await cloudinary.api.resource(tryId, {
                resource_type: resType,
                type: "upload",
            });

            if (!resource) continue;
            console.log(`[download] Found resource: ${resource.public_id} (${resType}/${resource.format})`);

            // Step 2: Generate a private download URL via Cloudinary SDK
            // This calls api.cloudinary.com endpoint, NOT the CDN
            try {
                const privateUrl = cloudinary.utils.private_download_url(
                    resource.public_id,
                    resource.format || parsed.format,
                    {
                        resource_type: resType,
                        type: "upload",
                        attachment: true,
                    }
                );

                console.log(`[download] Private download URL: ${privateUrl}`);
                const response = await fetch(privateUrl);

                if (response.ok) {
                    const contentType = response.headers.get("content-type") || "application/octet-stream";
                    const blob = await response.arrayBuffer();
                    console.log(`[download] SUCCESS via private_download_url (${resType}), ${blob.byteLength} bytes`);
                    return new NextResponse(blob, {
                        status: 200,
                        headers: {
                            "Content-Type": contentType,
                            "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
                            "Content-Length": blob.byteLength.toString(),
                            "Cache-Control": "private, no-cache",
                        },
                    });
                }

                const errText = await response.text().catch(() => "");
                errors.push(`private_download (${resType}): ${response.status} - ${errText.slice(0, 200)}`);
                console.log(`[download] private_download_url failed: ${response.status} - ${errText.slice(0, 200)}`);
            } catch (e: any) {
                errors.push(`private_download (${resType}): ${e.message}`);
            }

            // Step 3: Try secure_url from Admin API directly (may still 401)
            if (resource.secure_url) {
                try {
                    const response = await fetch(resource.secure_url);
                    if (response.ok) {
                        const contentType = response.headers.get("content-type") || "application/octet-stream";
                        const blob = await response.arrayBuffer();
                        console.log(`[download] SUCCESS via secure_url (${resType}), ${blob.byteLength} bytes`);
                        return new NextResponse(blob, {
                            status: 200,
                            headers: {
                                "Content-Type": contentType,
                                "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
                                "Content-Length": blob.byteLength.toString(),
                                "Cache-Control": "private, no-cache",
                            },
                        });
                    }
                    errors.push(`secure_url (${resType}): ${response.status}`);
                } catch (e: any) {
                    errors.push(`secure_url (${resType}): ${e.message}`);
                }
            }

        } catch (e: any) {
            const msg = e?.error?.message || e?.message || String(e);
            errors.push(`Admin API (${resType}, id=${tryId}): ${msg}`);
        }
    }

    // Last resort: direct URL fetch
    try {
        const response = await fetch(fileUrl, { headers: { "User-Agent": "SISAT-ATP/1.0" } });
        if (response.ok) {
            const contentType = response.headers.get("content-type") || "application/octet-stream";
            const blob = await response.arrayBuffer();
            return new NextResponse(blob, {
                status: 200,
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
                    "Content-Length": blob.byteLength.toString(),
                    "Cache-Control": "private, no-cache",
                },
            });
        }
        errors.push(`direct fetch: ${response.status}`);
    } catch (e: any) {
        errors.push(`direct fetch: ${e.message}`);
    }

    console.error(`[download] All strategies failed:`, errors);
    return NextResponse.json(
        {
            error: "No se pudo descargar el archivo.",
            details: errors,
            info: { publicId, format: parsed.format, configuredCloud, hadDirectId: !!directPublicId },
        },
        { status: 502 }
    );
}
