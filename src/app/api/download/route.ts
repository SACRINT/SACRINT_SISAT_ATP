import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

/**
 * GET /api/download?url=<cloudinary_url>&name=<filename>&publicId=<driveId>
 *
 * Proxy que descarga archivos de Cloudinary usando la Admin API
 * para verificar el recurso y luego generar una URL de descarga autenticada.
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
 * Parse a Cloudinary URL.
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
    const format = lastDotIndex > 0 ? fullPath.slice(lastDotIndex + 1) : "";
    const publicId = resourceType === "raw" ? fullPath : (lastDotIndex > 0 ? fullPath.slice(0, lastDotIndex) : fullPath);

    return { cloudName, resourceType, publicId, format, fullPath };
}

function respondWithFile(blob: ArrayBuffer, contentType: string, fileName: string) {
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

    // Use direct publicId from DB if available
    const publicId = directPublicId || parsed.publicId;

    const configuredCloud = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!configuredCloud || !apiKey || !apiSecret) {
        return NextResponse.json({ error: "Cloudinary credentials not configured" }, { status: 500 });
    }

    const errors: string[] = [];
    console.log(`[download] cloud=${parsed.cloudName}, publicId=${publicId}, format=${parsed.format}, directId=${directPublicId ? "yes" : "no"}`);

    if (parsed.cloudName === configuredCloud) {
        configureCloudinary();

        // Strategy 1: Use Admin API to get the resource and its secure_url
        // Then generate a signed delivery URL with fl_attachment
        const resourceTypes = [parsed.resourceType, parsed.resourceType === "image" ? "raw" : "image"];

        for (const resType of resourceTypes) {
            const tryId = resType === "raw" && parsed.resourceType !== "raw"
                ? publicId + "." + parsed.format
                : (resType === "image" && parsed.resourceType === "raw"
                    ? publicId.replace(/\.[^/.]+$/, "")
                    : publicId);

            try {
                console.log(`[download] Admin API: resType=${resType}, tryId=${tryId}`);
                const resource = await cloudinary.api.resource(tryId, {
                    resource_type: resType,
                    type: "upload",
                });

                if (resource && resource.secure_url) {
                    console.log(`[download] Found resource! secure_url=${resource.secure_url}`);

                    // Generate a signed URL with fl_attachment using the SDK
                    const signedUrl = cloudinary.url(tryId, {
                        resource_type: resType as "image" | "raw" | "video",
                        type: "upload" as "upload",
                        sign_url: true,
                        secure: true,
                        flags: "attachment",
                        format: resType === "raw" ? undefined : parsed.format || undefined,
                    });

                    console.log(`[download] Trying signed attachment URL: ${signedUrl}`);
                    try {
                        const response = await fetch(signedUrl);
                        if (response.ok) {
                            const contentType = response.headers.get("content-type") || "application/octet-stream";
                            const blob = await response.arrayBuffer();
                            return respondWithFile(blob, contentType, fileName);
                        }
                        errors.push(`signed attachment (${resType}) returned ${response.status}`);
                    } catch (e: any) {
                        errors.push(`signed attachment (${resType}) error: ${e.message}`);
                    }

                    // Fallback: try fetching the secure_url directly
                    try {
                        const response = await fetch(resource.secure_url);
                        if (response.ok) {
                            const contentType = response.headers.get("content-type") || "application/octet-stream";
                            const blob = await response.arrayBuffer();
                            return respondWithFile(blob, contentType, fileName);
                        }
                        errors.push(`secure_url (${resType}) returned ${response.status}`);
                    } catch (e: any) {
                        errors.push(`secure_url (${resType}) error: ${e.message}`);
                    }

                    // Fallback: try just the original URL with version
                    if (resource.version) {
                        const ext = resType === "raw" ? "" : `.${parsed.format}`;
                        const versionedUrl = `https://res.cloudinary.com/${configuredCloud}/${resType}/upload/v${resource.version}/${tryId}${ext}`;
                        try {
                            const response = await fetch(versionedUrl);
                            if (response.ok) {
                                const contentType = response.headers.get("content-type") || "application/octet-stream";
                                const blob = await response.arrayBuffer();
                                return respondWithFile(blob, contentType, fileName);
                            }
                            errors.push(`versioned URL (${resType}) returned ${response.status}`);
                        } catch (e: any) {
                            errors.push(`versioned URL (${resType}) error: ${e.message}`);
                        }
                    }
                }
            } catch (e: any) {
                const msg = e?.error?.message || e?.message || String(e);
                errors.push(`Admin API (${resType}, id=${tryId}): ${msg}`);
                console.log(`[download] Admin API error for ${resType}:`, msg);
            }
        }
    } else {
        errors.push(`Cloud mismatch: URL='${parsed.cloudName}' config='${configuredCloud}'`);
    }

    // Last resort: direct URL fetch
    try {
        const response = await fetch(fileUrl, {
            headers: { "User-Agent": "SISAT-ATP-Server/1.0" },
        });
        if (response.ok) {
            const contentType = response.headers.get("content-type") || "application/octet-stream";
            const blob = await response.arrayBuffer();
            return respondWithFile(blob, contentType, fileName);
        }
        errors.push(`direct URL returned ${response.status}`);
    } catch (e: any) {
        errors.push(`direct URL error: ${e.message}`);
    }

    console.error(`[download] All strategies failed:`, errors);
    return NextResponse.json(
        {
            error: "No se pudo descargar el archivo.",
            details: errors,
            info: {
                cloudName: parsed.cloudName,
                resourceType: parsed.resourceType,
                publicId,
                format: parsed.format,
                configuredCloud,
                hadDirectId: !!directPublicId,
            },
        },
        { status: 502 }
    );
}
