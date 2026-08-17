"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Save,
  MessageSquare,
  Sparkles,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  Filter,
} from "lucide-react";
import { CompromisoCalculado, KpisCteCompromisos } from "@/lib/cte/cte-engine";

interface SesionOption {
  id: string;
  numero: number;
  fase: string;
  descripcion: string | null;
}

const CATEGORIA_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  APRENDIZAJES: { label: "Aprendizajes", bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" },
  CONVIVENCIA: { label: "Convivencia", bg: "rgba(16, 185, 129, 0.15)", color: "#10b981" },
  GESTION: { label: "Gestión Escolar", bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" },
  FORMACION_DOCENTE: { label: "Formación Docente", bg: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" },
  OTRO: { label: "General", bg: "rgba(107, 114, 128, 0.15)", color: "#9ca3af" },
};

const ESTADO_BADGES: Record<
  string,
  { label: string; bg: string; color: string; icon: React.ReactNode }
> = {
  RESUELTO: {
    label: "Resuelto ✓",
    bg: "rgba(16, 185, 129, 0.15)",
    color: "#10b981",
    icon: <CheckCircle2 size={13} />,
  },
  EN_PROCESO: {
    label: "En Proceso",
    bg: "rgba(59, 130, 246, 0.15)",
    color: "#3b82f6",
    icon: <RefreshCw size={13} className="spin-slow" />,
  },
  PENDIENTE: {
    label: "Pendiente",
    bg: "rgba(107, 114, 128, 0.15)",
    color: "#9ca3af",
    icon: <Clock size={13} />,
  },
  VENCIDO: {
    label: "Vencido",
    bg: "rgba(239, 68, 68, 0.15)",
    color: "#ef4444",
    icon: <AlertTriangle size={13} />,
  },
};

export default function CteCompromisosTablero({
  sesiones = [],
  readOnly = false,
}: {
  sesiones?: SesionOption[];
  readOnly?: boolean;
}) {
  const [compromisos, setCompromisos] = useState<CompromisoCalculado[]>([]);
  const [kpis, setKpis] = useState<KpisCteCompromisos>({
    total: 0,
    resueltos: 0,
    enProceso: 0,
    pendientes: 0,
    vencidos: 0,
    porcentajeCumplimiento: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [sesionFiltro, setSesionFiltro] = useState<string>("TODAS");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("TODAS");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("TODOS");

  // Modal nuevo compromiso
  const [showModalCrear, setShowModalCrear] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formCrear, setFormCrear] = useState({
    sesionId: "",
    texto: "",
    categoria: "APRENDIZAJES",
    prioridad: 1,
    fechaLimite: "",
    notasSeguimiento: "",
  });

  // Modal reportar avance (director)
  const [modalAvanceId, setModalAvanceId] = useState<string | null>(null);
  const [textoAvance, setTextoAvance] = useState("");
  const [enviandoAvance, setEnviandoAvance] = useState(false);

  // Acordeón de notas por ID
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  const cargarCompromisos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = readOnly
        ? "/api/director/cte/compromisos"
        : "/api/admin/cte/compromisos";

      const params = new URLSearchParams();
      if (sesionFiltro !== "TODAS") params.append("sesionId", sesionFiltro);
      if (categoriaFiltro !== "TODAS") params.append("categoria", categoriaFiltro);

      const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al cargar compromisos de CTE");
      const data = await res.json();
      setCompromisos(data.compromisos || []);
      if (data.kpis) setKpis(data.kpis);
    } catch (err: any) {
      setError(err?.message || "Error al sincronizar compromisos");
    } finally {
      setLoading(false);
    }
  }, [readOnly, sesionFiltro, categoriaFiltro]);

  useEffect(() => {
    cargarCompromisos();
  }, [cargarCompromisos]);

  // Manejador para crear compromiso
  const handleCrearCompromiso = async () => {
    if (!formCrear.sesionId || !formCrear.texto.trim()) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/admin/cte/compromisos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formCrear),
      });
      if (!res.ok) throw new Error("Error al guardar compromiso");
      setShowModalCrear(false);
      setFormCrear({
        sesionId: sesiones[0]?.id || "",
        texto: "",
        categoria: "APRENDIZAJES",
        prioridad: 1,
        fechaLimite: "",
        notasSeguimiento: "",
      });
      await cargarCompromisos();
    } catch (err: any) {
      setError(err?.message || "Error al crear compromiso");
    } finally {
      setGuardando(false);
    }
  };

  // Manejador para alternar resuelto
  const handleToggleResuelto = async (comp: CompromisoCalculado) => {
    if (readOnly) return;
    try {
      const nuevoResuelto = !comp.resuelto;
      await fetch(`/api/admin/cte/compromisos/${comp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resuelto: nuevoResuelto }),
      });
      await cargarCompromisos();
    } catch {
      /* Silencio */
    }
  };

  // Manejador para eliminar compromiso
  const handleEliminarCompromiso = async (id: string) => {
    if (readOnly || !confirm("¿Eliminar este acuerdo de la sesión de CTE?")) return;
    try {
      await fetch(`/api/admin/cte/compromisos/${id}`, {
        method: "DELETE",
      });
      await cargarCompromisos();
    } catch {
      /* Silencio */
    }
  };

  // Manejador para enviar reporte de avance (Director)
  const handleEnviarAvance = async () => {
    if (!modalAvanceId || !textoAvance.trim()) return;
    setEnviandoAvance(true);
    try {
      const res = await fetch(`/api/director/cte/compromisos/${modalAvanceId}/avance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notaAvance: textoAvance }),
      });
      if (!res.ok) throw new Error("Error al registrar avance");
      setModalAvanceId(null);
      setTextoAvance("");
      await cargarCompromisos();
    } catch (err: any) {
      alert(err?.message || "Error al enviar avance");
    } finally {
      setEnviandoAvance(false);
    }
  };

  // Filtrar en memoria por estado
  const compromisosFiltrados = compromisos.filter((c) => {
    if (estadoFiltro === "TODOS") return true;
    return c.estadoCalculado === estadoFiltro;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header y Acciones */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--text)",
            }}
          >
            <Layers style={{ color: "var(--primary)" }} size={22} />
            Tablero de Acuerdos y Compromisos Zonal
          </h3>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.825rem", color: "var(--text-muted)" }}>
            Seguimiento pedagógico y trazabilidad de compromisos pactados en sesiones de CTE
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            onClick={cargarCompromisos}
            className="btn btn-outline"
            style={{ fontSize: "0.8125rem", padding: "0.4rem 0.75rem" }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Actualizar
          </button>

          {!readOnly && (
            <button
              onClick={() => {
                setFormCrear((f) => ({ ...f, sesionId: sesiones[0]?.id || "" }));
                setShowModalCrear(true);
              }}
              className="btn btn-primary"
              style={{ fontSize: "0.8125rem", padding: "0.4rem 0.85rem", display: "flex", gap: "0.35rem", alignItems: "center" }}
            >
              <Plus size={15} /> Nuevo Acuerdo
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ fontSize: "0.85rem", padding: "0.75rem 1rem" }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Tarjetas de KPIs y Barra de Progreso */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <div className="card" style={{ padding: "0.85rem 1rem", textAlign: "center", borderLeft: "3px solid var(--primary)" }}>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text)" }}>{kpis.total}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Acuerdos</div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", textAlign: "center", borderLeft: "3px solid #10b981" }}>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#10b981" }}>{kpis.resueltos}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Resueltos</div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", textAlign: "center", borderLeft: "3px solid #3b82f6" }}>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#3b82f6" }}>{kpis.enProceso}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>En Proceso</div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", textAlign: "center", borderLeft: "3px solid #9ca3af" }}>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#9ca3af" }}>{kpis.pendientes}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Pendientes</div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", textAlign: "center", borderLeft: "3px solid #ef4444" }}>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ef4444" }}>{kpis.vencidos}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Vencidos</div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", textAlign: "center", borderLeft: "3px solid #8b5cf6" }}>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#8b5cf6" }}>{kpis.porcentajeCumplimiento}%</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>% Avance Zonal</div>
        </div>
      </div>

      {/* Barra de progreso visual */}
      <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            transition: "width 0.5s ease",
            width: `${kpis.porcentajeCumplimiento}%`,
            background:
              kpis.porcentajeCumplimiento === 100
                ? "#10b981"
                : kpis.porcentajeCumplimiento > 50
                ? "#3b82f6"
                : "#f59e0b",
          }}
        />
      </div>

      {/* Barra de Filtros */}
      <div
        className="card"
        style={{
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
          background: "var(--bg-secondary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          <Filter size={14} /> Filtros:
        </div>

        {/* Filtro Sesión */}
        <select
          className="form-control"
          style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", width: "auto", minWidth: "160px" }}
          value={sesionFiltro}
          onChange={(e) => setSesionFiltro(e.target.value)}
        >
          <option value="TODAS">Todas las sesiones</option>
          {sesiones.map((s) => (
            <option key={s.id} value={s.id}>
              Sesión {s.numero} ({s.fase === "INTENSIVA" ? "Intensiva" : "Ordinaria"})
            </option>
          ))}
        </select>

        {/* Filtro Categoría */}
        <select
          className="form-control"
          style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", width: "auto" }}
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
        >
          <option value="TODAS">Todos los ejes temáticos</option>
          <option value="APRENDIZAJES">Aprendizajes fundamentales</option>
          <option value="CONVIVENCIA">Convivencia escolar</option>
          <option value="GESTION">Gestión escolar</option>
          <option value="FORMACION_DOCENTE">Formación docente</option>
          <option value="OTRO">Otros temas</option>
        </select>

        {/* Filtro Estado */}
        <select
          className="form-control"
          style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", width: "auto" }}
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
        >
          <option value="TODOS">Todos los estados</option>
          <option value="RESUELTO">Resueltos ✓</option>
          <option value="EN_PROCESO">En Proceso 🔄</option>
          <option value="PENDIENTE">Pendientes ⏳</option>
          <option value="VENCIDO">Vencidos ⚠️</option>
        </select>
      </div>

      {/* Listado de Acuerdos */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
          <Loader2 size={32} className="spin" style={{ color: "var(--primary)", margin: "0 auto 0.5rem" }} />
          <p style={{ fontSize: "0.875rem" }}>Cargando acuerdos de CTE...</p>
        </div>
      ) : compromisosFiltrados.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
          <CheckCircle2 size={40} style={{ margin: "0 auto 0.75rem", opacity: 0.4, color: "var(--primary)" }} />
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
            No hay compromisos registrados con los filtros seleccionados
          </p>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.8125rem" }}>
            {!readOnly ? "Puedes registrar un nuevo acuerdo con el botón superior." : "Los acuerdos oficiales de la zona aparecerán aquí."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {compromisosFiltrados.map((comp) => {
            const cat = CATEGORIA_LABELS[comp.categoria || "OTRO"] || CATEGORIA_LABELS.OTRO;
            const badge = ESTADO_BADGES[comp.estadoCalculado] || ESTADO_BADGES.PENDIENTE;
            const expandido = expandidos[comp.id] || false;

            return (
              <div
                key={comp.id}
                className="card"
                style={{
                  padding: "1rem 1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  borderLeft:
                    comp.estadoCalculado === "RESUELTO"
                      ? "4px solid #10b981"
                      : comp.estadoCalculado === "VENCIDO"
                      ? "4px solid #ef4444"
                      : comp.estadoCalculado === "EN_PROCESO"
                      ? "4px solid #3b82f6"
                      : "4px solid #9ca3af",
                }}
              >
                {/* Cabecera del acuerdo */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    {/* Badge de estado */}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        padding: "0.25rem 0.6rem",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: badge.bg,
                        color: badge.color,
                      }}
                    >
                      {badge.icon} {badge.label}
                    </span>

                    {/* Badge de categoría */}
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "0.2rem 0.55rem",
                        borderRadius: "10px",
                        background: cat.bg,
                        color: cat.color,
                      }}
                    >
                      {cat.label}
                    </span>

                    {/* Prioridad */}
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "10px",
                        background:
                          comp.prioridad === 3
                            ? "rgba(239, 68, 68, 0.15)"
                            : comp.prioridad === 2
                            ? "rgba(245, 158, 11, 0.15)"
                            : "rgba(107, 114, 128, 0.15)",
                        color:
                          comp.prioridad === 3
                            ? "#ef4444"
                            : comp.prioridad === 2
                            ? "#f59e0b"
                            : "#9ca3af",
                      }}
                    >
                      {comp.prioridad === 3 ? "🔴 Prioridad Alta" : comp.prioridad === 2 ? "🟡 Prioridad Media" : "🔵 Normal"}
                    </span>

                    {/* Sesión Origen */}
                    {comp.sesionNumero && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Calendar size={12} /> Sesión {comp.sesionNumero} ({comp.sesionFase})
                      </span>
                    )}
                  </div>

                  {/* Acciones para ATP */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {!readOnly && (
                      <>
                        <button
                          onClick={() => handleToggleResuelto(comp)}
                          className={comp.resuelto ? "btn btn-outline" : "btn btn-primary"}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.25rem 0.6rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.3rem",
                          }}
                        >
                          <CheckCircle2 size={13} />
                          {comp.resuelto ? "Reabrir" : "Resolver ✓"}
                        </button>

                        <button
                          onClick={() => handleEliminarCompromiso(comp.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                            padding: "0.25rem",
                          }}
                          title="Eliminar acuerdo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}

                    {/* Botón para que directores reporten avance */}
                    {readOnly && (
                      <button
                        onClick={() => {
                          setModalAvanceId(comp.id);
                          setTextoAvance("");
                        }}
                        className="btn btn-outline"
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.25rem 0.6rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        <MessageSquare size={13} /> Reportar Avance
                      </button>
                    )}
                  </div>
                </div>

                {/* Texto del compromiso */}
                <div style={{ fontSize: "0.9rem", lineHeight: "1.45", color: "var(--text)", fontWeight: 500 }}>
                  {comp.texto}
                </div>

                {/* Info de vencimiento / tiempo */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    {comp.estadoCalculado === "VENCIDO" && comp.diasVencido !== null && (
                      <span style={{ color: "#ef4444", fontWeight: 700 }}>
                        ⚠️ Expiró hace {comp.diasVencido} días naturales
                      </span>
                    )}
                    {comp.estadoCalculado !== "VENCIDO" && comp.diasRestantes !== null && (
                      <span>⏳ {comp.diasRestantes} días restantes para cumplimiento</span>
                    )}
                  </div>

                  {/* Botón expandir notas de seguimiento */}
                  {comp.notasSeguimiento && (
                    <button
                      onClick={() => setExpandidos((prev) => ({ ...prev, [comp.id]: !expandido }))}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        color: "var(--primary)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontWeight: 600,
                      }}
                    >
                      <MessageSquare size={12} />
                      {expandido ? "Ocultar seguimiento" : "Ver historial de avance"}
                      {expandido ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                </div>

                {/* Historial de seguimiento expandido */}
                {expandido && comp.notasSeguimiento && (
                  <div
                    style={{
                      marginTop: "0.35rem",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      background: "var(--bg-secondary)",
                      fontSize: "0.8rem",
                      whiteSpace: "pre-line",
                      lineHeight: "1.4",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {comp.notasSeguimiento}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear Acuerdo (ATP / Admin) */}
      {showModalCrear && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "540px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Plus size={18} style={{ color: "var(--primary)" }} /> Registrar Acuerdo de CTE
              </h3>
              <button
                onClick={() => setShowModalCrear(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>
                  Sesión de CTE *
                </label>
                <select
                  className="form-control"
                  value={formCrear.sesionId}
                  onChange={(e) => setFormCrear((f) => ({ ...f, sesionId: e.target.value }))}
                  style={{ width: "100%" }}
                >
                  <option value="">Selecciona la sesión de CTE...</option>
                  {sesiones.map((s) => (
                    <option key={s.id} value={s.id}>
                      Sesión {s.numero} ({s.fase === "INTENSIVA" ? "Intensiva" : "Ordinaria"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>
                  Descripción del Acuerdo / Compromiso *
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formCrear.texto}
                  onChange={(e) => setFormCrear((f) => ({ ...f, texto: e.target.value }))}
                  placeholder="Ej: Implementar estrategia de lectura y comprensión lectora 15 min diarios..."
                  style={{ width: "100%", fontSize: "0.85rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>
                    Eje Temático
                  </label>
                  <select
                    className="form-control"
                    value={formCrear.categoria}
                    onChange={(e) => setFormCrear((f) => ({ ...f, categoria: e.target.value }))}
                    style={{ width: "100%" }}
                  >
                    <option value="APRENDIZAJES">Aprendizajes fundamentales</option>
                    <option value="CONVIVENCIA">Convivencia escolar</option>
                    <option value="GESTION">Gestión escolar</option>
                    <option value="FORMACION_DOCENTE">Formación docente</option>
                    <option value="OTRO">Otro tema</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>
                    Prioridad
                  </label>
                  <select
                    className="form-control"
                    value={formCrear.prioridad}
                    onChange={(e) => setFormCrear((f) => ({ ...f, prioridad: Number(e.target.value) }))}
                    style={{ width: "100%" }}
                  >
                    <option value={1}>🔵 Normal</option>
                    <option value={2}>🟡 Media</option>
                    <option value={3}>🔴 Alta / Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>
                  Fecha Límite Específica (Opcional)
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={formCrear.fechaLimite}
                  onChange={(e) => setFormCrear((f) => ({ ...f, fechaLimite: e.target.value }))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button onClick={() => setShowModalCrear(false)} className="btn btn-outline" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={handleCrearCompromiso}
                disabled={guardando || !formCrear.sesionId || !formCrear.texto.trim()}
                className="btn btn-primary"
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
              >
                {guardando ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                Guardar Acuerdo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reportar Avance (Director) */}
      {modalAvanceId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "480px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <MessageSquare size={18} style={{ color: "var(--primary)" }} /> Reportar Avance de Acuerdo
              </h3>
              <button
                onClick={() => setModalAvanceId(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>
                Descripción del Avance o Evidencia de Cumplimiento *
              </label>
              <textarea
                className="form-control"
                rows={4}
                value={textoAvance}
                onChange={(e) => setTextoAvance(e.target.value)}
                placeholder="Describa las acciones realizadas por el plantel para solventar este compromiso..."
                style={{ width: "100%", fontSize: "0.85rem" }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button onClick={() => setModalAvanceId(null)} className="btn btn-outline" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={handleEnviarAvance}
                disabled={enviandoAvance || !textoAvance.trim()}
                className="btn btn-primary"
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
              >
                {enviandoAvance ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                Enviar Reporte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
