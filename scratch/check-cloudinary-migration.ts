import "dotenv/config";
import { prisma } from "../src/lib/db";
import { v2 as cloudinary } from "cloudinary";

function getCloudinaryConfig() {
    cloudinary.config({
        cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
    return cloudinary;
}

async function main() {
    console.log("Cloudinary configuration keys present:");
    console.log("CLDIN_CLOUD_NAME:", !!process.env.CLDIN_CLOUD_NAME || !!process.env.CLOUDINARY_CLOUD_NAME);
    console.log("CLDIN_API_KEY:", !!process.env.CLDIN_API_KEY || !!process.env.CLOUDINARY_API_KEY);
    console.log("CLDIN_API_SECRET:", !!process.env.CLDIN_API_SECRET || !!process.env.CLOUDINARY_API_SECRET);

    const client = getCloudinaryConfig();

    // 1. Find the Program
    const programa = await prisma.programa.findFirst({
        where: {
            nombre: {
                contains: "ESTRATEGIA INTEGRAL DE SEGURIDAD",
                mode: "insensitive"
            }
        }
    });

    if (!programa) {
        console.error("Program not found!");
        return;
    }

    console.log("Found Program:", {
        id: programa.id,
        nombre: programa.nombre,
        tipo: programa.tipo
    });

    // 2. Find Periodos for this Program
    const periodos = await prisma.periodoEntrega.findMany({
        where: { programaId: programa.id },
        include: {
            _count: {
                select: { entregas: true }
            }
        }
    });

    console.log(`Found ${periodos.length} periodos:`);
    for (const p of periodos) {
        console.log(`- Periodo ID: ${p.id}, Mes: ${p.mes}, Semestre: ${p.semestre}, Activo: ${p.activo}, Entregas: ${p._count.entregas}`);
    }

    // 3. Find if there are orphan files in Cloudinary
    try {
        console.log("Listing resources in Cloudinary under 'SISAT-ATP/'...");
        const result = await client.api.resources({
            type: 'upload',
            prefix: 'SISAT-ATP/',
            max_results: 100
        });
        console.log(`Found ${result.resources?.length || 0} resources in Cloudinary list.`);
        if (result.resources && result.resources.length > 0) {
            console.log("Sample resource folders:");
            const folders = Array.from(new Set(result.resources.map((r: any) => r.folder)));
            folders.forEach(f => console.log(" -", f));
        }
    } catch (err) {
        console.error("Error connecting to Cloudinary:", err);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
