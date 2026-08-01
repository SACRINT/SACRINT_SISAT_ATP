import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import HorariosClient from "./HorariosClient";
import { verificarRequisitosHorarios } from "@/lib/ia-requisitos";
import Link from "next/link";

export default async function DirectorHorariosPage() {
  const session = await auth();
  const user = session?.user as { role?: string; cct?: string } | undefined;

  if (!session || user?.role !== "director") {
    redirect("/login");
  }

  const cct = user?.cct;
  if (!cct) redirect("/login");

  const escuela = await prisma.escuela.findUnique({ where: { cct } });
  if (!escuela) redirect("/login");

  // ── Verificar permisos del módulo ──────────────────────────────────────────
  const requisitos = await verificarRequisitosHorarios(escuela.id);

  if (!requisitos.puedeUsar) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: "2rem",
      }}>
        <div style={{
          maxWidth: "520px",
          width: "100%",
          background: "white",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
          padding: "2.5rem",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.75rem" }}>
            Acceso Restringido
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#64748b", lineHeight: 1.6, marginBottom: "1.5rem" }}>
            {requisitos.motivoBloqueo ?? "No tienes acceso al Generador de Horarios IA en este momento."}
          </p>
          {!requisitos.tieneApiKey && (
            <Link href="/director" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#2563eb",
              color: "white",
              padding: "0.65rem 1.25rem",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.875rem",
              textDecoration: "none",
              marginBottom: "0.75rem",
            }}>
              🔑 Ir a Ajustes de API IA
            </Link>
          )}
          <br />
          <Link href="/director" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "#64748b",
            fontSize: "0.85rem",
            fontWeight: 600,
            textDecoration: "none",
            marginTop: "0.5rem",
          }}>
            ← Volver al Portal del Director
          </Link>
        </div>
      </div>
    );
  }

  return <HorariosClient escuela={escuela} />;
}
