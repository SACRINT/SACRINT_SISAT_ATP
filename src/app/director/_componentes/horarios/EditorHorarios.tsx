"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Send,
  FileSpreadsheet,
  FileText,
  Lock,
  Unlock,
  RefreshCw,
  Grid,
  Users,
  UserCheck,
  Building2,
  Sliders,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  X
} from "lucide-react";
import toast from "react-hot-toast";
import { exportarHorarioExcel, exportarHorarioPDF } from "@/lib/horarios/exportador";

interface Props {
  escuela: any;
  horarioInicial: any;
  grupos: any[];
  docentes: any[];
  aulas: any[];
  cargas: any[];
  onVolverAWizard: () => void;
}

export default function EditorHorarios({
  escuela,
  horarioInicial,
  grupos,
  docentes,
  aulas,
  cargas,
  onVolverAWizard
}: Props) {
  const [horario, setHorario] = useState<any>(horarioInicial);
  const [vistaTab, setVistaTab] = useState<"GRUPO" | "DOCENTE" | "AULA" | "SUMARIO">("GRUPO");
  
  const [grupoSeleccionadoId, setGrupoSeleccionadoId] = useState<string>(grupos[0]?.id || "");
  const [docenteSeleccionadoId, setDocenteSeleccionadoId] = useState<string>(docentes[0]?.id || "");
  const [aulaSeleccionadaId, setAulaSeleccionadaId] = useState<string>(aulas[0]?.id || "");

  // Control de apertura/cierre del panel del Chat IA (para no tapar la tabla)
  const [mostrarChat, setMostrarChat] = useState<boolean>(true);

  // Chat IA
  const [mensajeChat, setMensajeChat] = useState<string>("");
  const [enviandoChat, setEnviandoChat] = useState<boolean>(false);
  const [chatHistorial, setChatHistorial] = useState<any[]>(horarioInicial?.mensajesChat || []);

  const diasLectivos = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
  
  // Número de periodos por día dinámico (default 6)
  const numHorasPorDia = horarioInicial?.config?.horasPorDia || horario?.config?.horasPorDia || 6;
  const periodos = Array.from({ length: numHorasPorDia }, (_, i) => i + 1);

  const handleEnviarMensajeIA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensajeChat.trim() || enviandoChat) return;

    const userMsg = mensajeChat.trim();
    setMensajeChat("");
    setEnviandoChat(true);

    setChatHistorial((prev) => [...prev, { role: "user", content: userMsg }]);

    try {
      const res = await fetch("/api/horarios/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horarioId: horario.id,
          mensaje: userMsg
        })
      });

      const data = await res.json();
      if (data.success) {
        setHorario(data.horario);
        setChatHistorial(data.horario.mensajesChat || []);
        toast.success("Ajuste procesado por el Asistente IA");
      } else {
        toast.error(data.error || "Error al procesar mensaje");
      }
    } catch (err) {
      toast.error("Error de conexión con el chat de IA");
    } finally {
      setEnviandoChat(false);
    }
  };

  const getCeldaInfo = (diaSemana: number, periodo: number) => {
    if (!horario?.celdas) return null;

    if (vistaTab === "GRUPO") {
      return horario.celdas.find(
        (c: any) => c.diaSemana === diaSemana && c.periodo === periodo && c.grupoId === grupoSeleccionadoId
      );
    } else if (vistaTab === "DOCENTE") {
      return horario.celdas.find(
        (c: any) => c.diaSemana === diaSemana && c.periodo === periodo && c.docenteId === docenteSeleccionadoId
      );
    } else if (vistaTab === "AULA") {
      return horario.celdas.find(
        (c: any) => c.diaSemana === diaSemana && c.periodo === periodo && c.aulaId === aulaSeleccionadaId
      );
    }
    return null;
  };

  const handleExportar = (formato: "PDF" | "EXCEL") => {
    let tituloTabla = "";
    const filasExport: any[] = [];

    if (vistaTab === "GRUPO") {
      const g = grupos.find((item) => item.id === grupoSeleccionadoId);
      tituloTabla = `Horario por Grupo: ${g?.nombre || "Grupo"}`;
      
      const celdasMapa: any = {};
      for (let d = 1; d <= 5; d++) {
        for (let p = 1; p <= numHorasPorDia; p++) {
          const celda = horario?.celdas.find(
            (c: any) => c.diaSemana === d && c.periodo === p && c.grupoId === grupoSeleccionadoId
          );
          if (celda) {
            celdasMapa[`${d}_${p}`] = `${celda.docente?.nombre || ""} (${celda.asignaturaId})`;
          }
        }
      }

      filasExport.push({
        encabezado: g?.nombre || "Grupo",
        celdas: celdasMapa
      });
    } else {
      tituloTabla = "Sumario General de Horarios del Plantel";
      for (const g of grupos) {
        const celdasMapa: any = {};
        for (let d = 1; d <= 5; d++) {
          for (let p = 1; p <= numHorasPorDia; p++) {
            const celda = horario?.celdas.find(
              (c: any) => c.diaSemana === d && c.periodo === p && c.grupoId === g.id
            );
            if (celda) {
              celdasMapa[`${d}_${p}`] = `${celda.docente?.nombre || ""}`;
            }
          }
        }
        filasExport.push({
          encabezado: `Grupo ${g.nombre}`,
          celdas: celdasMapa
        });
      }
    }

    const payload: any = {
      nombreEscuela: escuela.nombre,
      cct: escuela.cct || "CCT",
      tipoVista: vistaTab,
      tituloTabla,
      dias: diasLectivos,
      periodos: periodos.map((p) => `Hora ${p}`),
      filas: filasExport
    };

    if (formato === "EXCEL") {
      exportarHorarioExcel(payload);
      toast.success("Horario exportado a Excel");
    } else {
      exportarHorarioPDF(payload);
      toast.success("Generando reporte PDF...");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%" }}>
      {/* Barra de Controles Superior */}
      <div style={{ background: "white", padding: "1rem", borderRadius: "12px", border: "1px solid var(--border)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        {/* Selector de Vista */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={() => setVistaTab("GRUPO")}
            className={`horario-tab-btn ${vistaTab === "GRUPO" ? "active" : ""}`}
          >
            <Users style={{ width: "16px", height: "16px" }} /> Por Grupo
          </button>
          <button
            onClick={() => setVistaTab("DOCENTE")}
            className={`horario-tab-btn ${vistaTab === "DOCENTE" ? "active" : ""}`}
          >
            <UserCheck style={{ width: "16px", height: "16px" }} /> Por Docente
          </button>
          <button
            onClick={() => setVistaTab("AULA")}
            className={`horario-tab-btn ${vistaTab === "AULA" ? "active" : ""}`}
          >
            <Building2 style={{ width: "16px", height: "16px" }} /> Por Aula
          </button>
          <button
            onClick={() => setVistaTab("SUMARIO")}
            className={`horario-tab-btn ${vistaTab === "SUMARIO" ? "active" : ""}`}
          >
            <Grid style={{ width: "16px", height: "16px" }} /> Sumario Maestro
          </button>
        </div>

        {/* Acciones e Impresión */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={() => setMostrarChat(!mostrarChat)}
            style={{
              background: mostrarChat ? "#eff6ff" : "#ffffff",
              color: "#2563eb",
              border: "1px solid #bfdbfe",
              padding: "0.4rem 0.85rem",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.8125rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem"
            }}
          >
            <MessageSquare style={{ width: "15px", height: "15px" }} /> {mostrarChat ? "Ocultar Chat IA" : "Abrir Chat IA"}
          </button>

          <button
            onClick={onVolverAWizard}
            className="btn"
            style={{ background: "var(--bg)", color: "var(--text)", padding: "0.4rem 0.85rem", fontSize: "0.8125rem", minHeight: "auto" }}
          >
            <Sliders style={{ width: "15px", height: "15px" }} /> Reconfigurar
          </button>

          <button
            onClick={() => handleExportar("EXCEL")}
            className="btn btn-outline"
            style={{ borderColor: "#10b981", color: "#059669", padding: "0.4rem 0.85rem", fontSize: "0.8125rem", minHeight: "auto" }}
          >
            <FileSpreadsheet style={{ width: "15px", height: "15px" }} /> Excel
          </button>

          <button
            onClick={() => handleExportar("PDF")}
            className="btn btn-primary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem", minHeight: "auto" }}
          >
            <FileText style={{ width: "15px", height: "15px" }} /> Exportar PDF Oficial
          </button>
        </div>
      </div>

      {/* Selectores de elemento según Tab activa */}
      <div style={{ padding: "0.75rem 1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Filtrar Vista:</span>
        {vistaTab === "GRUPO" && (
          <select
            value={grupoSeleccionadoId}
            onChange={(e) => setGrupoSeleccionadoId(e.target.value)}
            style={{ padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "white", fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}
          >
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>Grupo {g.nombre}</option>
            ))}
          </select>
        )}

        {vistaTab === "DOCENTE" && (
          <select
            value={docenteSeleccionadoId}
            onChange={(e) => setDocenteSeleccionadoId(e.target.value)}
            style={{ padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "white", fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}
          >
            {docentes.map((d) => (
              <option key={d.id} value={d.id}>{d.nombre} {d.apellidoPaterno}</option>
            ))}
          </select>
        )}

        {vistaTab === "AULA" && (
          <select
            value={aulaSeleccionadaId}
            onChange={(e) => setAulaSeleccionadaId(e.target.value)}
            style={{ padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "white", fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}
          >
            {aulas.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre} ({a.tipo})</option>
            ))}
          </select>
        )}
      </div>

      {/* Distribución Flex: Tabla al 100% de visibilidad (Lunes a Viernes) y Chat en panel lateral deslizable */}
      <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", width: "100%" }}>
        {/* PANEL IZQUIERDO: Cuadrícula interactiva completa sin cortes */}
        <div style={{ flex: 1, minWidth: 0, background: "white", borderRadius: "16px", border: "1px solid var(--border)", padding: "1.25rem", boxShadow: "var(--shadow)" }}>
          <table className="horario-grid-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "12%", padding: "0.6rem 0.5rem" }}>Periodo</th>
                {diasLectivos.map((d, i) => (
                  <th key={i} style={{ width: "17.6%", padding: "0.6rem 0.5rem" }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodos.map((p) => (
                <tr key={p}>
                  <td style={{ background: "var(--bg)", textAlign: "center", fontWeight: 800, fontSize: "0.8125rem", color: "var(--text)", border: "1px solid #cbd5e1" }}>
                    Hora {p}
                  </td>
                  {[1, 2, 3, 4, 5].map((dia) => {
                    const celda = getCeldaInfo(dia, p);
                    return (
                      <td key={dia} style={{ border: "1px solid #cbd5e1", height: "70px", padding: "0.35rem", verticalAlign: "top" }}>
                        {celda ? (
                          <div className="horario-celda-box" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.35rem", borderRadius: "6px" }}>
                            <div>
                              <p style={{ fontSize: "0.75rem", fontWeight: 900, color: "#15803d", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {celda.docente?.nombre ? `${celda.docente.nombre} ${celda.docente.apellidoPaterno || ""}` : "Docente"}
                              </p>
                              <p style={{ fontSize: "0.7rem", fontWeight: 800, color: "#1d4ed8", margin: "0.15rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {celda.asignatura?.uacName || celda.asignaturaId}
                              </p>
                              <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b", margin: 0 }}>
                                Grupo {celda.grupo?.nombre}
                              </p>
                            </div>
                            {celda.esBloqueado && (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.65rem", fontWeight: 800, color: "#b45309" }}>
                                <Lock style={{ width: "12px", height: "12px" }} /> Fijado
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic" }}>
                            Libre
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PANEL DERECHO: Chat IA Asistente Deslizable */}
        {mostrarChat && (
          <div style={{ width: "340px", flexShrink: 0, background: "#0f172a", borderRadius: "16px", border: "1px solid #334155", padding: "1.25rem", display: "flex", flexDirection: "column", height: "600px", boxShadow: "0 10px 25px rgba(0,0,0,0.3)" }}>
            <div style={{ borderBottom: "1px solid #334155", paddingBottom: "0.75rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Sparkles style={{ width: "20px", height: "20px", color: "#60a5fa" }} />
                <div>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "white", margin: 0 }}>Asistente IA de Horarios</h3>
                  <p style={{ fontSize: "0.65rem", color: "#94a3b8", margin: 0 }}>Gemini 3.5 Flash Lite | SISAT-ATP Pool</p>
                </div>
              </div>
              <button
                onClick={() => setMostrarChat(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X style={{ width: "18px", height: "18px" }} />
              </button>
            </div>

            {/* Historial de Mensajes */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", paddingRight: "0.25rem" }}>
              <div style={{ background: "rgba(30, 41, 59, 0.8)", padding: "0.75rem", borderRadius: "10px", border: "1px solid #334155", fontSize: "0.75rem", color: "#cbd5e1" }}>
                💡 <strong>Directiva:</strong> Pide cualquier ajuste en lenguaje natural. Ej: <em>"Mueve la clase de Química del lunes 1ª hora al martes 3ª hora"</em> o <em>"El profesor Juan Pérez no puede venir los viernes"</em>.
              </div>

              {chatHistorial.map((msg: any, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "12px",
                    background: msg.role === "user" ? "#2563eb" : "#1e293b",
                    color: "white",
                    fontSize: "0.8125rem",
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "90%",
                    border: msg.role === "user" ? "none" : "1px solid #334155"
                  }}
                >
                  {msg.content}
                </div>
              ))}
            </div>

            {/* Input del Chat */}
            <form onSubmit={handleEnviarMensajeIA} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <input
                type="text"
                placeholder="Escribe una instrucción para la IA..."
                value={mensajeChat}
                onChange={(e) => setMensajeChat(e.target.value)}
                style={{
                  flex: 1,
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  padding: "0.5rem 0.75rem",
                  color: "white",
                  fontSize: "0.8125rem"
                }}
              />
              <button
                type="submit"
                disabled={enviandoChat}
                style={{
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.5rem 0.75rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Send style={{ width: "16px", height: "16px" }} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
