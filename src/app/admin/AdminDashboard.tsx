"use client";

import { signOut } from "next-auth/react";
import {
    BarChart3,
    CheckCircle2,
    Clock,
    XCircle,
    AlertTriangle,
    Eye,
    LogOut,
    School,
    FileText,
    ChevronDown,
    ChevronUp,
    MessageSquare,
    Send,
    Upload,
    ToggleLeft,
    ToggleRight,
    Calendar,
    Download,
    Layers,
    Search,
    UserCog,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import GestionEscuelas from "./_componentes/GestionEscuelas";
import GestionFechas from "./_componentes/GestionFechas";
import GestionRecursos from "./_componentes/GestionRecursos";
import GestionProgramas from "./_componentes/GestionProgramas";
import GestionATPs from "./_componentes/GestionATPs";
import VistaGeneral from "./_componentes/VistaGeneral";
import ListadoEscuelas from "./_componentes/ListadoEscuelas";
import ListadoProgramas from "./_componentes/ListadoProgramas";
import GestionPeriodos from "./_componentes/GestionPeriodos";

import { ProgramaAdmin, EscuelaAdmin, Stats } from "@/types";

import { MESES, ESTADOS, ESTADO_LABELS, ESTADO_COLORS } from "@/lib/constants";

export default function AdminDashboard({
    programas,
    escuelas,
    recursos,
    stats,
    ciclo,
    cicloId,
    anuncioGlobal,
    userName,
    dbRole,
}: {
    programas: ProgramaAdmin[];
    escuelas: EscuelaAdmin[];
    recursos: Record<string, unknown>[];
    stats: Stats;
    ciclo: string;
    userName: string;
    dbRole: string;
    cicloId: string;
    anuncioGlobal: string | null;
}) {
    const [vista, setVista] = useState<"general" | "escuelas" | "programas" | "gestion-escuelas" | "gestion-programas" | "gestion-periodos" | "gestion-fechas" | "recursos" | "gestion-atps">("general");
    const [correccionModal, setCorreccionModal] = useState<{ entregaId: string; escuelaNombre: string; history?: any[] } | null>(null);
    const [correccionTexto, setCorreccionTexto] = useState("");
    const [correccionFile, setCorreccionFile] = useState<File | null>(null);

    const [sendingCorreccion, setSendingCorreccion] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const router = useRouter();

    async function handleSaveAnuncio(nuevoAnuncio: string) {
        try {
            const res = await fetch("/api/ciclos/anuncio", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ anuncioGlobal: nuevoAnuncio }),
            });
            if (res.ok) {
                setMessage({ type: "success", text: "Anuncio global actualizado" });
                router.refresh();
                return true;
            } else {
                setMessage({ type: "error", text: "Error al actualizar anuncio" });
                return false;
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
            return false;
        }
    }

    const entregadas = stats.totalEntregas - stats.noEntregadas;
    const porcentaje = stats.totalEntregas > 0 ? Math.round((entregadas / stats.totalEntregas) * 100) : 0;

    const exportToExcel = () => {
        try {
            const rows: any[] = [];
            escuelas.forEach(esc => {
                esc.entregas.forEach(ent => {
                    const programa = ent.periodoEntrega?.programa?.nombre || "N/A";
                    let periodoName = "Anual";
                    if (ent.periodoEntrega?.mes) periodoName = MESES[ent.periodoEntrega.mes];
                    else if (ent.periodoEntrega?.semestre) periodoName = `Semestre ${ent.periodoEntrega.semestre}`;

                    rows.push({
                        "CCT": esc.cct,
                        "Escuela": esc.nombre,
                        "Programa": programa,
                        "Periodo": periodoName,
                        "Estado": ESTADO_LABELS[ent.estado] || ent.estado,
                        "Archivos Subidos": ent.archivos.length,
                    });
                });
            });

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Avance Global");
            XLSX.writeFile(workbook, `Reporte_SISAT_${new Date().toISOString().split("T")[0]}.xlsx`);
            setMessage({ type: "success", text: "Reporte Excel generado exitosamente." });
        } catch (error) {
            console.error("Error exporting to excel:", error);
            setMessage({ type: "error", text: "Hubo un error al generar el archivo Excel." });
        }
    };

    async function handleSendCorreccion() {
        if (!correccionModal || (!correccionTexto.trim() && !correccionFile)) return;
        setSendingCorreccion(true);

        try {
            let uploadedFileData = null;

            if (correccionFile) {
                // 1. Get signature for subfolder _correcciones
                const signRes = await fetch("/api/sign-cloudinary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        entregaId: correccionModal.entregaId,
                        subfolder: "_correcciones",
                        originalFilename: correccionFile.name
                    })
                });

                if (!signRes.ok) throw new Error("Error obteniendo firma para subir archivo");
                const { signature, timestamp, folder, apiKey, cloudName, publicId } = await signRes.json();

                // 2. Direct upload to Cloudinary
                const formData = new FormData();
                formData.append("file", correccionFile);
                formData.append("api_key", apiKey);
                formData.append("timestamp", timestamp.toString());
                formData.append("signature", signature);
                formData.append("folder", folder);
                if (publicId) formData.append("public_id", publicId);

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                    method: "POST",
                    body: formData
                });

                if (!uploadRes.ok) throw new Error("Error subiendo el archivo de corrección a la nube");
                const uploadData = await uploadRes.json();

                uploadedFileData = {
                    name: correccionFile.name,
                    url: uploadData.secure_url,
                    publicId: uploadData.public_id
                };
            }

            // 3. Confirm with backend
            const res = await fetch(`/api/entregas/${correccionModal.entregaId}/correcciones`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    texto: correccionTexto.trim() || null,
                    fileData: uploadedFileData
                }),
            });

            if (res.ok) {
                setMessage({ type: "success", text: "Corrección enviada" });
                setCorreccionModal(null);
                setCorreccionTexto("");
                setCorreccionFile(null);
                router.refresh();
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Error al guardar corrección" });
            }
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Error de conexión" });
        } finally {
            setSendingCorreccion(false);
        }
    }


    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className="admin-sidebar">
                <div className="admin-sidebar-header" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.25rem", padding: "1.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <BarChart3 size={24} />
                        <span style={{ fontSize: "0.9375rem", fontWeight: "bold" }}>SISAT-ATP</span>
                    </div>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", lineHeight: 1.2 }}>
                        Sistema Inteligente de Supervisión<br />y Automatización Técnica
                    </span>
                </div>
                <div className="admin-sidebar-nav">
                    <button className={`sidebar-link ${vista === "general" ? "active" : ""}`} onClick={() => setVista("general")}>
                        <BarChart3 size={18} /> Vista General
                    </button>
                    <button className={`sidebar-link ${vista === "escuelas" ? "active" : ""}`} onClick={() => setVista("escuelas")}>
                        <CheckCircle2 size={18} /> Avance Escuelas
                    </button>
                    <button className={`sidebar-link ${vista === "programas" ? "active" : ""}`} onClick={() => setVista("programas")}>
                        <FileText size={18} /> Avance Programas
                    </button>

                    <div style={{ margin: "1rem 0 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", paddingLeft: "0.5rem" }}>Administración</div>

                    <button className={`sidebar-link ${vista === "gestion-escuelas" ? "active" : ""}`} onClick={() => setVista("gestion-escuelas")}>
                        <School size={18} /> Gestión de Escuelas
                    </button>
                    <button className={`sidebar-link ${vista === "gestion-programas" ? "active" : ""}`} onClick={() => setVista("gestion-programas")}>
                        <Layers size={18} /> Gestión de Programas
                    </button>
                    <button className={`sidebar-link ${vista === "gestion-periodos" ? "active" : ""}`} onClick={() => setVista("gestion-periodos")}>
                        <Clock size={18} /> Activar Periodos
                    </button>
                    <button className={`sidebar-link ${vista === "gestion-fechas" ? "active" : ""}`} onClick={() => setVista("gestion-fechas")}>
                        <Calendar size={18} /> Fechas y Tareas
                    </button>
                    <button className={`sidebar-link ${vista === "recursos" ? "active" : ""}`} onClick={() => setVista("recursos")}>
                        <Upload size={18} /> Formatos y Plantillas
                    </button>
                    {dbRole === "SUPER_ADMIN" && (
                        <button className={`sidebar-link ${vista === "gestion-atps" ? "active" : ""}`} onClick={() => setVista("gestion-atps")}>
                            <UserCog size={18} /> Accesos y Seguridad
                        </button>
                    )}
                </div>
                <div className="admin-sidebar-footer">
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.5rem", paddingLeft: "0.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        Conectado como <br /><strong>{userName}</strong>
                    </div>
                    <button
                        className="btn btn-outline btn-block"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        style={{ fontSize: "0.8125rem", padding: "0.5rem", minHeight: "auto", marginTop: "0.5rem" }}
                    >
                        <LogOut size={16} /> Salir
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="admin-content fade-in">
                {message && (
                    <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1rem" }}>
                        {message.text}
                        <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                    </div>
                )}

                {/* ========= VISTA: VISTA GENERAL ========= */}
                {vista === "general" && (
                    <VistaGeneral
                        stats={stats}
                        ciclo={ciclo}
                        totalEscuelas={escuelas.length}
                        anuncioGlobal={anuncioGlobal}
                        onSaveAnuncio={handleSaveAnuncio}
                        onExportExcel={exportToExcel}
                    />
                )}

                {/* ========= VISTA: ESCUELAS ========= */}
                {vista === "escuelas" && (
                    <ListadoEscuelas
                        escuelas={escuelas}
                        onSetMessage={setMessage}
                        onSetCorreccionModal={setCorreccionModal}
                    />
                )}

                {/* ========= VISTA: PROGRAMAS ========= */}
                {vista === "programas" && (
                    <ListadoProgramas
                        programas={programas}
                        onSetMessage={setMessage}
                        onSetCorreccionModal={setCorreccionModal}
                    />
                )}

                {/* ========= VISTA: GESTIÓN DE PERIODOS ========= */}
                {vista === "gestion-periodos" && (
                    <GestionPeriodos programas={programas} />
                )}
                {/* ========= VISTA: GESTIÓN DE FECHAS Y TAREAS EXTRAORDINARIAS ========= */}
                {vista === "gestion-fechas" && (
                    <GestionFechas programas={programas} />
                )}
                {/* ========= VISTA: GESTIÓN DE ESCUELAS ========= */}
                {
                    vista === "gestion-escuelas" && (
                        <GestionEscuelas inicialEscuelas={escuelas.map(e => ({
                            id: e.id,
                            cct: e.cct,
                            nombre: e.nombre,
                            director: e.director ?? null,
                            email: e.email ?? null,
                            ultimoIngreso: e.ultimoIngreso ?? null
                        }))} />
                    )
                }

                {/* ========= VISTA: GESTIÓN DE PROGRAMAS ========= */}
                {
                    vista === "gestion-programas" && (
                        <GestionProgramas inicialProgramas={programas} />
                    )
                }

                {/* ========= VISTA: RECURSOS Y FORMATOS ========= */}
                {
                    vista === "recursos" && (
                        <GestionRecursos recursos={recursos} programas={programas} />
                    )
                }

                {/* ========= VISTA: USUARIOS ATP (ACCESOS Y SEGURIDAD) ========= */}
                {
                    vista === "gestion-atps" && (
                        <GestionATPs />
                    )
                }
            </main >

            {/* Correction Modal */}
            {
                correccionModal && (
                    <div style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "1rem", zIndex: 1000,
                    }}>
                        <div className="card" style={{ maxWidth: "500px", width: "100%" }}>
                            <h3 style={{ marginBottom: "0.5rem" }}>
                                <MessageSquare size={20} /> Enviar Corrección
                            </h3>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                                Para: <strong>{correccionModal.escuelaNombre}</strong>
                            </p>

                            {correccionModal.history && correccionModal.history.length > 0 && (
                                <div style={{
                                    maxHeight: "200px", overflowY: "auto", marginBottom: "1rem",
                                    padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border)",
                                }}>
                                    <h4 style={{ fontSize: "0.8125rem", margin: "0 0 0.5rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        Historial de Correcciones
                                    </h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                        {correccionModal.history.map((hist) => (
                                            <div key={hist.id} style={{ fontSize: "0.8125rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                                                    <strong>{hist.admin?.nombre || "ATP"}</strong>
                                                    <span>{new Date(hist.createdAt).toLocaleDateString()} {new Date(hist.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                </div>
                                                <div style={{ color: "var(--text)" }}>{hist.texto || <em style={{ color: "var(--text-muted)" }}>[Sin texto, solo adjunto]</em>}</div>
                                                {hist.archivo && hist.archivo.driveUrl && (
                                                    <a
                                                        href={hist.archivo.driveUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginTop: "0.25rem", color: "var(--primary)", textDecoration: "none", fontWeight: 500 }}
                                                    >
                                                        <FileText size={12} /> {hist.archivo.nombre}
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <textarea
                                value={correccionTexto}
                                onChange={(e) => setCorreccionTexto(e.target.value)}
                                placeholder="Escribe las correcciones necesarias..."
                                style={{
                                    width: "100%", minHeight: "120px", padding: "0.75rem",
                                    borderRadius: "8px", border: "1px solid var(--border)",
                                    fontFamily: "inherit", fontSize: "0.875rem", resize: "vertical",
                                }}
                            />

                            <div style={{ marginTop: "1rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                                    Adjuntar Archivo de Corrección (Opcional)
                                </label>
                                <input
                                    type="file"
                                    className="form-control"
                                    onChange={(e) => setCorreccionFile(e.target.files ? e.target.files[0] : null)}
                                    style={{ padding: "0.5rem", fontSize: "0.875rem" }}
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.png"
                                />
                            </div>

                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => { setCorreccionModal(null); setCorreccionTexto(""); setCorreccionFile(null); }}
                                    style={{ flex: 1 }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSendCorreccion}
                                    disabled={sendingCorreccion || (!correccionTexto.trim() && !correccionFile)}
                                    style={{ flex: 1 }}
                                >
                                    {sendingCorreccion ? "Enviando..." : (
                                        <><Send size={16} /> Enviar</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
