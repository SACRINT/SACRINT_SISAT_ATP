import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

/**
 * GET /api/download?url=<cloudinary_url>&name=<filename>
 *
 * Proxy server-side que genera una URL firmada de Cloudinary
 * y descarga el archivo, luego lo retransmite al navegador.
 * Esto resuelve el 401 de cuentas con restricciones de acceso.
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
 * Parse a Cloudinary URL into its components.
 * Example: https://res.cloudinary.com/drgahsnt4/image/upload/v1772130997/SISAT_ATP/folder/file.pdf
 * Returns { resourceType: "image", publicId: "SISAT_ATP/folder/file", format: "pdf" }
 */
function parseCloudinaryUrl(url: string): { resourceType: string; publicId: string; format: string } | null {
    // Pattern: https://res.cloudinary.com/{cloud}/{resource_type}/upload/v{version}/{public_id}.{ext}
    // or without version: https://res.cloudinary.com/{cloud}/{resource_type}/upload/{public_id}.{ext}
    const match = url.match(
        /res\.cloudinary\.com\/[^/]+\/(\w+)\/upload\/(?:v\d+\/)?(.+)$/
    );
    if (!match) return null;

    const resourceType = match[1]; // 'image', 'raw', 'video'
    const fullPath = decodeURIComponent(match[2]);

    // Extract format (extension) and public_id
    const lastDotIndex = fullPath.lastIndexOf(".");
    if (lastDotIndex === -1) {
        return { resourceType, publicId: fullPath, format: "" };
    }

    const format = fullPath.slice(lastDotIndex + 1);
    // For image/video resource types, public_id does NOT include the extension
    // For raw resource type, public_id INCLUDES the extension
    const publicId = resourceType === "raw" ? fullPath : fullPath.slice(0, lastDotIndex);

    return { resourceType, publicId, format };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get("url");
    const fileName = searchParams.get("name") || "archivo";

    if (!fileUrl) {
        return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
    }

    // Validate it's a Cloudinary URL
    if (!fileUrl.includes("res.cloudinary.com")) {
        return NextResponse.json({ error: "Only Cloudinary URLs are allowed" }, { status: 403 });
    }

    configureCloudinary();

    // Strategy: try multiple approaches to download the file
    const strategies: (() => Promise<Response>)[] = [];

    // Parse the URL to generate signed variants
    const parsed = parseCloudinaryUrl(fileUrl);

    if (parsed) {
        // Strategy 1: Signed URL with original resource type
        strategies.push(() => {
            const signedUrl = cloudinary.url(parsed.publicId, {
                resource_type: parsed.resourceType as "image" | "raw" | "video",
                type: "upload",
                sign_url: true,
                secure: true,
                format: parsed.format || undefined,
            });
            console.log(`[download] Trying signed URL (${parsed.resourceType}):`, signedUrl);
            return fetch(signedUrl);
        });

        // Strategy 2: If it was image, try raw (some PDFs are stored as raw)
        if (parsed.resourceType === "image") {
            strategies.push(() => {
                const rawPublicId = parsed.format
                    ? `${parsed.publicId}.${parsed.format}`
                    : parsed.publicId;
                const signedUrl = cloudinary.url(rawPublicId, {
                    resource_type: "raw",
                    type: "upload",
                    sign_url: true,
                    secure: true,
                });
                console.log("[download] Trying signed URL (raw):", signedUrl);
                return fetch(signedUrl);
            });
        }

        // Strategy 3: If it was raw, try image
        if (parsed.resourceType === "raw") {
            strategies.push(() => {
                const imgPublicId = parsed.publicId.replace(/\.[^/.]+$/, "");
                const signedUrl = cloudinary.url(imgPublicId, {
                    resource_type: "image",
                    type: "upload",
                    sign_url: true,
                    secure: true,
                    format: parsed.format || undefined,
                });
                console.log("[download] Trying signed URL (image):", signedUrl);
                return fetch(signedUrl);
            });
        }
    }

    // Strategy 4: Try the original URL directly (in case signing is not needed)
    strategies.push(() => {
        console.log("[download] Trying original URL:", fileUrl);
        return fetch(fileUrl, {
            headers: { "User-Agent": "SISAT-ATP-Server/1.0" },
        });
    });

    // Try each strategy until one works
    for (const tryFetch of strategies) {
        try {
            const response = await tryFetch();
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
            console.log(`[download] Strategy returned ${response.status}, trying next...`);
        } catch (e) {
            console.log("[download] Strategy failed, trying next...", e);
        }
    }

    // All strategies failed
    return NextResponse.json(
        { error: "No se pudo descargar el archivo de Cloudinary. Todas las estrategias fallaron." },
        { status: 502 }
    );
}
