import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const escuelas = [
    { cct: "21EBH0088T", nombre: "Alfonso de la Madrid Vidaurreta", localidad: "Venustiano Carranza", hombres: 105, mujeres: 118 },
    { cct: "21EBH0186U", nombre: "Aquiles Serdán", localidad: "Pantepec", hombres: 70, mujeres: 82 },
    { cct: "21EBH0903N", nombre: "Benito Juárez García", localidad: "San Bartolo", hombres: 14, mujeres: 12 },
    { cct: "21EBH0464F", nombre: "David Alfaro Siqueiros", localidad: "Huitzilac", hombres: 33, mujeres: 27 },
    { cct: "21EBH0789L", nombre: "David Alfaro Siqueiros", localidad: "Jaltocan", hombres: 25, mujeres: 17 },
    { cct: "21EBH0708K", nombre: "Diego Rivera", localidad: "Ejido Cañada Colotla", hombres: 36, mujeres: 28 },
    { cct: "21EBH0608L", nombre: "Emiliano Zapata", localidad: "San Diego", hombres: 36, mujeres: 45 },
    { cct: "21EBH0200X", nombre: "Héroes de la Patria", localidad: "Coronel Tito Hdez.", hombres: 88, mujeres: 101 },
    { cct: "21EBH0620G", nombre: "Jaime Sabines", localidad: "Agua Linda", hombres: 23, mujeres: 19 },
    { cct: "21EBH0681U", nombre: "José Ignacio Gregorio Comonfort", localidad: "Palma Real", hombres: 25, mujeres: 20 },
    { cct: "21EBH0201W", nombre: "José Vasconcelos", localidad: "Lázaro Cárdenas", hombres: 250, mujeres: 235 },
    { cct: "21EBH0799S", nombre: "Juan Aldama", localidad: "Nuevo Zoquiapan", hombres: 24, mujeres: 29 },
    { cct: "21EBH0704O", nombre: "Luis Donaldo Colosio Murrieta", localidad: "La Ceiba Chica", hombres: 21, mujeres: 14 },
    { cct: "21EBH0214Z", nombre: "Mecapalapa", localidad: "Mecapalapa", hombres: 108, mujeres: 124 },
    { cct: "21EBH0465E", nombre: "Moisés Sáenz Garza", localidad: "Tecomate", hombres: 45, mujeres: 41 },
    { cct: "21EBH0130S", nombre: "Reyes García Olivares", localidad: "Fco. Z. Mena", hombres: 76, mujeres: 72 },
    { cct: "21ECT0017T", nombre: "Tecnológico Fco. Z. Mena", localidad: "Fco. Z. Mena", hombres: 92, mujeres: 105 },
    { cct: "21EBH0682T", nombre: "Vicente Suárez Ferrer", localidad: "Coyolito", hombres: 30, mujeres: 20 },
];

const programas = [
    { nombre: "PMC", descripcion: "Plan de Mejora Continua", orden: 1 },
    { nombre: "PAEC-PEC", descripcion: "Programa Escuela Aula Comunidad", orden: 2 },
    { nombre: "Estructura Curricular", descripcion: "Estructura Curricular", orden: 3 },
    { nombre: "Cultura de Paz", descripcion: "Cultura de Paz", orden: 4 },
    { nombre: "Día Naranja", descripcion: "Día Naranja", orden: 5 },
    { nombre: "Inventarios", descripcion: "Inventarios", orden: 6 },
];

async function main() {
    console.log("🗑️  Limpiando base de datos...");
    await prisma.entrega.deleteMany();
    await prisma.recurso.deleteMany();
    await prisma.escuela.deleteMany();
    await prisma.programa.deleteMany();
    await prisma.admin.deleteMany();

    console.log("👤 Creando cuenta de administrador ATP...");
    const adminPassword = await bcrypt.hash("admin2025", 12);
    await prisma.admin.create({
        data: {
            email: "atp@supervision.edu.mx",
            password: adminPassword,
            nombre: "ATP Supervisor",
        },
    });

    console.log("🏫 Creando 18 escuelas...");
    const defaultPassword = await bcrypt.hash("escuela2025", 12);

    for (const esc of escuelas) {
        const emailPrefix = esc.cct.toLowerCase();
        await prisma.escuela.create({
            data: {
                cct: esc.cct,
                nombre: esc.nombre,
                localidad: esc.localidad,
                email: `${emailPrefix}@seppue.gob.mx`,
                password: defaultPassword,
                hombres: esc.hombres,
                mujeres: esc.mujeres,
                total: esc.hombres + esc.mujeres,
            },
        });
    }

    console.log("📋 Creando 6 programas...");
    const createdProgramas = [];
    for (const prog of programas) {
        const p = await prisma.programa.create({ data: prog });
        createdProgramas.push(p);
    }

    console.log("📝 Creando entregas (todas en PENDIENTE)...");
    const allEscuelas = await prisma.escuela.findMany();

    for (const esc of allEscuelas) {
        for (const prog of createdProgramas) {
            await prisma.entrega.create({
                data: {
                    escuelaId: esc.id,
                    programaId: prog.id,
                    estatus: "PENDIENTE",
                },
            });
        }
    }

    const totalEntregas = await prisma.entrega.count();
    console.log(`✅ Seed completado:`);
    console.log(`   - 1 admin`);
    console.log(`   - ${allEscuelas.length} escuelas`);
    console.log(`   - ${createdProgramas.length} programas`);
    console.log(`   - ${totalEntregas} entregas creadas`);
}

main()
    .catch((e) => {
        console.error("❌ Error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
