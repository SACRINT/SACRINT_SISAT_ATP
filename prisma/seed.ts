import "dotenv/config";
import { PrismaClient, TipoPeriodo } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── 18 Bachilleratos ────────────────────────────
const escuelas = [
    { cct: "21EBH0088T", nombre: "ALFONSO DE LA MADRID VIDAURRETA", localidad: "VENUSTIANO CARRANZA", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0186U", nombre: "AQUILES SERDÁN", localidad: "PANTEPEC", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0903N", nombre: "BENITO JUÁREZ GARCÍA", localidad: "SAN BARTOLO", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0464F", nombre: "DAVID ALFARO SIQUEIROS", localidad: "HUITZILAC", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0789L", nombre: "DAVID ALFARO SIQUEIROS", localidad: "JALTOCAN", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0708K", nombre: "DIEGO RIVERA", localidad: "EJIDO CAÑADA COLOTLA", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0608L", nombre: "EMILIANO ZAPATA", localidad: "SAN DIEGO", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0200X", nombre: "HÉROES DE LA PATRIA", localidad: "CORONEL TITO HDEZ.", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0620G", nombre: "JAIME SABINES", localidad: "AGUA LINDA", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0681U", nombre: "JOSÉ IGNACIO GREGORIO COMONFORT", localidad: "PALMA REAL", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0201W", nombre: "JOSÉ VASCONCELOS", localidad: "LAZARO CARDENAS", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0799S", nombre: "JUAN ALDAMA", localidad: "NUEVO ZOQUIAPAN", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0704O", nombre: "LUIS DONALDO COLOSIO MURRIETA", localidad: "LA CEIBA CHICA", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0214Z", nombre: "MECAPALAPA", localidad: "MECAPALAPA", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0465E", nombre: "MOISÉS SÁENZ GARZA", localidad: "TECOMATE", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0130S", nombre: "REYES GARCÍA OLIVARES", localidad: "FCO. Z. MENA", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21ECT0017T", nombre: "TECNOLÓGICO FCO. Z. MENA", localidad: "FCO. Z. MENA", hombres: 0, mujeres: 0, total: 0 },
    { cct: "21EBH0682T", nombre: "VICENTE SUÁREZ FERRER", localidad: "COYOLITO", hombres: 0, mujeres: 0, total: 0 },
];

// ─── 5 Programas (Estructura Curricular eliminado) ──
const programas = [
    { nombre: "PMC", descripcion: "Plan de Mejora Continua", tipo: TipoPeriodo.ANUAL, numArchivos: 1, orden: 1 },
    { nombre: "PAEC-PEC", descripcion: "Programa de Apoyo a Escuelas Comunitarias", tipo: TipoPeriodo.SEMESTRAL, numArchivos: 1, orden: 2 },
    { nombre: "Día Naranja", descripcion: "Registro y evidencias del 25 de cada mes", tipo: TipoPeriodo.MENSUAL, numArchivos: 2, orden: 3 },
    { nombre: "Cultura de Paz", descripcion: "Jóvenes al Centro / Cultura de Paz", tipo: TipoPeriodo.MENSUAL, numArchivos: 1, orden: 4 },
    { nombre: "Inventarios", descripcion: "Inventario de mobiliario y equipo", tipo: TipoPeriodo.ANUAL, numArchivos: 1, orden: 5 },
];

// ─── Meses del ciclo escolar 2025-2026 ──────────
const MESES_CICLO = [
    { mes: 8, año: 2025 },  // Agosto
    { mes: 9, año: 2025 },  // Septiembre
    { mes: 10, año: 2025 }, // Octubre
    { mes: 11, año: 2025 }, // Noviembre
    { mes: 12, año: 2025 }, // Diciembre
    { mes: 1, año: 2026 },  // Enero
    { mes: 2, año: 2026 },  // Febrero
    { mes: 3, año: 2026 },  // Marzo
    { mes: 4, año: 2026 },  // Abril
    { mes: 5, año: 2026 },  // Mayo
    { mes: 6, año: 2026 },  // Junio
    { mes: 7, año: 2026 },  // Julio
];

async function main() {
    console.log("🗑️  Limpiando base de datos...");
    await prisma.correccion.deleteMany();
    await prisma.archivo.deleteMany();
    await prisma.entrega.deleteMany();
    await prisma.periodoEntrega.deleteMany();
    await prisma.recurso.deleteMany();
    await prisma.programa.deleteMany();
    await prisma.cicloEscolar.deleteMany();
    await prisma.escuela.deleteMany();
    await prisma.admin.deleteMany();

    // ─── Admin ────────────────────────────────────
    console.log("👤 Creando cuenta de administrador ATP...");
    const hashedAdminPwd = await bcrypt.hash("admin2025", 12);
    await prisma.admin.create({
        data: { email: "atp@supervision.edu.mx", password: hashedAdminPwd, nombre: "Supervisión ATP", role: "SUPER_ADMIN" },
    });

    // ─── Escuelas ─────────────────────────────────
    console.log("🏫 Creando 18 escuelas...");
    const hashedSchoolPwd = await bcrypt.hash("escuela2025", 12);
    const createdEscuelas = [];
    for (const esc of escuelas) {
        const e = await prisma.escuela.create({
            data: { ...esc, email: `${esc.cct}@seppue.gob.mx`, password: hashedSchoolPwd },
        });
        createdEscuelas.push(e);
    }

    // ─── Ciclo Escolar ────────────────────────────
    console.log("📅 Creando ciclo escolar 2025-2026...");
    const ciclo = await prisma.cicloEscolar.create({
        data: {
            nombre: "2025-2026",
            inicio: new Date("2025-08-01T00:00:00Z"),
            fin: new Date("2026-07-31T23:59:59Z"),
            activo: true,
        },
    });

    // ─── Programas ────────────────────────────────
    console.log("📋 Creando 5 programas...");
    const createdProgramas = [];
    for (const prog of programas) {
        const p = await prisma.programa.create({ data: prog });
        createdProgramas.push(p);
    }

    // ─── Periodos de Entrega ──────────────────────
    console.log("📆 Creando periodos de entrega...");
    let totalPeriodos = 0;
    let totalEntregas = 0;

    for (const prog of createdProgramas) {
        if (prog.tipo === TipoPeriodo.ANUAL) {
            // PMC e Inventarios: 1 periodo por ciclo
            const periodo = await prisma.periodoEntrega.create({
                data: {
                    cicloEscolarId: ciclo.id,
                    programaId: prog.id,
                    activo: true,
                    fechaLimite: new Date("2026-06-30T23:59:59Z"),
                },
            });
            totalPeriodos++;

            // Crear entregas para cada escuela
            for (const esc of createdEscuelas) {
                await prisma.entrega.create({
                    data: { escuelaId: esc.id, periodoEntregaId: periodo.id },
                });
                totalEntregas++;
            }
        } else if (prog.tipo === TipoPeriodo.SEMESTRAL) {
            // PAEC-PEC: 2 periodos (semestre 1 y 2)
            for (const sem of [1, 2]) {
                const fechaLimite = sem === 1
                    ? new Date("2026-01-31T23:59:59Z")
                    : new Date("2026-07-15T23:59:59Z");

                const periodo = await prisma.periodoEntrega.create({
                    data: {
                        cicloEscolarId: ciclo.id,
                        programaId: prog.id,
                        semestre: sem,
                        activo: true,
                        fechaLimite,
                    },
                });
                totalPeriodos++;

                for (const esc of createdEscuelas) {
                    await prisma.entrega.create({
                        data: { escuelaId: esc.id, periodoEntregaId: periodo.id },
                    });
                    totalEntregas++;
                }
            }
        } else if (prog.tipo === TipoPeriodo.MENSUAL) {
            if (prog.nombre === "Día Naranja") {
                // Día Naranja: activo todos los meses, fecha límite el 25
                for (const { mes, año } of MESES_CICLO) {
                    const periodo = await prisma.periodoEntrega.create({
                        data: {
                            cicloEscolarId: ciclo.id,
                            programaId: prog.id,
                            mes,
                            activo: true,
                            fechaLimite: new Date(`${año}-${String(mes).padStart(2, "0")}-25T23:59:59Z`),
                        },
                    });
                    totalPeriodos++;

                    for (const esc of createdEscuelas) {
                        await prisma.entrega.create({
                            data: { escuelaId: esc.id, periodoEntregaId: periodo.id },
                        });
                        totalEntregas++;
                    }
                }
            } else {
                // Cultura de Paz: periodos creados pero NO activos (ATP los activa)
                for (const { mes } of MESES_CICLO) {
                    const periodo = await prisma.periodoEntrega.create({
                        data: {
                            cicloEscolarId: ciclo.id,
                            programaId: prog.id,
                            mes,
                            activo: false, // ATP activa manualmente
                        },
                    });
                    totalPeriodos++;

                    for (const esc of createdEscuelas) {
                        await prisma.entrega.create({
                            data: { escuelaId: esc.id, periodoEntregaId: periodo.id },
                        });
                        totalEntregas++;
                    }
                }
            }
        }
    }

    console.log(`\n✅ Seed completado:`);
    console.log(`   - 1 admin`);
    console.log(`   - ${createdEscuelas.length} escuelas`);
    console.log(`   - ${createdProgramas.length} programas`);
    console.log(`   - ${totalPeriodos} periodos de entrega`);
    console.log(`   - ${totalEntregas} entregas creadas`);
}

main()
    .catch((e) => {
        console.error("❌ Error en seed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
