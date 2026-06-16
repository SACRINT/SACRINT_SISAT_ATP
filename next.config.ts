import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                // Allow the download API to be embedded in iframes from the same origin
                // so that PdfViewerModal can render PDFs inline.
                source: "/api/download",
                headers: [
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                ],
            },
        ];
    },
};

export default nextConfig;
