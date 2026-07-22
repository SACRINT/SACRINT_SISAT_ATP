import Link from "next/link";
import { Wrench, Shield, ArrowRight, Lock } from "lucide-react";

export const metadata = {
    title: "Plataforma en Mantenimiento | SISAT-ATP",
    description: "La plataforma se encuentra en mantenimiento programado. Volveremos muy pronto.",
};

export default function MantenimientoPage() {
    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
            color: "#f8fafc",
            fontFamily: "system-ui, -apple-system, sans-serif",
            padding: "1.5rem",
            textAlign: "center"
        }}>
            <div style={{
                maxWidth: "600px",
                width: "100%",
                background: "rgba(30, 41, 59, 0.7)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "24px",
                padding: "2.5rem 2rem",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1.5rem"
            }}>
                {/* Shield / Wrench Icon */}
                <div style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "20px",
                    background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.5)"
                }}>
                    <Wrench size={40} color="#ffffff" />
                </div>

                <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.4rem 1rem",
                    borderRadius: "9999px",
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    color: "#fbbf24",
                    fontSize: "0.875rem",
                    fontWeight: 600
                }}>
                    <Lock size={14} /> Modo Mantenimiento Activado
                </div>

                <h1 style={{
                    fontSize: "2rem",
                    fontWeight: 800,
                    margin: 0,
                    letterSpacing: "-0.025em",
                    background: "linear-gradient(to right, #ffffff, #94a3b8)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                }}>
                    Plataforma en Mantenimiento
                </h1>

                <p style={{
                    color: "#94a3b8",
                    fontSize: "1.05rem",
                    lineHeight: 1.6,
                    margin: 0
                }}>
                    Estamos realizando actualizaciones programadas para mejorar el rendimiento y la seguridad del <strong>SISAT-ATP</strong>. El acceso regular para escuelas permanecerá suspendido temporalmente.
                </p>

                <div style={{
                    width: "100%",
                    height: "1px",
                    background: "rgba(255, 255, 255, 0.1)",
                    margin: "0.5rem 0"
                }} />

                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    fontSize: "0.875rem",
                    color: "#cbd5e1"
                }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                        <Shield size={16} color="#38bdf8" /> Solo el <strong>Administrador</strong> y la <strong>Escuela de Prueba</strong> pueden ingresar durante esta ventana.
                    </span>
                </div>

                <Link href="/login" style={{
                    marginTop: "0.5rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.75rem 1.5rem",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#ffffff",
                    fontWeight: 600,
                    textDecoration: "none",
                    transition: "all 0.2s ease",
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)"
                }}>
                    Acceso Administrativo / Prueba <ArrowRight size={18} />
                </Link>
            </div>

            <footer style={{ marginTop: "2rem", color: "#64748b", fontSize: "0.85rem" }}>
                SISAT-ATP &copy; {new Date().getFullYear()} — Sistema de Automatización Técnica Pedagógica
            </footer>
        </div>
    );
}
