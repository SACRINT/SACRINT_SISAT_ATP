import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Find DATABASE_URL
env_path = os.path.join(os.path.dirname(__file__), "../.env")
db_url = None
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                db_url = line.split("=")[1].strip().strip('"').strip("'")
                break

if not db_url:
    print("DATABASE_URL not found")
    exit(1)

conn = psycopg2.connect(db_url)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("""
    SELECT pr.id, pr."entregaId", pr."updatedAt", esc.nombre as escuela, prog.nombre as programa, pr.resultado
    FROM "PreRevision" pr
    JOIN "Entrega" ent ON pr."entregaId" = ent.id
    JOIN "Escuela" esc ON ent."escuelaId" = esc.id
    JOIN "PeriodoEntrega" pe ON ent."periodoEntregaId" = pe.id
    JOIN "Programa" prog ON pe."programaId" = prog.id
    ORDER BY pr."updatedAt" DESC
""")

rows = cur.fetchall()
print(f"Total PreRevisions in DB: {len(rows)}")
for r in rows:
    res = r["resultado"]
    status = "N/A"
    if res:
        if isinstance(res, dict):
            status = res.get("explicacion", "N/A")
            if "Error" in status or "fallaron" in status:
                status = "❌ ERROR: " + status[:100]
            else:
                status = "✅ SUCCESS: " + status[:100]
        else:
            status = str(res)[:100]
    print(f"Escuela: {r['escuela']}, Programa: {r['programa']}, Updated: {r['updatedAt']}, Status: {status}")

cur.close()
conn.close()
