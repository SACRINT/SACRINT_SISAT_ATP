import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

/**
 * GET /api/download?url=<cloudinary_url>&name=<filename>
 *
 * Proxy que descarga archivos de Cloudinary usando la Admin API
 * con autenticación HTTP Basic (api_key:api_secret).
 * Esto garantiza el acceso sin importar restricciones de la cuenta.
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
 * Parse a Cloudinary URL to extract cloud_name, resource_type, and public_id.
 * Handles both encoded and decoded URLs.
 *
 * Example inputs:
 * - https://res.cloudinary.com/drgahsnt4/image/upload/v1772130997/SISAT-ATP/folder/file.pdf
 * - https://res.cloudinary.com/dhyirvsqm/raw/upload/v1772118749/SISAT-ATP/folder/file.docx
 */
function parseCloudinaryUrl(url: string) {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(
        /res\.cloudinary\.com\/([^/]+)\/(\w+)\/upload\/(?:v\d+\/)?(.+)$/
    );
    if (!match) return null;

    const cloudName = match[1];
    const resourceType = match[2]; // 'image', 'raw', 'video'
    const fullPath = match[3];

    // For raw, public_id includes extension. For image, it doesn't.
    let publicId: string;
    if (resourceType === "raw") {
        publicId = fullPath;
    } else {
        // Remove extension for image/video
        publicId = fullPath.replace(/\.[^/.]+$/, "");
    }

    return { cloudName, resourceType, publicId, fullPath };
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

    // Get credentials - use the cloud_name from the URL to determine which account
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const configuredCloudName = process.env.CLOUDINARY_CLOUD_NAME;

    if (!apiKey || !apiSecret) {
        return NextResponse.json({ error: "Cloudinary credentials not configured" }, { status: 500 });
    }

    console.log(`[download] Attempting download for cloud=${parsed.cloudName}, type=${parsed.resourceType}, publicId=${parsed.publicId}`);

    // Strategy 1: Use Cloudinary Admin API to get the resource, then fetch the secure_url
    // The Admin API endpoint: GET /resources/{resource_type}/upload/{public_id}
    // Uses HTTP Basic Auth with api_key:api_secret
    const errors: string[] = [];

    // Try fetching the resource info via Admin API to get an accessible URL
    if (parsed.cloudName === configuredCloudName) {
        try {
            configureCloudinary();
            const resourceInfo = await cloudinary.api.resource(parsed.publicId, {
                resource_type: parsed.resourceType,
                type: "upload",
            });

            if (resourceInfo?.secure_url) {
                console.log(`[download] Got resource URL from Admin API: ${resourceInfo.secure_url}`);
                // Fetch the content using the authenticated session
                const basicAuth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
                const response = await fetch(resourceInfo.secure_url, {
                    headers: {
                        "Authorization": `Basic ${basicAuth}`,
                    },
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
                errors.push(`Admin API URL fetch returned ${response.status}`);
            }
        } catch (e: any) {
            errors.push(`Admin API error: ${e.message || e}`);
            console.log(`[download] Admin API failed:`, e.message || e);
        }

        // Strategy 2: Generate a signed URL with proper encoding
        try {
            configureCloudinary();
            const signedUrl = cloudinary.url(parsed.publicId, {
                resource_type: parsed.resourceType as "image" | "raw" | "video",
                type: "upload",
                sign_url: true,
                secure: true,
            });
            console.log(`[download] Trying signed URL: ${signedUrl}`);
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
            errors.push(`Signed URL returned ${response.status}`);
        } catch (e: any) {
            errors.push(`Signed URL error: ${e.message || e}`);
        }
    }

    // Strategy 3: Direct URL fetch (might work if restrictions were relaxed)
    try {
        console.log(`[download] Trying direct URL fetch`);
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
        errors.push(`Direct URL returned ${response.status}`);
    } catch (e: any) {
        errors.push(`Direct URL error: ${e.message || e}`);
    }

    // Strategy 4: Try with the other resource type
    if (parsed.cloudName === configuredCloudName) {
        const altType = parsed.resourceType === "image" ? "raw" : "image";
        const altPublicId = altType === "raw"
            ? parsed.fullPath  // raw needs extension
            : parsed.fullPath.replace(/\.[^/.]+$/, ""); // image doesn't
        try {
            configureCloudinary();
            const resourceInfo = await cloudinary.api.resource(altPublicId, {
                resource_type: altType,
                type: "upload",
            });
            if (resourceInfo?.secure_url) {
                const response = await fetch(resourceInfo.secure_url);
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
                errors.push(`Alt type (${altType}) URL returned ${response.status}`);
            }
        } catch (e: any) {
            errors.push(`Alt type (${altType}) API error: ${e.message || e}`);
        }
    }

    console.error(`[download] All strategies failed:`, errors);
    return NextResponse.json(
        {
            error: "No se pudo descargar el archivo de Cloudinary.",
            details: errors,
            parsed: {
                cloudName: parsed.cloudName,
                resourceType: parsed.resourceType,
                publicId: parsed.publicId,
                configuredCloud: configuredCloudName,
            },
        },
        { status: 502 }
    );
}
