"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Send,
  FileSpreadsheet,
  FileText,
  Lock,
  Unlock,
  Users,
  UserCheck,
  Building2,
  Grid,
  Sliders,
  MessageSquare,
  X,
  Package,
  Download,
  Check
} from "lucide-react";
import toast from "react-hot-toast";
import { exportarHorarioExcel, exportarHorarioPDF, getHashColor } from "@/lib/horarios/exportador";

interface Props {
  escuela: any;
  horarioInicial: any;
  grupos: any[];
  docentes: any[];
  aulas: any[];
  cargas: any[];
  onVolverAWizard: () => void;
}

const PALETA_ESTILOS: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  green: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  yellow: { bg: "#fefce8", text: "#a16207", border: "#fef08a" },
  orange: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  pink: { bg: "#fdf2f8", text: "#be185d", border: "#fbcfe8" },
  purple: { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  teal: { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4" },
  cyan: { bg: "#ecfeff", text: "#0e7490", border: "#a5f3fc" }
};

const ESTILOS_ARRAY = Object.values(PALETA_ESTILOS);

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

  // Modal de Exportación Avanzada
  const [mostrarModalExportar, setMostrarModalExportar] = useState<boolean>(false);

  // Control de apertura/cierre del panel del Chat IA
  const [mostrarChat, setMostrarChat] = useState<boolean>(true);

  // Chat IA
  const [mensajeChat, setMensajeChat] = useState<string>("");
  const [enviandoChat, setEnviandoChat] = useState<boolean>(false);
  const [chatHistorial, setChatHistorial] = useState<any[]>(horarioInicial?.mensajesChat || []);

  // Estado para Drag and Drop
  const [draggedCelda, setDraggedCelda] = useState<any>(null);

  const diasLectivos = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
  const numHorasPorDia = horarioInicial?.config?.horasPorDia || horario?.config?.horasPorDia || 6;
  const periodos = Array.from({ length: numHorasPorDia }, (_, i) => i + 1);

  // Helper para asignar estilo de color por nombre de UAC
  const getEstiloAsignatura = (uacName: string) => {
    if (!uacName) return ESTILOS_ARRAY[0];
    let hash = 0;
    for (let i = 0; i < uacName.length; i++) {
      hash = uacName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % ESTILOS_ARRAY.length;
    return ESTILOS_ARRAY[idx];
  };

  const getNombreAsignaturaCelda = (celda: any) => {
    if (!celda) return "";
    if (celda.asignatura?.uacName) return celda.asignatura.uacName;
    
    const cargaMatch = cargas.find(c => c.asignaturaId === celda.asignaturaId || c.id === celda.cargaId);
    if (cargaMatch?.uacName) return cargaMatch.uacName;

    return "UAC / Materia";
  };

  const getNombreDocenteCelda = (celda: any) => {
    if (!celda) return "";
    if (celda.docente?.nombre) {
      return `${celda.docente.nombre} ${celda.docente.apellidoPaterno || ""}`.trim();
    }
    const docObj = docentes.find(d => d.id === celda.docenteId);
    if (docObj) {
      return `${docObj.nombre} ${docObj.apellidoPaterno || ""}`.trim();
    }
    return "Docente";
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

  // Bloquear / Desbloquear celda para la IA
  const toggleBloquearCelda = (celda: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!celda || !horario?.celdas) return;

    const estadoNuevo = !celda.esBloqueado;
    const celdasActualizadas = horario.celdas.map((c: any) => {
      if (c.id === celda.id || (c.diaSemana === celda.diaSemana && c.periodo === celda.periodo && c.grupoId === celda.grupoId)) {
        return { ...c, esBloqueado: estadoNuevo };
      }
      return c;
    });

    setHorario({ ...horario, celdas: celdasActualizadas });
    toast.success(estadoNuevo ? "🔒 Celda fijada (la IA no la moverá)" : "Celda desbloqueada para la IA");
  };

  // Chat IA
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

  // Lógica Drag and Drop con Detección de Empalmes
  const handleDragStart = (e: React.DragEvent, celda: any) => {
    if (celda.esBloqueado) {
      e.preventDefault();
      toast.error("🔒 Celda fijada. Desbloquéela antes de moverla.");
      return;
    }
    setDraggedCelda(celda);
    e.dataTransfer.setData("text/plain", celda.id || "");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnSlot = (targetDia: number, targetPeriodo: number) => {
    if (!draggedCelda) return;

    if (draggedCelda.diaSemana === targetDia && draggedCelda.periodo === targetPeriodo) {
      setDraggedCelda(null);
      return;
    }

    // Buscar si hay celda en el slot destino para el mismo grupo
    const targetCelda = horario.celdas.find(
      (c: any) => c.diaSemana === targetDia && c.periodo === targetPeriodo && c.grupoId === draggedCelda.grupoId
    );

    if (targetCelda?.esBloqueado) {
      toast.error("🔒 La casilla de destino tiene una clase fijada.");
      setDraggedCelda(null);
      return;
    }

    // Verificar si el docente de la clase arrastrada ya da clase en targetDia, targetPeriodo en OTRO grupo
    const empalmeDocente = horario.celdas.find(
      (c: any) => c.diaSemana === targetDia &&
                  c.periodo === targetPeriodo &&
                  c.docenteId === draggedCelda.docenteId &&
                  c.grupoId !== draggedCelda.grupoId
    );

    if (empalmeDocente) {
      const docNombre = getNombreDocenteCelda(draggedCelda);
      const grpEmpalme = grupos.find(g => g.id === empalmeDocente.grupoId)?.nombre || empalmeDocente.grupoId;
      toast.error(`⚠️ Empalme detectado: El docente ${docNombre} ya tiene clase el ${diasLectivos[targetDia - 1]} Hora ${targetPeriodo} en el Grupo ${grpEmpalme}.`);
      setDraggedCelda(null);
      return;
    }

    // Intercambio o reubicación limpia
    const celdasActualizadas = horario.celdas.map((c: any) => {
      if (c.id === draggedCelda.id || (c.diaSemana === draggedCelda.diaSemana && c.periodo === draggedCelda.periodo && c.grupoId === draggedCelda.grupoId)) {
        return { ...c, diaSemana: targetDia, periodo: targetPeriodo };
      }
      if (targetCelda && (c.id === targetCelda.id || (c.diaSemana === targetDia && c.periodo === targetPeriodo && c.grupoId === targetCelda.grupoId))) {
        return { ...c, diaSemana: draggedCelda.diaSemana, periodo: draggedCelda.periodo };
      }
      return c;
    });

    setHorario({ ...horario, celdas: celdasActualizadas });
    toast.success(`Materia reubicada a ${diasLectivos[targetDia - 1]} Hora ${targetPeriodo}`);
    setDraggedCelda(null);
  };

  // Motor de Exportación Avanzado PDF & Excel
  const ejecutarExportacion = (opcion: "VISTA_ACTUAL" | "DOCENTE_INDIVIDUAL" | "GRUPO_INDIVIDUAL" | "PAQUETE_DOCENTES" | "PAQUETE_GRUPOS" | "SUMARIO", formato: "PDF" | "EXCEL") => {
    setMostrarModalExportar(false);
    const filasExport: any[] = [];
    let tipoVistaPDF: any = "GRUPO";
    let tituloTabla = "";

    if (opcion === "VISTA_ACTUAL") {
      if (vistaTab === "GRUPO") {
        const g = grupos.find(item => item.id === grupoSeleccionadoId);
        tituloTabla = `HORARIO POR GRUPO: ${g?.nombre || "GRUPO"}`;
        const celdasMapa: any = {};

        for (let d = 1; d <= 5; d++) {
          for (let p = 1; p <= numHorasPorDia; p++) {
            const celda = getCeldaInfo(d, p);
            if (celda) {
              celdasMapa[`${d}_${p}`] = {
                materia: getNombreAsignaturaCelda(celda),
                docente: getNombreDocenteCelda(celda),
                grupo: g?.nombre
              };
            }
          }
        }
        filasExport.push({ encabezado: `GRUPO ${g?.nombre || ""}`, celdas: celdasMapa });
      } else if (vistaTab === "DOCENTE") {
        const dObj = docentes.find(item => item.id === docenteSeleccionadoId);
        const nomDoc = dObj ? `${dObj.nombre} ${dObj.apellidoPaterno || ""}`.trim() : "DOCENTE";
        tituloTabla = `HORARIO PERSONAL DEL DOCENTE: ${nomDoc}`;
        const celdasMapa: any = {};

        for (let d = 1; d <= 5; d++) {
          for (let p = 1; p <= numHorasPorDia; p++) {
            const celda = getCeldaInfo(d, p);
            if (celda) {
              const grpObj = grupos.find(g => g.id === celda.grupoId);
              celdasMapa[`${d}_${p}`] = {
                materia: getNombreAsignaturaCelda(celda),
                docente: nomDoc,
                grupo: grpObj?.nombre || celda.grupoId
              };
            }
          }
        }
        filasExport.push({ encabezado: `DOCENTE: ${nomDoc}`, celdas: celdasMapa });
        tipoVistaPDF = "DOCENTE";
      } else {
        tituloTabla = "SUMARIO GENERAL DEL PLANTEL";
        tipoVistaPDF = "SUMARIO";
      }
    } else if (opcion === "PAQUETE_DOCENTES") {
      tituloTabla = "PAQUETE OFICIAL DE HORARIOS INDIVIDUALES POR DOCENTE";
      tipoVistaPDF = "PAQUETE_DOCENTES";

      for (const docObj of docentes) {
        const nomDoc = `${docObj.nombre} ${docObj.apellidoPaterno || ""}`.trim();
        const celdasMapa: any = {};

        for (let d = 1; d <= 5; d++) {
          for (let p = 1; p <= numHorasPorDia; p++) {
            const celda = horario?.celdas?.find(
              (c: any) => c.diaSemana === d && c.periodo === p && c.docenteId === docObj.id
            );
            if (celda) {
              const grpObj = grupos.find(g => g.id === celda.grupoId);
              celdasMapa[`${d}_${p}`] = {
                materia: getNombreAsignaturaCelda(celda),
                docente: nomDoc,
                grupo: grpObj?.nombre || celda.grupoId
              };
            }
          }
        }
        filasExport.push({ encabezado: `DOCENTE: ${nomDoc}`, celdas: celdasMapa });
      }
    } else if (opcion === "PAQUETE_GRUPOS") {
      tituloTabla = "PAQUETE OFICIAL DE HORARIOS POR GRUPO";
      tipoVistaPDF = "PAQUETE_GRUPOS";

      for (const g of grupos) {
        const celdasMapa: any = {};
        for (let d = 1; d <= 5; d++) {
          for (let p = 1; p <= numHorasPorDia; p++) {
            const celda = horario?.celdas?.find(
              (c: any) => c.diaSemana === d && c.periodo === p && c.grupoId === g.id
            );
            if (celda) {
              celdasMapa[`${d}_${p}`] = {
                materia: getNombreAsignaturaCelda(celda),
                docente: getNombreDocenteCelda(celda),
                grupo: g.nombre
              };
            }
          }
        }
        filasExport.push({ encabezado: `GRUPO ${g.nombre}`, celdas: celdasMapa });
      }
    }

    const payload = {
      nombreEscuela: escuela.nombre,
      cct: escuela.cct || "CCT",
      tipoVista: tipoVistaPDF,
      tituloTabla,
      dias: diasLectivos,
      periodos: periodos.map(p => `Hora ${p}`),
      filas: filasExport
    };

    if (formato === "EXCEL") {
      exportarHorarioExcel(payload);
      toast.success("Excel generado correctamente");
    } else {
      exportarHorarioPDF(payload);
      toast.success("PDF generado exitosamente");
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

        {/* Acciones de Exportación & Configuración */}
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
            onClick={() => setMostrarModalExportar(true)}
            className="btn btn-primary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem", minHeight: "auto", display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Download style={{ width: "15px", height: "15px" }} /> Exportar Horarios (PDF/Excel)
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
              <option key={d.id} value={d.id}>{d.nombre} {d.apellidoPaterno || ""}</option>
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

      {/* Retícula Principal y Panel Lateral de Chat */}
      <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", width: "100%" }}>
        {/* PANEL IZQUIERDO: Cuadrícula interactiva completa */}
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
                    const uacNombre = getNombreAsignaturaCelda(celda);
                    const estiloColor = getEstiloAsignatura(uacNombre);

                    return (
                      <td
                        key={dia}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDropOnSlot(dia, p)}
                        style={{ border: "1px solid #cbd5e1", height: "75px", padding: "0.3rem", verticalAlign: "top", background: celda ? "transparent" : "#fafafa" }}
                      >
                        {celda ? (
                          <div
                            draggable={!celda.esBloqueado}
                            onDragStart={(e) => handleDragStart(e, celda)}
                            className="horario-celda-box"
                            style={{
                              height: "100%",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              background: estiloColor.bg,
                              border: `1px solid ${celda.esBloqueado ? "#d97706" : estiloColor.border}`,
                              padding: "0.35rem",
                              borderRadius: "6px",
                              cursor: celda.esBloqueado ? "not-allowed" : "grab",
                              boxShadow: celda.esBloqueado ? "0 0 0 1px #d97706" : "none"
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.2rem" }}>
                                <p style={{ fontSize: "0.75rem", fontWeight: 900, color: estiloColor.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={uacNombre}>
                                  {uacNombre}
                                </p>
                                <button
                                  onClick={(e) => toggleBloquearCelda(celda, e)}
                                  title={celda.esBloqueado ? "Celda bloqueada (Haga clic para desbloquear)" : "Fijar celda para que la IA no la mueva"}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
                                >
                                  {celda.esBloqueado ? (
                                    <Lock style={{ width: "13px", height: "13px", color: "#d97706" }} />
                                  ) : (
                                    <Unlock style={{ width: "13px", height: "13px", color: "#94a3b8" }} />
                                  )}
                                </button>
                              </div>
                              <p style={{ fontSize: "0.7rem", fontWeight: 800, color: "#1e293b", margin: "0.15rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {vistaTab === "DOCENTE" ? `Grupo ${celda.grupo?.nombre || ""}` : getNombreDocenteCelda(celda)}
                              </p>
                              {vistaTab === "SUMARIO" && (
                                <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b", margin: 0 }}>
                                  Grupo {celda.grupo?.nombre}
                                </p>
                              )}
                            </div>
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
                💡 <strong>Directiva:</strong> Pide cualquier ajuste en lenguaje natural. Ej: <em>"Mueve la clase de Química del lunes 1ª hora al martes 3ª hora"</em> o <em>"Deja libre los viernes al profesor arminda"</em>. Las celdas con candado 🔒 se mantendrán protegidas.
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

      {/* MODAL DE EXPORTACIÓN AVANZADA (PDF & EXCEL) */}
      {mostrarModalExportar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "1.75rem", maxWidth: "560px", width: "100%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid #cbd5e1" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
                <FileText style={{ width: "22px", height: "22px", color: "#2563eb" }} /> Opciones de Exportación Oficial
              </h3>
              <button onClick={() => setMostrarModalExportar(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>
                <X style={{ width: "20px", height: "20px" }} />
              </button>
            </div>

            <p style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "1.25rem" }}>
              Seleccione el formato y alcance de los horarios oficiales a exportar para alumnos o plantilla docente:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {/* Opción 1: Vista Actual */}
              <div style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#1e293b" }}>📄 Vista Actual en Pantalla</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Exporta exactamente el filtro visible ({vistaTab})</div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => ejecutarExportacion("VISTA_ACTUAL", "PDF")} style={{ background: "#2563eb", color: "white", border: "none", padding: "0.4rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
                    PDF
                  </button>
                  <button onClick={() => ejecutarExportacion("VISTA_ACTUAL", "EXCEL")} style={{ background: "#10b981", color: "white", border: "none", padding: "0.4rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
                    Excel
                  </button>
                </div>
              </div>

              {/* Opción 2: Paquete Completo por Docente */}
              <div style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <Package style={{ width: "16px", height: "16px", color: "#d97706" }} /> Paquete Completo por Docente (Multi-página)
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Genera 1 hoja formal individual por cada maestro del plantel</div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => ejecutarExportacion("PAQUETE_DOCENTES", "PDF")} style={{ background: "#2563eb", color: "white", border: "none", padding: "0.4rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
                    PDF Paquete
                  </button>
                </div>
              </div>

              {/* Opción 3: Paquete Completo por Grupo */}
              <div style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <Package style={{ width: "16px", height: "16px", color: "#d97706" }} /> Paquete Completo por Grupo (Multi-página)
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Genera 1 hoja formal individual por cada grupo para alumnos</div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => ejecutarExportacion("PAQUETE_GRUPOS", "PDF")} style={{ background: "#2563eb", color: "white", border: "none", padding: "0.4rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
                    PDF Paquete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
