"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  Search,
  FileText,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Tag,
  Download,
  Upload,
  X,
  Sparkles,
  RefreshCw,
  FolderOpen
} from "lucide-react";

export interface DocumentoNormativoUI {
  id: string;
  categoria: string;
  titulo: string;
  descripcion?: string | null;
  contenidoTexto: string;
  archivoNombre?: string | null;
  archivoUrl?: string | null;
  tags: string[];
  activo: boolean;
  updatedAt: string;
}

const CATEGORIAS = [
  { id: "TODAS", label: "📚 Todas las Categorías" },
  { id: "USICAMM", label: "🎖️ Rúbricas USICAMM" },
  { id: "PAEC_PEC", label: "📋 Lineamientos PAEC / PEC" },
  { id: "CAPEMS", label: "📐 Formatos CAPEMS" },
  { id: "CIRCULARES", label: "📢 Circulares SEP / Zonal" },
  { id: "TRAMITES_SEP", label: "🏫 Trámites Escolares" },
  { id: "HORARIOS_CURRICULO", label: "⏰ Horarios y Currículo" }
];

export default function GestionNormativas() {
  const [normativas, setNormativas] = useState<DocumentoNormativoUI[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [categoriaSel, setCategoriaSel] = useState<string>("TODAS");
  const [busqueda, setBusqueda] = useState<string>("");

  // Estado del Modal Editor
  const [mostrarModal, setMostrarModal] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [cargandoArchivo, setCargandoArchivo] = useState<boolean>(false);
  const [docEditando, setDocEditando] = useState<Partial<DocumentoNormativoUI> | null>(null);

  const handleSubirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !docEditando) return;

    setCargandoArchivo(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/tramites/normativas/extraer-texto", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        const nombreSinExt = file.name.replace(/\.[^/.]+$/, "");
        setDocEditando((prev) => ({
          ...prev,
          titulo: prev?.titulo || nombreSinExt,
          contenidoTexto: data.texto
        }));
      } else {
        alert("⚠️ Error: " + (data.error || "No se pudo extraer el texto del archivo."));
      }
    } catch (err) {
      alert("⚠️ Error procesando el archivo.");
    } finally {
      setCargandoArchivo(false);
      e.target.value = "";
    }
  };

  // Cargar normativas desde API
  const cargarNormativas = async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/tramites/normativas?categoria=${categoriaSel}`);
      const data = await res.json();
      if (data.success) {
        setNormativas(data.normativas || []);
      }
    } catch (error) {
      console.error("Error al cargar normativas:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarNormativas();
  }, [categoriaSel]);

  // Filtrado local por búsqueda
  const normativasFiltradas = normativas.filter((n) => {
    const term = busqueda.toLowerCase();
    return (
      n.titulo.toLowerCase().includes(term) ||
      (n.descripcion && n.descripcion.toLowerCase().includes(term)) ||
      (n.tags && n.tags.some((t) => t.toLowerCase().includes(term)))
    );
  });

  // Manejadores del Editor Modal
  const abrirModalNuevo = () => {
    setDocEditando({
      categoria: "USICAMM",
      titulo: "",
      descripcion: "",
      contenidoTexto: "",
      tags: [],
      activo: true
    });
    setMostrarModal(true);
  };

  const abrirModalEditar = (doc: DocumentoNormativoUI) => {
    setDocEditando({ ...doc });
    setMostrarModal(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docEditando?.titulo || !docEditando?.contenidoTexto || !docEditando?.categoria) {
      alert("Por favor complete el título, la categoría y el contenido del documento.");
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch("/api/tramites/normativas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docEditando)
      });
      const data = await res.json();
      if (data.success) {
        setMostrarModal(false);
        setDocEditando(null);
        cargarNormativas();
      } else {
        alert(data.error || "Error al guardar el documento");
      }
    } catch (err) {
      alert("Error de conexión al guardar el documento");
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar la normativa "${titulo}"? El chatbot de IA ya no podrá consultar este documento.`)) return;

    try {
      const res = await fetch(`/api/tramites/normativas?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        cargarNormativas();
      } else {
        alert(data.error || "Error al eliminar la normativa");
      }
    } catch (err) {
      alert("Error al intentar eliminar la normativa");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}>
      {/* Encabezado y Métricas */}
      <div style={{ background: "white", padding: "1.25rem 1.5rem", borderRadius: "16px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <BookOpen style={{ width: "24px", height: "24px", color: "#2563eb" }} />
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Biblioteca de Normativas y Trámites SEP (Base RAG)
              </h2>
            </div>
            <p style={{ fontSize: "0.875rem", color: "#64748b", margin: 0 }}>
              Administre las circulares, rúbricas USICAMM y formatos oficiales que alimentan al Asistente Virtual 24/7.
            </p>
          </div>

          <button
            onClick={abrirModalNuevo}
            style={{
              background: "#2563eb",
              color: "white",
              padding: "0.6rem 1.25rem",
              borderRadius: "10px",
              fontWeight: 800,
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)"
            }}
          >
            <Plus style={{ width: "18px", height: "18px" }} /> Registrar Nueva Normativa
          </button>
        </div>

        {/* Tarjetas Resumen */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div style={{ background: "#dbeafe", padding: "0.6rem", borderRadius: "10px", color: "#2563eb" }}>
              <FileText style={{ width: "22px", height: "22px" }} />
            </div>
            <div>
              <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#0f172a" }}>{normativas.length}</span>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", margin: 0 }}>Documentos Cargados</p>
            </div>
          </div>

          <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div style={{ background: "#dcfce7", padding: "0.6rem", borderRadius: "10px", color: "#16a34a" }}>
              <Sparkles style={{ width: "22px", height: "22px" }} />
            </div>
            <div>
              <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#0f172a" }}>Gemini 3.5 RAG</span>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", margin: 0 }}>Motor IA Activo</p>
            </div>
          </div>

          <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div style={{ background: "#fef3c7", padding: "0.6rem", borderRadius: "10px", color: "#d97706" }}>
              <FolderOpen style={{ width: "22px", height: "22px" }} />
            </div>
            <div>
              <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#0f172a" }}>{CATEGORIAS.length - 1}</span>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", margin: 0 }}>Categorías Oficiales</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pestañas de Categoría y Buscador */}
      <div style={{ background: "white", padding: "1rem 1.25rem", borderRadius: "16px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem" }}>
          {CATEGORIAS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoriaSel(cat.id)}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "8px",
                border: "none",
                fontSize: "0.8125rem",
                fontWeight: 800,
                cursor: "pointer",
                transition: "all 0.2s ease",
                background: categoriaSel === cat.id ? "#2563eb" : "#f1f5f9",
                color: categoriaSel === cat.id ? "white" : "#64748b"
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "#f8fafc", padding: "0.5rem 0.85rem", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <Search style={{ width: "18px", height: "18px", color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Buscar normativa por palabra clave, título o etiqueta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: "100%", border: "none", background: "transparent", fontSize: "0.875rem", outline: "none", color: "#1e293b" }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <X style={{ width: "16px", height: "16px", color: "#94a3b8" }} />
            </button>
          )}
        </div>
      </div>

      {/* Lista de Documentos Normativos */}
      <div style={{ background: "white", borderRadius: "16px", border: "1px solid var(--border)", padding: "1.25rem" }}>
        {cargando ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
            <RefreshCw style={{ width: "24px", height: "24px", animation: "spin 1s linear infinite", margin: "0 auto 0.5rem" }} />
            <p style={{ fontSize: "0.875rem", fontWeight: 700 }}>Cargando base de conocimiento RAG...</p>
          </div>
        ) : normativasFiltradas.length === 0 ? (
          <div style={{ padding: "3rem 1.5rem", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "2px dashed #cbd5e1" }}>
            <FolderOpen style={{ width: "40px", height: "40px", color: "#94a3b8", margin: "0 auto 0.75rem" }} />
            <h4 style={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b", margin: "0 0 0.25rem" }}>No se encontraron documentos</h4>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: 0 }}>
              Intente cambiar el filtro de categoría o registre un nuevo documento haciendo clic en <strong>"Registrar Nueva Normativa"</strong>.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
            {normativasFiltradas.map((doc) => (
              <div
                key={doc.id}
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                  transition: "all 0.2s ease"
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.4rem" }}>
                    <span style={{ background: "#eff6ff", color: "#2563eb", padding: "0.2rem 0.6rem", borderRadius: "6px", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase" }}>
                      {doc.categoria}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                      {new Date(doc.updatedAt).toLocaleDateString("es-MX")}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.35rem", lineHeight: 1.3 }}>
                    {doc.titulo}
                  </h3>

                  {doc.descripcion && (
                    <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0 0 0.5rem", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {doc.descripcion}
                    </p>
                  )}

                  {doc.tags && doc.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                      {doc.tags.map((t, idx) => (
                        <span key={idx} style={{ background: "#f1f5f9", color: "#475569", padding: "0.15rem 0.45rem", borderRadius: "4px", fontSize: "0.65rem", fontWeight: 700 }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "0.6rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.7rem", color: "#64748b", fontStyle: "italic" }}>
                    {doc.contenidoTexto.length} caracteres
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <button
                      onClick={() => abrirModalEditar(doc)}
                      style={{ background: "#f1f5f9", color: "#2563eb", border: "none", padding: "0.35rem 0.6rem", borderRadius: "6px", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.2rem" }}
                    >
                      <Edit3 style={{ width: "13px", height: "13px" }} /> Editar
                    </button>
                    <button
                      onClick={() => handleEliminar(doc.id, doc.titulo)}
                      style={{ background: "#fef2f2", color: "#ef4444", border: "none", padding: "0.35rem 0.6rem", borderRadius: "6px", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.2rem" }}
                    >
                      <Trash2 style={{ width: "13px", height: "13px" }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Editor / Creador de Normativa */}
      {mostrarModal && docEditando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ background: "white", borderRadius: "16px", width: "100%", maxWidth: "680px", maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border)", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)", padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <BookOpen style={{ width: "20px", height: "20px", color: "#2563eb" }} />
                <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  {docEditando.id ? "Editar Documento Normativo" : "Registrar Nuevo Documento Normativo"}
                </h3>
              </div>
              <button onClick={() => setMostrarModal(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X style={{ width: "20px", height: "20px", color: "#64748b" }} />
              </button>
            </div>

            <form onSubmit={handleGuardar} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#475569", marginBottom: "0.3rem" }}>Categoría Oficial:</label>
                  <select
                    value={docEditando.categoria || "USICAMM"}
                    onChange={(e) => setDocEditando({ ...docEditando, categoria: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem", fontWeight: 700 }}
                  >
                    {CATEGORIAS.filter((c) => c.id !== "TODAS").map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#475569", marginBottom: "0.3rem" }}>Etiquetas / Tags (separadas por coma):</label>
                  <input
                    type="text"
                    placeholder="ej. matemáticas, ficha-capems, fechas"
                    value={Array.isArray(docEditando.tags) ? docEditando.tags.join(", ") : docEditando.tags || ""}
                    onChange={(e) => setDocEditando({ ...docEditando, tags: e.target.value.split(",").map((t) => t.trim()) })}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#475569", marginBottom: "0.3rem" }}>Título del Documento / Circular:</label>
                <input
                  type="text"
                  placeholder="ej. Formato de Ficha CAPEMS 2026 - Matemáticas"
                  value={docEditando.titulo || ""}
                  onChange={(e) => setDocEditando({ ...docEditando, titulo: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem", fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#475569", marginBottom: "0.3rem" }}>Resumen / Descripción corta:</label>
                <input
                  type="text"
                  placeholder="Breve explicación del propósito de este documento"
                  value={docEditando.descripcion || ""}
                  onChange={(e) => setDocEditando({ ...docEditando, descripcion: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem" }}
                />
              </div>

              {/* Carga automática desde archivo PDF, DOCX, TXT o MD */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "2px dashed #cbd5e1",
                  borderRadius: "12px",
                  padding: "1rem",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#2563eb", fontWeight: 800, fontSize: "0.875rem" }}>
                  <Upload style={{ width: "18px", height: "18px" }} />
                  <span>Cargar desde Archivo (PDF, DOCX, TXT, MD)</span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  Selecciona un archivo oficial de tu equipo para extraer automáticamente su contenido de texto.
                </p>
                <label
                  style={{
                    background: cargandoArchivo ? "#94a3b8" : "#2563eb",
                    color: "white",
                    padding: "0.45rem 1rem",
                    borderRadius: "8px",
                    fontSize: "0.8125rem",
                    fontWeight: 800,
                    cursor: cargandoArchivo ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    marginTop: "0.25rem",
                    boxShadow: "0 2px 6px rgba(37,99,235,0.2)"
                  }}
                >
                  {cargandoArchivo ? (
                    <>
                      <RefreshCw style={{ width: "15px", height: "15px", animation: "spin 1s linear infinite" }} />
                      <span>Extrayendo Texto...</span>
                    </>
                  ) : (
                    <>
                      <FileText style={{ width: "15px", height: "15px" }} />
                      <span>Seleccionar Archivo (PDF / DOCX / TXT / MD)</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={handleSubirArchivo}
                    disabled={cargandoArchivo}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#475569", marginBottom: "0.3rem" }}>Contenido del Documento / Extracto RAG (Texto completo):</label>
                <textarea
                  rows={8}
                  placeholder="El texto extraído de tu PDF/DOCX/TXT aparecerá aquí automáticamente, o puedes pegarlo/editarlo manualmente..."
                  value={docEditando.contenidoTexto || ""}
                  onChange={(e) => setDocEditando({ ...docEditando, contenidoTexto: e.target.value })}
                  style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.8125rem", fontFamily: "monospace", lineHeight: 1.5 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  style={{ padding: "0.6rem 1.25rem", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{ padding: "0.6rem 1.5rem", borderRadius: "8px", border: "none", background: "#2563eb", color: "white", fontSize: "0.875rem", fontWeight: 800, cursor: guardando ? "wait" : "pointer" }}
                >
                  {guardando ? "Guardando..." : "💾 Guardar Documento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
