import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

/**
 * GET /api/download?url=<cloudinary_url>&name=<filename>&publicId=<id>&inline=1
 *
 * Proxy optimizado para archivos de Cloudinary.
 *
 * Estrategia: usar private_download_url (solo HMAC, sin Admin API)
 * → mucho más rápido que la versión anterior que hacía hasta 9 llamadas Admin API.
 *
 * Con ?inline=1 el Content-Disposition se manda como "inline" para que el
 * navegador renderice el PDF en el iframe en lugar de descargarlo.
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

    const cloudName    = match[1];
    const resourceType = match[2];          // "image" | "raw" | "video"
    const fullPath     = match[3];
    const lastDot      = fullPath.lastIndexOf(".");
    const format       = lastDot > 0 ? fullPath.slice(lastDot + 1) : "";

    // raw resources include the extension in public_id; image/video do not.
    const publicId =
        resourceType === "raw"
            ? fullPath
            : (lastDot > 0 ? fullPath.slice(0, lastDot) : fullPath);

    return { cloudName, resourceType, publicId, format };
}

/**
 * Generates a signed Cloudinary private_download_url without calling the Admin API.
 * This is purely local HMAC computation — takes < 1 ms.
 */
function buildSignedUrl(
    publicId: string,
    format: string,
    resourceType: string
): string {
    return cloudinary.utils.private_download_url(
        publicId,
        format,
        {
            resource_type: resourceType as "image" | "raw" | "video",
            type: "upload",
            attachment: true, // Cloudinary always sends attachment; we override in our response
        }
    );
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fileUrl        = searchParams.get("url");
    const fileName       = searchParams.get("name") || "archivo";
    const directPublicId = searchParams.get("publicId");
    // ?inline=1 → render in iframe; default → download as attachment
    const isInline  = searchParams.get("inline") === "1";
    const disposition = isInline
        ? `inline; filename="${encodeURIComponent(fileName)}"`
        : `attachment; filename="${encodeURIComponent(fileName)}"`;

    // ── Validations ────────────────────────────────────────
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

    const { cloudName, resourceType: urlResourceType, format } = parsed;
    const publicId      = directPublicId || parsed.publicId;
    const configuredCloud = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey          = process.env.CLOUDINARY_API_KEY;
    const apiSecret       = process.env.CLOUDINARY_API_SECRET;

    if (!configuredCloud || !apiKey || !apiSecret) {
        return NextResponse.json({ error: "Cloudinary credentials not configured" }, { status: 500 });
    }
    if (cloudName !== configuredCloud) {
        return NextResponse.json({ error: `Cloud mismatch: ${cloudName} vs ${configuredCloud}` }, { status: 400 });
    }

    configureCloudinary();

    // ── Build public_id variants ───────────────────────────
    // raw resources include the extension; image/video don't.
    function adjustId(id: string, resType: string): string {
        if (resType === "raw" && format && !id.endsWith(`.${format}`)) {
            return `${id}.${format}`;
        }
        if (resType !== "raw" && /\.\w{2,5}$/.test(id)) {
            return id.replace(/\.[^/.]+$/, "");
        }
        return id;
    }

    // Try URL-detected type first, then common fallbacks
    const tryTypes = [urlResourceType, "image", "raw", "video"]
        .filter((v, i, a) => a.indexOf(v) === i);

    console.log(`[download] publicId=${publicId}, format=${format}, isInline=${isInline}`);

    for (const resType of tryTypes) {
        const tryId = adjustId(publicId, resType);

        try {
            // Build signed URL locally (fast: just HMAC, no network call)
            const signedUrl = buildSignedUrl(tryId, format, resType);
            console.log(`[download] Trying signed URL: ${resType}/${tryId}`);

            const res = await fetch(signedUrl, {
                signal: AbortSignal.timeout(8000), // 8 s safety net
            });

            if (res.ok) {
                const contentType =
                    res.headers.get("content-type") || "application/octet-stream";
                console.log(`[download] SUCCESS ${resType}/${tryId} — ${contentType}`);

                // Stream the response body to the client
                // (avoids buffering the full file in memory)
                return new Response(res.body, {
                    status: 200,
                    headers: {
                        "Content-Type":           contentType,
                        "Content-Disposition":    disposition,
                        "Cache-Control":          "private, max-age=300",
                        // Allow this endpoint to be loaded in iframes from the same origin
                        "X-Frame-Options":        "SAMEORIGIN",
                        "X-Content-Type-Options": "nosniff",
                    },
                });
            }

            console.log(`[download] ${resType} returned ${res.status}`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[download] Error for ${resType}/${tryId}:`, msg);
        }
    }

    // ── Last resort: direct CDN URL (works for public assets) ──
    try {
        const res = await fetch(fileUrl, {
            headers: { "User-Agent": "SISAT-ATP/1.0" },
            signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
            const contentType = res.headers.get("content-type") || "application/octet-stream";
            console.log(`[download] SUCCESS via direct CDN URL — ${contentType}`);
            return new Response(res.body, {
                status: 200,
                headers: {
                    "Content-Type":        contentType,
                    "Content-Disposition": disposition,
                    "Cache-Control":       "private, max-age=300",
                    "X-Frame-Options":     "SAMEORIGIN",
                },
            });
        }
        console.log(`[download] Direct CDN: ${res.status}`);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[download] Direct CDN failed:", msg);
    }

    console.error(`[download] All strategies failed for publicId=${publicId}`);
    return NextResponse.json(
        {
            error: "No se pudo descargar el archivo.",
            info: { publicId, format, configuredCloud },
        },
        { status: 502 }
    );
}
