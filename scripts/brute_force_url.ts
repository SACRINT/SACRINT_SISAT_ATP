import fs from "fs";
import path from "path";

async function main() {
    const bases = [
        "https://res.cloudinary.com/drgahsnt4/raw/upload/v1784059351/SISAT-ATP/21EBH0465E_-_MOISS_SENZ_GARZA/INFORME_FINAL_PMC_2025-2026",
        "https://res.cloudinary.com/drgahsnt4/raw/upload/v1784059351/SISAT-ATP/21EBH0465E_-_MOISES_SAENZ_GARZA/INFORME_FINAL_PMC_2025-2026",
        "https://res.cloudinary.com/drgahsnt4/raw/upload/v1784059351/SISAT-ATP/21EBH0465E_-_MOISÉS_SÁENZ_GARZA/INFORME_FINAL_PMC_2025-2026"
    ];

    const names = [
        "21EBH0465E_MOISÉS SÁENZ GARZA_INFORME FINAL PMC 2025-2026_21EBH0465E_INFORME_FINAL_PMC_25-26.docx",
        "21EBH0465E_MOISES SAENZ GARZA_INFORME FINAL PMC 2025-2026_21EBH0465E_INFORME_FINAL_PMC_25-26.docx",
        "21EBH0465E_INFORME_FINAL_PMC_25-26.docx",
        "21EBH0465E_MOISÉS SÁENZ GARZA_INFORME_FINAL_PMC_25-26.docx",
        "21EBH0465E_MOISES_SAENZ_GARZA_INFORME_FINAL_PMC_25-26.docx"
    ];

    for (const base of bases) {
        for (const name of names) {
            const rawUrl = `${base}/${name}`;
            const url = encodeURI(decodeURIComponent(rawUrl));
            try {
                const res = await fetch(url);
                if (res.status !== 404) {
                    console.log(`FOUND URL! Status: ${res.status}, URL: ${url}`);
                    return;
                }
            } catch (err: any) {
                // ignore
            }
        }
    }
    console.log("No variations found.");
}

main().catch(console.error);
