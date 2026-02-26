import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

/**
 * GET /api/download?url=<cloudinary_url>&name=<filename>
 *
 * Proxy que descarga archivos de Cloudinary usando private_download_url
 * para generar URLs autenticadas a través de la API (no el CDN).
 * Esto resuelve el 401 en cuentas con restricciones de entrega.
 */

function configureCloudinary() {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
}

/**
 * Parse a Cloudinary URL to extract cloud_name, resource_type, public_id, and format.
 */
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
    if (lastDotIndex === -1) {
        return { cloudName, resourceType, publicId: fullPath, format: "", fullPath };
    }

    const format = fullPath.slice(lastDotIndex + 1);
    const publicId = resourceType === "raw" ? fullPath : fullPath.slice(0, lastDotIndex);

    return { cloudName, resourceType, publicId, format, fullPath };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get("url");
    const fileName = searchParams.get("name") || "archivo";

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

    const configuredCloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const errors: string[] = [];

    console.log(`[download] cloud=${parsed.cloudName}, type=${parsed.resourceType}, id=${parsed.publicId}, format=${parsed.format}`);

    // Only use Cloudinary SDK strategies if the cloud name matches
    if (parsed.cloudName === configuredCloudName) {
        configureCloudinary();

        // Strategy 1: Use private_download_url which goes through the API endpoint
        // This generates: https://api.cloudinary.com/v1_1/{cloud}/image/download?...signed...
        try {
            const downloadUrl = cloudinary.utils.private_download_url(
                parsed.publicId,
                parsed.format,
                {
                    resource_type: parsed.resourceType,
                    type: "upload",
                    attachment: true,
                }
            );
            console.log(`[download] Strategy 1 - private_download_url: ${downloadUrl}`);
            const response = await fetch(downloadUrl);
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
            errors.push(`private_download_url returned ${response.status}: ${await response.text().catch(() => "")}`);
        } catch (e: any) {
            errors.push(`private_download_url error: ${e.message || String(e)}`);
        }

        // Strategy 2: Try with the other resource type using private_download_url
        const altType = parsed.resourceType === "image" ? "raw" : "image";
        const altPublicId = altType === "raw"
            ? parsed.fullPath
            : parsed.fullPath.replace(/\.[^/.]+$/, "");
        const altFormat = altType === "raw" ? "" : parsed.format;

        try {
            const downloadUrl = cloudinary.utils.private_download_url(
                altPublicId,
                altFormat,
                {
                    resource_type: altType,
                    type: "upload",
                    attachment: true,
                }
            );
            console.log(`[download] Strategy 2 - alt type (${altType}): ${downloadUrl}`);
            const response = await fetch(downloadUrl);
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
            errors.push(`alt type (${altType}) private_download returned ${response.status}`);
        } catch (e: any) {
            errors.push(`alt type (${altType}) error: ${e.message || String(e)}`);
        }

        // Strategy 3: Signed URL
        try {
            const signedUrl = cloudinary.url(parsed.publicId, {
                resource_type: parsed.resourceType as "image" | "raw" | "video",
                type: "upload",
                sign_url: true,
                secure: true,
                format: parsed.format || undefined,
            });
            console.log(`[download] Strategy 3 - signed URL: ${signedUrl}`);
            const response = await fetch(signedUrl);
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
            errors.push(`signed URL returned ${response.status}`);
        } catch (e: any) {
            errors.push(`signed URL error: ${e.message || String(e)}`);
        }
    } else {
        errors.push(`Cloud mismatch: URL has '${parsed.cloudName}' but configured is '${configuredCloudName}'`);
    }

    // Strategy 4: Direct URL
    try {
        const response = await fetch(fileUrl, {
            headers: { "User-Agent": "SISAT-ATP-Server/1.0" },
        });
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
        errors.push(`direct URL returned ${response.status}`);
    } catch (e: any) {
        errors.push(`direct URL error: ${e.message || String(e)}`);
    }

    console.error(`[download] All strategies failed:`, errors);
    return NextResponse.json(
        {
            error: "No se pudo descargar el archivo.",
            details: errors,
            parsed: {
                cloudName: parsed.cloudName,
                resourceType: parsed.resourceType,
                publicId: parsed.publicId,
                format: parsed.format,
                configuredCloud: configuredCloudName,
            },
        },
        { status: 502 }
    );
}
