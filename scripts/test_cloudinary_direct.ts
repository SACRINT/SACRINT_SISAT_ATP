import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");
    for (const line of lines) {
        if (line.includes("CLOUDINARY")) {
            const [k, v] = line.split("=");
            process.env[k.trim()] = v.trim().replace(/"/g, "");
        }
    }
}

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

async function main() {
    console.log("Cloudinary cloud name:", process.env.CLOUDINARY_CLOUD_NAME);
    
    const docxUrl = "https://res.cloudinary.com/drgahsnt4/raw/upload/v1784059351/SISAT-ATP/21EBH0465E_-_MOISS_SENZ_GARZA/INFORME_FINAL_PMC_2025-2026/21EBH0465E_MOIS%C3%89S%20S%C3%81ENZ%20GARZA_INFORME%20FINAL%20PMC%202025-2026_21EBH0465E_INFORME_FINAL_PMC_25-26.docx";
    
    // Let's decode the URL to get the exact publicId as it exists in Cloudinary
    // Cloudinary path: SISAT-ATP/21EBH0465E_-_MOISS_SENZ_GARZA/INFORME_FINAL_PMC_2025-2026/21EBH0465E_MOISÉS SÁENZ GARZA_INFORME FINAL PMC 2025-2026_21EBH0465E_INFORME_FINAL_PMC_25-26.docx
    const decodedUrl = decodeURIComponent(docxUrl);
    const match = decodedUrl.match(/res\.cloudinary\.com\/([^/]+)\/raw\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) {
        console.error("Match failed");
        return;
    }
    const publicId = match[2];
    console.log("Decoded Public ID:", publicId);

    // Let's build the signed URL using various options:
    // Option 1: passing exact publicId and format
    const format = "docx";
    const cleanPublicId = publicId.endsWith(`.${format}`) ? publicId.slice(0, -(format.length + 1)) : publicId;
    console.log("Clean Public ID:", cleanPublicId);

    const tryUrls = [
        cloudinary.utils.private_download_url(publicId, "docx", { resource_type: "raw" }),
        cloudinary.utils.private_download_url(cleanPublicId, "docx", { resource_type: "raw" }),
        cloudinary.utils.private_download_url(encodeURIComponent(publicId), "docx", { resource_type: "raw" }),
        cloudinary.utils.private_download_url(encodeURIComponent(cleanPublicId), "docx", { resource_type: "raw" }),
    ];

    for (let i = 0; i < tryUrls.length; i++) {
        const u = tryUrls[i];
        console.log(`Option ${i}: ${u}`);
        try {
            const res = await fetch(u);
            console.log(`Option ${i} status: ${res.status}`);
        } catch (err: any) {
            console.log(`Option ${i} failed: ${err.message}`);
        }
    }
}

main().catch(console.error);
