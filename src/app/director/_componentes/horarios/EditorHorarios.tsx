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

    // Agregar mensaje local
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
    <div className="space-y-4">
      {/* Barra Superior de Control y Pestañas */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Tabs de Filtro */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setVistaTab("GRUPO")}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition ${
              vistaTab === "GRUPO"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" /> Por Grupo
          </button>

          <button
            onClick={() => setVistaTab("DOCENTE")}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition ${
              vistaTab === "DOCENTE"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UserCheck className="w-4 h-4" /> Por Docente
          </button>

          <button
            onClick={() => setVistaTab("AULA")}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition ${
              vistaTab === "AULA"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 className="w-4 h-4" /> Por Aula
          </button>

          <button
            onClick={() => setVistaTab("SUMARIO")}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition ${
              vistaTab === "SUMARIO"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Grid className="w-4 h-4" /> Sumario Maestro
          </button>
        </div>

        {/* Acciones e Impresión */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={onVolverAWizard}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1 transition"
          >
            <Sliders className="w-4 h-4" /> Reconfigurar
          </button>

          <button
            onClick={() => handleExportar("EXCEL")}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-xl text-xs flex items-center gap-1 border border-emerald-200 transition"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>

          <button
            onClick={() => handleExportar("PDF")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition"
          >
            <FileText className="w-4 h-4" /> Exportar PDF Oficial
          </button>
        </div>
      </div>

      {/* Selectores de elemento según Tab activa */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
        <span className="text-xs font-bold text-slate-500 uppercase">Filtrar Vista:</span>
        {vistaTab === "GRUPO" && (
          <select
            value={grupoSeleccionadoId}
            onChange={(e) => setGrupoSeleccionadoId(e.target.value)}
            className="p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
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
            className="p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
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
            className="p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
          >
            {aulas.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre} ({a.tipo})</option>
            ))}
          </select>
        )}
      </div>

      {/* Panel Dual: 70% Grid Matriz / 30% Chat IA */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        {/* PANEL IZQUIERDO (70%) - Cuadrícula interactiva */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="p-2.5 border border-slate-700 text-xs font-bold text-center w-16">Periodo</th>
                {diasLectivos.map((d, i) => (
                  <th key={i} className="p-2.5 border border-slate-700 text-xs font-bold text-center">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodos.map((p) => (
                <tr key={p} className="hover:bg-slate-50/80 transition">
                  <td className="p-2.5 border border-slate-200 bg-slate-100 text-center font-bold text-xs text-slate-700">
                    Hora {p}
                  </td>
                  {[1, 2, 3, 4, 5].map((dia) => {
                    const celda = getCeldaInfo(dia, p);
                    return (
                      <td
                        key={dia}
                        className="p-2 border border-slate-200 text-center h-20 align-top relative group"
                      >
                        {celda ? (
                          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-left h-full flex flex-col justify-between">
                            <div>
                              <p className="text-xs font-bold text-blue-950 truncate">
                                {celda.docente?.nombre || "Docente"}
                              </p>
                              <p className="text-[11px] text-blue-700 font-medium truncate">
                                Grupo: {celda.grupo?.nombre}
                              </p>
                            </div>
                            {celda.esBloqueado && (
                              <div className="flex items-center gap-1 text-[10px] text-amber-700 font-bold">
                                <Lock className="w-3 h-3" /> Fijado
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-slate-300 font-medium italic">
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

        {/* PANEL DERECHO (30%) - Chat IA Asistente */}
        <div className="lg:col-span-3 bg-slate-900 rounded-2xl p-4 text-white flex flex-col h-[550px] shadow-2xl">
          <div className="border-b border-slate-800 pb-3 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
              <div>
                <h3 className="font-bold text-sm text-slate-100">Asistente IA de Horarios</h3>
                <p className="text-[10px] text-slate-400">Gemini 3.5 Flash Lite | SISAT-ATP Pool</p>
              </div>
            </div>
          </div>

          {/* Historial de Mensajes */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-slate-300">
              💡 <strong>Directiva:</strong> Pide cualquier ajuste en lenguaje natural. Ej: <em>"Mueve la clase de Química del lunes 1ª hora al martes 3ª hora"</em> o <em>"El profesor Juan Pérez no puede venir los viernes"</em>.
            </div>

            {chatHistorial.map((msg: any, i: number) => (
              <div
                key={i}
                className={`p-3 rounded-xl max-w-[90%] ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white ml-auto"
                    : "bg-slate-800 text-slate-200 border border-slate-700"
                }`}
              >
                <p className="leading-relaxed">{msg.content}</p>
              </div>
            ))}
          </div>

          {/* Input Chat */}
          <form onSubmit={handleEnviarMensajeIA} className="mt-3 pt-3 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              placeholder="Escribe una instrucción para la IA..."
              value={mensajeChat}
              onChange={(e) => setMensajeChat(e.target.value)}
              className="flex-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={enviandoChat}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition flex items-center justify-center disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
