import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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

export async function GET(req: NextRequest) {
    const log: string[] = [];
    log.push("Starting Cloudinary migration script...");

    try {
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
            return NextResponse.json({ success: false, error: "Program not found" });
        }
        log.push(`Found program: ${programa.nombre} (${programa.id})`);

        // 2. Get the Periodo (Annual one)
        const periodo = await prisma.periodoEntrega.findFirst({
            where: {
                programaId: programa.id,
                mes: null,
                semestre: null
            }
        });

        if (!periodo) {
            return NextResponse.json({ success: false, error: "Annual period not found for this program" });
        }
        log.push(`Found annual period: ${periodo.id}`);

        // 3. Search Cloudinary for all resources under SISAT-ATP
        log.push("Fetching resources from Cloudinary...");
        
        let allResources: any[] = [];
        let nextCursor: string | undefined = undefined;
        
        // We will fetch up to 3 pages (300 resources) just in case
        for (let i = 0; i < 3; i++) {
            const searchParams: any = {
                type: 'upload',
                prefix: 'SISAT-ATP/',
                max_results: 100
            };
            if (nextCursor) {
                searchParams.next_cursor = nextCursor;
            }
            
            const result = await client.api.resources(searchParams);
            if (result.resources) {
                allResources = allResources.concat(result.resources);
            }
            nextCursor = result.next_cursor;
            if (!nextCursor) break;
        }

        log.push(`Retrieved ${allResources.length} total resources from Cloudinary.`);

        // Log sample folders to diagnose folder naming
        const uniqueFolders = Array.from(new Set(allResources.map(r => r.folder || ""))).filter(Boolean);
        log.push(`Sample Cloudinary folders: ${uniqueFolders.slice(0, 50).join(", ")}`);

        // Filter resources that belong to ESTRATEGIA_INTEGRAL_DE_SEGURIDAD_Y_CULTURA_DE_PAZ
        // Folders might be like: "SISAT-ATP/21EBH0088T - ALFONSO DE LA MADRID.../..."
        const targetResources = allResources.filter(r => {
            const folder = (r.folder || "").toUpperCase();
            return folder.includes("ESTRATEGIA") || 
                   folder.includes("SEGURIDAD") || 
                   folder.includes("CULTURA") || 
                   folder.includes("PAZ");
        });

        log.push(`Found ${targetResources.length} resources matching the target program folders.`);

        const schools = await prisma.escuela.findMany();
        const schoolMap = new Map(schools.map(s => [s.cct.toUpperCase(), s]));

        let restoredCount = 0;

        for (const res of targetResources) {
            const folder = res.folder || "";
            // Find CCT in the folder path (e.g. "SISAT-ATP/21EBH0088T - ALFONSO DE LA MADRID.../...")
            const cctMatch = folder.match(/([0-9]{2}[A-Z]{3}[0-9]{4}[A-Z]{1})/i);
            if (!cctMatch) {
                log.push(`Could not extract CCT from folder path: ${folder}`);
                continue;
            }

            const cct = cctMatch[1].toUpperCase();
            const school = schoolMap.get(cct);
            if (!school) {
                log.push(`School with CCT ${cct} not found in DB (path: ${folder})`);
                continue;
            }

            // Find or create the Entrega for this school and period
            let entrega = await prisma.entrega.findUnique({
                where: {
                    escuelaId_periodoEntregaId: {
                        escuelaId: school.id,
                        periodoEntregaId: periodo.id
                    }
                },
                include: {
                    archivos: true
                }
            });

            if (!entrega) {
                entrega = await prisma.entrega.create({
                    data: {
                        escuelaId: school.id,
                        periodoEntregaId: periodo.id,
                        estado: "APROBADO", // Use APROBADO since it was already approved
                        fechaSubida: new Date()
                    },
                    include: {
                        archivos: true
                    }
                });
                log.push(`Created new Entrega for school ${school.nombre} (${cct})`);
            }

            // Check if the file is already associated
            const fileExists = entrega.archivos.some(a => a.driveId === res.public_id || a.driveUrl === res.secure_url);
            if (fileExists) {
                log.push(`File already exists in DB for ${school.nombre}: ${res.filename}`);
                continue;
            }

            // Create the Archivo record
            const filename = res.filename + (res.format ? `.${res.format}` : "");
            await prisma.archivo.create({
                data: {
                    entregaId: entrega.id,
                    nombre: filename,
                    driveId: res.public_id,
                    driveUrl: res.secure_url,
                    tipo: "ENTREGA",
                    subidoPor: "director"
                }
            });

            // If the entrega was NO_ENTREGADO, mark it as APROBADO since the file is now there
            if (entrega.estado === "NO_ENTREGADO") {
                await prisma.entrega.update({
                    where: { id: entrega.id },
                    data: { estado: "APROBADO" }
                });
            }

            log.push(`Restored file [${filename}] for school ${school.nombre} (${cct})`);
            restoredCount++;
        }

        log.push(`Migration complete. Restored ${restoredCount} file references in DB.`);

        return NextResponse.json({
            success: true,
            restoredCount,
            log
        });

    } catch (error: any) {
        log.push(`CRITICAL ERROR: ${error.message}`);
        return NextResponse.json({
            success: false,
            error: error.message,
            log
        }, { status: 500 });
    }
}
