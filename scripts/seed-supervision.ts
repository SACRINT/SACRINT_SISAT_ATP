import { prisma } from "../src/lib/db";

async function main() {
    const escuela = await prisma.escuela.findFirst({
        where: { nombre: { contains: "SUPERVISION", mode: "insensitive" } }
    });

    if (!escuela) {
        console.error("No se encontró la escuela de Supervisión.");
        return;
    }

    const config = await prisma.autoridadesConfig.findUnique({
        where: { id: "singleton" }
    });

    if (!config) {
        console.error("No se encontró la configuración de autoridades.");
        return;
    }

    const personal = await prisma.personal.findMany({
        where: { escuelaId: escuela.id }
    });

    const autoridades = [
        {
            nombreCompleto: config.supervisor,
            rfc: config.supervisorRFC,
            fecha: config.supervisorFecha,
            clave: config.supervisorClave,
            cargo: "RESPONSABLE",
            sexo: "MASCULINO" // Will need manual review
        },
        {
            nombreCompleto: config.atp1Nombre,
            rfc: config.atp1RFC,
            fecha: config.atp1Fecha,
            clave: config.atp1Clave,
            cargo: "ADMINISTRATIVO",
            sexo: "MASCULINO"
        },
        {
            nombreCompleto: config.atp2Nombre,
            rfc: config.atp2RFC,
            fecha: config.atp2Fecha,
            clave: config.atp2Clave,
            cargo: "ADMINISTRATIVO",
            sexo: "MASCULINO"
        },
        {
            nombreCompleto: config.atp3Nombre,
            rfc: config.atp3RFC,
            fecha: config.atp3Fecha,
            clave: config.atp3Clave,
            cargo: "ADMINISTRATIVO",
            sexo: "FEMENINO" // Imelda
        },
        {
            nombreCompleto: config.atp4Nombre,
            rfc: config.atp4RFC,
            fecha: config.atp4Fecha,
            clave: config.atp4Clave,
            cargo: "ADMINISTRATIVO",
            sexo: "FEMENINO" // Lilia
        }
    ];

    let count = 0;
    for (const auth of autoridades) {
        if (!auth.nombreCompleto || auth.nombreCompleto.trim() === "") continue;

        // Limpiar "C. SUPERVISOR(A)" si está
        const cleanedName = auth.nombreCompleto.replace(/^C\.\s*(SUPERVISOR\(A\)|COORDINADOR\(A\)\s*REGIONAL)\s*-?\s*/i, '').trim();
        
        // Verificar si ya existe
        const exists = personal.find(p => 
            p.rfc === auth.rfc || 
            (p.nombre + " " + p.apellidoPaterno).toLowerCase().includes(cleanedName.split(" ")[0].toLowerCase())
        );

        if (exists) {
            console.log(`Ya existe: ${cleanedName}`);
            continue;
        }

        const parts = cleanedName.split(" ");
        let nombres = parts[0];
        let apeP = "";
        let apeM = "";

        if (parts.length >= 3) {
            apeP = parts[parts.length - 2];
            apeM = parts[parts.length - 1];
            nombres = parts.slice(0, parts.length - 2).join(" ");
        } else if (parts.length === 2) {
            apeP = parts[1];
        }

        // Date format could be dd/mm/yyyy or dd-mm-yyyy or similar. 
        // We'll leave it null and let them edit it if it fails to parse easily
        let dateObj = null;
        if (auth.fecha) {
            const parts = auth.fecha.split(/[-/]/);
            if (parts.length === 3) {
                // If yyyy/mm/dd or dd/mm/yyyy? Typically dd/mm/yyyy in Mexico
                if (parts[0].length === 4) {
                    dateObj = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
                } else {
                    dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                }
            }
        }

        await prisma.personal.create({
            data: {
                escuelaId: escuela.id,
                nombre: nombres.toUpperCase(),
                apellidoPaterno: apeP.toUpperCase(),
                apellidoMaterno: apeM.toUpperCase(),
                sexo: auth.sexo,
                cargo: auth.cargo,
                rfc: auth.rfc?.trim().toUpperCase(),
                fechaIngreso: dateObj && !isNaN(dateObj.getTime()) ? dateObj : null,
                clavePresupuestal: auth.clave,
                orden: count + 1,
            }
        });

        console.log(`Registrado: ${cleanedName}`);
        count++;
    }

    console.log("Proceso terminado.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
