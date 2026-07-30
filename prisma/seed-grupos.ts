import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const escuelasGruposData = [
  { cct: "21EBH0088T", nombre: "ALFONSO DE LA MADRID VIDAURRETA", localidad: "VENUSTIANO CARRANZA", total: 9, g1: 3, g2: 3, g3: 3 },
  { cct: "21EBH0186U", nombre: "AQUILES SERDÁN", localidad: "PANTEPEC", total: 6, g1: 2, g2: 2, g3: 2 },
  { cct: "21EBH0903N", nombre: "BENITO JUÁREZ GARCÍA", localidad: "SAN BARTOLO", total: 3, g1: 1, g2: 1, g3: 1 },
  { cct: "21EBH0464F", nombre: "DAVID ALFARO SIQUEIROS", localidad: "HUITZILAC", total: 3, g1: 1, g2: 1, g3: 1 },
  { cct: "21EBH0789L", nombre: "DAVID ALFARO SIQUEIROS", localidad: "JALTOCAN", total: 3, g1: 1, g2: 1, g3: 1 },
  { cct: "21EBH0708K", nombre: "DIEGO RIVERA", localidad: "EJIDO CAÑADA COLOTLA", total: 3, g1: 1, g2: 1, g3: 1 },
  { cct: "21EBH0608L", nombre: "EMILIANO ZAPATA", localidad: "SAN DIEGO", total: 3, g1: 1, g2: 1, g3: 1 },
  { cct: "21EBH0200X", nombre: "HÉROES DE LA PATRIA", localidad: "CORONEL TITO HDEZ.", total: 9, g1: 3, g2: 3, g3: 3 },
  { cct: "21EBH0620G", nombre: "JAIME SABINES", localidad: "AGUA LINDA", total: 3, g1: 1, g2: 1, g3: 1 },
  { cct: "21EBH0681U", nombre: "JOSÉ IGNACIO GREGORIO COMONFORT", localidad: "PALMA REAL", total: 3, g1: 1, g2: 1, g3: 1 },
  { cct: "21EBH0201W", nombre: "JOSÉ VASCONCELOS", localidad: "LAZARO CARDENAS", total: 15, g1: 5, g2: 5, g3: 5 },
  { cct: "21EBH0799S", nombre: "JUAN ALDAMA", localidad: "NUEVO ZOQUIAPAN", total: 3, g1: 1, g2: 1, g3: 1 },
  { cct: "21EBH0704O", nombre: "LUIS DONALDO COLOSIO MURRIETA", localidad: "LA CEIBA CHICA", total: 3, g1: 1, g2: 1, g3: 1 },
  { cct: "21EBH0214Z", nombre: "MECAPALAPA", localidad: "MECAPALAPA", total: 6, g1: 2, g2: 2, g3: 2 },
  { cct: "21EBH0465E", nombre: "MOISÉS SÁENZ GARZA", localidad: "TECOMATE", total: 3, g1: 1, g2: 1, g3: 1 },
  { cct: "21EBH0130S", nombre: "REYES GARCÍA OLIVARES", localidad: "FCO. Z. MENA", total: 6, g1: 2, g2: 2, g3: 2 },
  { cct: "21ECT0017T", nombre: "TECNOLÓGICO FCO. Z. MENA", localidad: "FCO. Z. MENA", total: 6, g1: 2, g2: 2, g3: 2 },
  { cct: "21EBH0682T", nombre: "VICENTE SUÁREZ FERRER", localidad: "COYOLITO", total: 3, g1: 1, g2: 1, g3: 1 },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not found in .env");
  }

  // Neon unpooled fallback if needed or direct pg Client
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected to Neon DB via pg Client!");

  let updatedCount = 0;

  for (const item of escuelasGruposData) {
    try {
      const res = await client.query(
        `UPDATE "Escuela"
         SET "gruposPrimerAno" = $1,
             "gruposSegundoAno" = $2,
             "gruposTercerAno" = $3,
             "localidad" = COALESCE($4, "localidad")
         WHERE "cct" = $5`,
        [item.g1, item.g2, item.g3, item.localidad, item.cct]
      );

      if (res.rowCount && res.rowCount > 0) {
        console.log(`✅ [${item.cct}] ${item.nombre} -> Grupos: ${item.total} (${item.g1}-${item.g2}-${item.g3})`);
        updatedCount += res.rowCount;
      } else {
        console.warn(`⚠️ CCT ${item.cct} no existía en DB. Creándola...`);
        await client.query(
          `INSERT INTO "Escuela" ("id", "cct", "nombre", "localidad", "email", "password", "gruposPrimerAno", "gruposSegundoAno", "gruposTercerAno", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT ("cct") DO UPDATE
           SET "gruposPrimerAno" = $7, "gruposSegundoAno" = $8, "gruposTercerAno" = $9`,
          [`esc-${item.cct.toLowerCase()}`, item.cct, item.nombre, item.localidad, `${item.cct.toLowerCase()}@escuela.edu.mx`, "$2a$10$wN10cW623a.XhK5M5U1kI.Y6o6b4l1J5Z0.9O5V9o6l", item.g1, item.g2, item.g3]
        );
        console.log(`✨ [${item.cct}] ${item.nombre} creada y configurada con ${item.total} grupos (${item.g1}-${item.g2}-${item.g3})`);
        updatedCount += 1;
      }
    } catch (err: any) {
      console.error(`❌ Error updating ${item.cct}:`, err.message);
    }
  }

  const allSchools = await client.query(`SELECT "cct", "nombre" FROM "Escuela" ORDER BY "nombre" ASC`);
  console.log("\n📋 Escuelas registradas en la base de datos:", allSchools.rows);

  await client.end();
}

main().catch(console.error);
