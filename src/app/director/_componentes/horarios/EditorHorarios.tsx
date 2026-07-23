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
  AlertTriangle
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

  // Chat IA
  const [mensajeChat, setMensajeChat] = useState<string>("");
  const [enviandoChat, setEnviandoChat] = useState<boolean>(false);
  const [chatHistorial, setChatHistorial] = useState<any[]>(horarioInicial?.mensajesChat || []);

  const diasLectivos = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
  const periodos = [1, 2, 3, 4, 5, 6, 7];

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
        for (let p = 1; p <= 7; p++) {
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
          for (let p = 1; p <= 7; p++) {
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

    const payload = {
      nombreEscuela: escuela?.nombre || "Bachillerato General",
      cct: escuela?.cct || "21EBH0000X",
      tipoVista: vistaTab,
      tituloTabla,
      dias: diasLectivos,
      periodos: periodos.map((p) => `Hora ${p}`),
      filas: filasExport
    };

    if (formato === "EXCEL") {
      exportarHorarioExcel(payload);
    } else {
      exportarHorarioPDF(payload);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Barra Superior de Control y Pestañas */}
      <div className="horario-header">
        {/* Tabs de Filtro */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "var(--bg)", padding: "0.35rem", borderRadius: "12px", border: "1px solid var(--border)" }}>
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

      {/* Panel Dual: 70% Grid Matriz / 30% Chat IA */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
        {/* PANEL IZQUIERDO - Cuadrícula interactiva */}
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid var(--border)", padding: "1.25rem", boxShadow: "var(--shadow)", overflowX: "auto" }}>
          <table className="horario-grid-table">
            <thead>
              <tr>
                <th style={{ width: "90px" }}>Periodo</th>
                {diasLectivos.map((d, i) => (
                  <th key={i}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodos.map((p) => (
                <tr key={p}>
                  <td style={{ background: "var(--bg)", textAlign: "center", fontWeight: 700, fontSize: "0.8125rem", color: "var(--text)" }}>
                    Hora {p}
                  </td>
                  {[1, 2, 3, 4, 5].map((dia) => {
                    const celda = getCeldaInfo(dia, p);
                    return (
                      <td key={dia}>
                        {celda ? (
                          <div className="horario-celda-box">
                            <div>
                              <p style={{ fontSize: "0.75rem", fontWeight: 800, color: "#1e3a8a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {celda.docente?.nombre || "Docente"}
                              </p>
                              <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "#1d4ed8", margin: 0 }}>
                                Grupo: {celda.grupo?.nombre}
                              </p>
                            </div>
                            {celda.esBloqueado && (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.65rem", fontWeight: 800, color: "#b45309" }}>
                                <Lock style={{ width: "12px", height: "12px" }} /> Fijado
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
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

        {/* PANEL DERECHO - Chat IA Asistente */}
        <div className="horario-chat-container">
          <div style={{ borderBottom: "1px solid #334155", paddingBottom: "0.75rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Sparkles style={{ width: "20px", height: "20px", color: "#60a5fa" }} />
            <div>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "white", margin: 0 }}>Asistente IA de Horarios</h3>
              <p style={{ fontSize: "0.65rem", color: "#94a3b8", margin: 0 }}>Gemini 3.5 Flash Lite | SISAT-ATP Pool</p>
            </div>
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
                  fontSize: "0.75rem",
                  maxWidth: "90%",
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  background: msg.role === "user" ? "var(--primary)" : "#1e293b",
                  color: "white",
                  border: msg.role === "user" ? "none" : "1px solid #334155"
                }}
              >
                <p style={{ margin: 0, lineHeight: 1.5 }}>{msg.content}</p>
              </div>
            ))}
          </div>

          {/* Input Chat */}
          <form onSubmit={handleEnviarMensajeIA} style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #334155", display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              placeholder="Escribe una instrucción para la IA..."
              value={mensajeChat}
              onChange={(e) => setMensajeChat(e.target.value)}
              style={{ flex: 1, padding: "0.625rem 0.75rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "10px", fontSize: "0.75rem", color: "white", outline: "none" }}
            />
            <button
              type="submit"
              disabled={enviandoChat}
              className="btn btn-primary"
              style={{ minHeight: "auto", padding: "0.625rem 0.75rem", borderRadius: "10px" }}
            >
              <Send style={{ width: "16px", height: "16px" }} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
