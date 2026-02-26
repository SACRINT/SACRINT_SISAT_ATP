import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * GET /api/download?url=<cloudinary_url>&name=<filename>
 *
 * Proxy que descarga archivos de Cloudinary.
 * Genera una URL de descarga firmada usando el endpoint API de Cloudinary
 * (api.cloudinary.com) que requiere autenticación, evitando las restricciones
 * del CDN (res.cloudinary.com) que bloquea PDFs en cuentas gratuitas.
 */

/**
 * Parse a Cloudinary delivery URL to extract components.
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
    // For image/video: public_id doesn't include extension; for raw: it does
    const publicId = resourceType === "raw" ? fullPath : fullPath.slice(0, lastDotIndex);

    return { cloudName, resourceType, publicId, format, fullPath };
}

/**
 * Generate a Cloudinary API signature for private download.
 */
function generateSignature(params: Record<string, string>, apiSecret: string): string {
    const sortedKeys = Object.keys(params).sort();
    const toSign = sortedKeys.map(k => `${k}=${params[k]}`).join("&");
    return crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");
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

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        return NextResponse.json({ error: "Cloudinary credentials not configured" }, { status: 500 });
    }

    const errors: string[] = [];

    console.log(`[download] cloud=${parsed.cloudName}, type=${parsed.resourceType}, id=${parsed.publicId}, format=${parsed.format}`);

    // Only use authenticated strategies if the cloud name matches
    if (parsed.cloudName === cloudName) {
        // Strategy 1: Cloudinary authenticated download via API endpoint
        // POST https://api.cloudinary.com/v1_1/{cloud}/image/download
        // This endpoint is designed for server-side downloads with auth
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const tryDownload = async (resType: string, pubId: string, fmt: string) => {
            const params: Record<string, string> = {
                public_id: pubId,
                timestamp,
            };
            if (fmt) params.format = fmt;

            const signature = generateSignature(params, apiSecret);

            const body = new URLSearchParams({
                ...params,
                api_key: apiKey,
                signature,
            });

            const apiUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resType}/download`;
            console.log(`[download] Trying API download: ${apiUrl} (publicId=${pubId}, format=${fmt})`);

            const response = await fetch(apiUrl, {
                method: "POST",
                body,
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });

            return response;
        };

        // Try original resource type
        try {
            const response = await tryDownload(parsed.resourceType, parsed.publicId, parsed.format);
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
            const errText = await response.text().catch(() => "");
            errors.push(`API download (${parsed.resourceType}) returned ${response.status}: ${errText.slice(0, 200)}`);
        } catch (e: any) {
            errors.push(`API download (${parsed.resourceType}) error: ${e.message || String(e)}`);
        }

        // Try alternate resource type
        const altType = parsed.resourceType === "image" ? "raw" : "image";
        const altPublicId = altType === "raw" ? parsed.fullPath : parsed.fullPath.replace(/\.[^/.]+$/, "");
        const altFormat = altType === "raw" ? "" : parsed.format;
        try {
            const response = await tryDownload(altType, altPublicId, altFormat);
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
            const errText = await response.text().catch(() => "");
            errors.push(`API download (${altType}) returned ${response.status}: ${errText.slice(0, 200)}`);
        } catch (e: any) {
            errors.push(`API download (${altType}) error: ${e.message || String(e)}`);
        }
    } else {
        errors.push(`Cloud mismatch: URL='${parsed.cloudName}' config='${cloudName}'`);
    }

    // Strategy 3: Direct URL (fallback for other cloud accounts like dhyirvsqm)
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
        errors.push(`direct fetch returned ${response.status}`);
    } catch (e: any) {
        errors.push(`direct fetch error: ${e.message || String(e)}`);
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
                configuredCloud: cloudName,
            },
        },
        { status: 502 }
    );
}
