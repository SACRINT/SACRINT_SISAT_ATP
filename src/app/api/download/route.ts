import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/download?url=<cloudinary_url>&name=<filename>
 *
 * Proxy server-side que descarga el archivo de Cloudinary y lo retransmite
 * al navegador. Esto evita cualquier restricción de acceso directo (401, ERR_INVALID_RESPONSE)
 * que Cloudinary impone en cuentas gratuitas para PDFs y archivos raw.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get("url");
    const fileName = searchParams.get("name") || "archivo";

    if (!fileUrl) {
        return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
    }

    // Validate it's a Cloudinary URL to prevent open-redirect / SSRF
    if (!fileUrl.includes("res.cloudinary.com")) {
        return NextResponse.json({ error: "Only Cloudinary URLs are allowed" }, { status: 403 });
    }

    try {
        const response = await fetch(fileUrl, {
            headers: {
                "User-Agent": "SISAT-ATP-Server/1.0",
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Cloudinary returned ${response.status}` },
                { status: response.status }
            );
        }

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
    } catch (error) {
        console.error("[download proxy] Error fetching file:", error);
        return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
    }
}
