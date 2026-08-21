import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    poweredByHeader: false,
    async headers() {
        return [
            {
                // Allow the download API to be embedded in iframes from the same origin
                // so that PdfViewerModal can render PDFs inline.
                source: "/api/download",
                headers: [
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                ],
            },
            {
                source: "/((?!api/download).*)",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                ],
            },
        ];
    },
};

export default nextConfig;
