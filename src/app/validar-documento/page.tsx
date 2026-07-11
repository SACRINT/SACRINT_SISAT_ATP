import { prisma } from "@/lib/db";
import { ShieldCheck, XCircle, Search } from "lucide-react";

interface ValidarPageProps {
    searchParams: Promise<{ cvd?: string }>;
}

export default async function ValidarDocumentoPage({ searchParams }: ValidarPageProps) {
    const params = await searchParams;
    const cvd = params.cvd?.trim() || "";

    let entrega: any = null;
    let errorMsg = "";

    if (cvd) {
        try {
            entrega = await prisma.entrega.findFirst({
                where: { cvd },
                include: {
                    escuela: true,
                    periodoEntrega: {
                        include: {
                            programa: true,
                            cicloEscolar: true,
                        },
                    },
                },
            });

            if (!entrega) {
                errorMsg = "El código CVD ingresado no existe en nuestro registro oficial.";
            } else if (entrega.estado !== "APROBADO") {
                errorMsg = "El documento asociado a este código se encuentra registrado pero no cuenta con estatus de APROBADO por la Supervisión.";
            }
        } catch (err) {
            console.error(err);
            errorMsg = "Ocurrió un error técnico al validar el documento. Intente más tarde.";
        }
    }

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "2rem 1rem"
        }}>
            {/* Header */}
            <header style={{ textAlign: "center", marginBottom: "2.5rem" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#1e3a8a", letterSpacing: "-0.05em" }}>SISAT</span>
                    <span style={{ fontSize: "1.75rem", fontWeight: 300, color: "#0284c7" }}>ATP</span>
                </div>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b", fontWeight: 700 }}>
                    Módulo de Verificación de Validez Oficial
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.15rem" }}>
                    Zona Escolar 004 • Bachilleratos Generales
                </div>
            </header>

            {/* Main Card */}
            <main style={{
                maxWidth: "600px",
                width: "100%",
                background: "white",
                borderRadius: "16px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
                padding: "2rem",
                boxSizing: "border-box",
                border: "1px solid #e5e7eb"
            }}>
                <h2 style={{ margin: "0 0 1.25rem", fontSize: "1.25rem", color: "#1f2937", fontWeight: 700, textAlign: "center" }}>
                    Validar Documento Oficial
                </h2>

                {/* Form to enter CVD */}
                <form method="GET" style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                        <span style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af", display: "flex" }}>
                            <Search size={16} />
                        </span>
                        <input
                            type="text"
                            name="cvd"
                            placeholder="CVD-21EBHXXXX-XXXX"
                            defaultValue={cvd}
                            required
                            style={{
                                width: "100%",
                                padding: "0.75rem 1rem 0.75rem 2.25rem",
                                borderRadius: "8px",
                                border: "1px solid #d1d5db",
                                boxSizing: "border-box",
                                outline: "none",
                                fontSize: "0.9rem",
                                fontFamily: "monospace",
                                textTransform: "uppercase"
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        style={{
                            background: "#1d4ed8",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            padding: "0 1.25rem",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 4px rgba(29, 78, 216, 0.2)"
                        }}
                    >
                        Verificar
                    </button>
                </form>

                {/* Validation Results */}
                {cvd ? (
                    entrega ? (
                        /* SUCCESS BLOCK */
                        <div style={{ animation: "fadeIn 0.4s ease" }}>
                            <div style={{
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                borderRadius: "12px",
                                padding: "1.25rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.85rem",
                                marginBottom: "1.5rem"
                            }}>
                                <span style={{ color: "#15803d", display: "flex" }}>
                                    <ShieldCheck size={36} />
                                </span>
                                <div>
                                    <div style={{ color: "#14532d", fontWeight: 800, fontSize: "0.95rem" }}>
                                        ✓ DOCUMENTO VÁLIDO Y AUTÉNTICO
                                    </div>
                                    <div style={{ color: "#166534", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                                        Este certificado avala la aprobación oficial por parte de la Supervisión Escolar.
                                    </div>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.875rem" }}>
                                <div style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: "0.75rem" }}>
                                    <div style={{ color: "#6b7280", fontSize: "0.725rem", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.25rem" }}>
                                        🏫 Institución Educativa
                                    </div>
                                    <div style={{ color: "#1f2937", fontWeight: 700, fontSize: "0.95rem" }}>
                                        {entrega.escuela.nombre}
                                    </div>
                                    <div style={{ color: "#4b5563", fontSize: "0.8rem", marginTop: "0.1rem", fontFamily: "monospace" }}>
                                        Clave C.C.T: {entrega.escuela.cct}
                                    </div>
                                </div>

                                <div style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: "0.75rem" }}>
                                    <div style={{ color: "#6b7280", fontSize: "0.725rem", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.25rem" }}>
                                        📄 Documento Entregado
                                    </div>
                                    <div style={{ color: "#1f2937", fontWeight: 700 }}>
                                        {entrega.periodoEntrega.programa.nombre}
                                    </div>
                                    <div style={{ color: "#4b5563", fontSize: "0.8rem", marginTop: "0.1rem" }}>
                                        Periodo: {entrega.periodoEntrega.mes
                                            ? ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][entrega.periodoEntrega.mes]
                                            : entrega.periodoEntrega.semestre
                                                ? `Semestre ${entrega.periodoEntrega.semestre}`
                                                : "Ciclo Completo"
                                        } • Ciclo Escolar: {entrega.periodoEntrega.cicloEscolar.nombre}
                                    </div>
                                </div>

                                <div style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: "0.75rem" }}>
                                    <div style={{ color: "#6b7280", fontSize: "0.725rem", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.25rem" }}>
                                        ✍️ Firma de Aprobación
                                    </div>
                                    <div style={{ color: "#1f2937", fontWeight: 700 }}>
                                        Ing. Alejandro Escamilla Martínez
                                    </div>
                                    <div style={{ color: "#4b5563", fontSize: "0.8rem" }}>
                                        Supervisor de Bachilleratos Zona 004
                                    </div>
                                </div>

                                <div style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: "0.75rem" }}>
                                    <div style={{ color: "#6b7280", fontSize: "0.725rem", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.25rem" }}>
                                        📅 Fecha de Aprobación
                                    </div>
                                    <div style={{ color: "#1f2937", fontWeight: 500 }}>
                                        {entrega.fechaRevision
                                            ? new Date(entrega.fechaRevision).toLocaleDateString("es-MX", {
                                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })
                                            : "Fecha no registrada"
                                        }
                                    </div>
                                </div>

                                <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                                    <div style={{ color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, fontFamily: "monospace", marginBottom: "0.15rem" }}>
                                        🔐 Firma Criptográfica (SHA-256)
                                    </div>
                                    <div style={{ color: "#334155", fontFamily: "monospace", fontSize: "0.725rem", wordBreak: "break-all", fontWeight: 600 }}>
                                        {entrega.firmaDigital}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ERROR BLOCK */
                        <div style={{
                            background: "#fff5f5",
                            border: "1px solid #feb2b2",
                            borderRadius: "12px",
                            padding: "1.5rem",
                            textAlign: "center",
                            animation: "fadeIn 0.4s ease"
                        }}>
                            <span style={{ color: "#e53e3e", display: "inline-flex", marginBottom: "0.75rem", alignItems: "center", justifyContent: "center" }}>
                                <XCircle size={40} />
                            </span>
                            <h3 style={{ color: "#9b2c2c", margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700 }}>
                                Validación Fallida
                            </h3>
                            <p style={{ color: "#c53030", fontSize: "0.85rem", margin: 0, lineHeight: 1.5 }}>
                                {errorMsg}
                            </p>
                        </div>
                    )
                ) : (
                    /* INITIAL VIEW (NO CVD ENTERED YET) */
                    <div style={{ textAlign: "center", color: "#6b7280", padding: "1rem 0", fontSize: "0.875rem", lineHeight: 1.5 }}>
                        <p style={{ margin: "0 0 0.5rem" }}>
                            Ingrese el código de verificación CVD ubicado al calce del dictamen oficial o escanee el código QR para validar su autenticidad de manera digital.
                        </p>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "#9ca3af" }}>
                            Ejemplo: <code>CVD-21EBH0088T-A4B7</code>
                        </p>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer style={{ marginTop: "3rem", fontSize: "0.75rem", color: "#94a3b8", textAlign: "center" }}>
                © {new Date().getFullYear()} SISAT-ATP. Todos los derechos reservados.<br />
                Gobierno del Estado de Puebla • Secretaría de Educación Pública
            </footer>
        </div>
    );
}
