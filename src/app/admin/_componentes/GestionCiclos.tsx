"use client";

import { useState, useEffect } from "react";
import { Calendar, PlusCircle, CheckCircle2, AlertTriangle, Play, X, Copy, Loader2, CheckSquare, Square, Settings, Pencil, Save } from "lucide-react";

type Ciclo = {
    id: string;
    nombre: string;
    activo: boolean;
    inicio: string;
    fin: string;
};

type ProgramaResumen = {
    id: string;
    nombre: string;
    tipo: string;
    activo: boolean;
    tienePeriodos: boolean;
};

type ModalState = {
    cicloId: string;
    nombreCiclo: string;
    modoGestion: boolean; // false = activar ciclo inactivo, true = gestionar ciclo activo
} | null;

export default function GestionCiclos({
    todosCiclos: inicialCiclos,
    onSetMessage,
    readOnly = false,
}: {
    todosCiclos: Ciclo[];
    onSetMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
    readOnly?: boolean;
}) {
    const [ciclos, setCiclos] = useState<Ciclo[]>(inicialCiclos);
    const [nombre, setNombre] = useState("");
    const [inicio, setInicio] = useState("");
    const [fin, setFin] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [activatingId, setActivatingId] = useState<string | null>(null);

    // ── Modal state ──────────────────────────────────────────────────────
    const [modal, setModal] = useState<ModalState>(null);
    const [programasDisponibles, setProgramasDisponibles] = useState<ProgramaResumen[]>([]);
    const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
    const [loadingProgramas, setLoadingProgramas] = useState(false);
    const [guardando, setGuardando] = useState(false);

    // ── Estado edición inline de fechas ──────────────────────────────────
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [editInicio, setEditInicio] = useState("");
    const [editFin, setEditFin] = useState("");
    const [guardandoFechas, setGuardandoFechas] = useState(false);

    // Punto 4: Fuente de datos corregida — usa el nuevo endpoint GET /api/admin/ciclos/[id]/programas
    useEffect(() => {
        if (!modal) return;
        setLoadingProgramas(true);
        fetch(`/api/admin/ciclos/${modal.cicloId}/programas`)
            .then((r) => r.json())
            .then((data: { programas: ProgramaResumen[] }) => {
                const progs = data.programas ?? [];
                setProgramasDisponibles(progs);

                if (modal.modoGestion) {
                    // Modo gestión (ciclo activo): marcar los que YA tienen periodos
                    setSeleccionados(new Set(progs.filter((p) => p.tienePeriodos).map((p) => p.id)));
                } else {
                    // Modo activación (ciclo inactivo): si el ciclo YA fue configurado antes,
                    // pre-seleccionar los que tienen periodos (respetar configuración previa).
                    // Si el ciclo es nuevo (ninguno tiene periodos), no pre-seleccionar ninguno
                    // para que el admin elija explícitamente.
                    const yaConfigurado = progs.some((p) => p.tienePeriodos);
                    if (yaConfigurado) {
                        setSeleccionados(new Set(progs.filter((p) => p.tienePeriodos).map((p) => p.id)));
                    } else {
                        setSeleccionados(new Set()); // Ciclo nuevo: sin pre-selección
                    }
                }
            })
            .catch(() => setProgramasDisponibles([]))
            .finally(() => setLoadingProgramas(false));
    }, [modal]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!nombre || !inicio || !fin) {
            onSetMessage({ type: "error", text: "Por favor, completa todos los campos." });
            return;
        }

        setSubmitting(true);
        onSetMessage(null);

        try {
            const res = await fetch("/api/admin/ciclos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre, inicio, fin }),
            });

            const data = await res.json();

            if (res.ok) {
                onSetMessage({ type: "success", text: `Ciclo escolar "${nombre}" creado con éxito.` });
                setCiclos((prev) => [data.ciclo, ...prev]);
                setNombre("");
                setInicio("");
                setFin("");
                setTimeout(() => window.location.reload(), 2000);
            } else {
                onSetMessage({ type: "error", text: data.error || "Error al crear el ciclo escolar." });
            }
        } catch (error) {
            console.error("Error creating cycle:", error);
            onSetMessage({ type: "error", text: "Error de conexión con el servidor." });
        } finally {
            setSubmitting(false);
        }
    }

    function handleActivarClick(cicloId: string, nombreCiclo: string) {
        setModal({ cicloId, nombreCiclo, modoGestion: false });
    }

    function handleGestionarClick(cicloId: string, nombreCiclo: string) {
        setModal({ cicloId, nombreCiclo, modoGestion: true });
    }

    function handleEditarClick(ciclo: Ciclo) {
        setEditandoId(ciclo.id);
        // Convertir fecha ISO a yyyy-MM-dd para input[type=date]
        setEditInicio(ciclo.inicio.slice(0, 10));
        setEditFin(ciclo.fin.slice(0, 10));
    }

    async function handleGuardarFechas(cicloId: string, nombreCiclo: string) {
        if (!editInicio || !editFin) return;
        setGuardandoFechas(true);
        onSetMessage(null);
        try {
            const res = await fetch("/api/admin/ciclos", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: cicloId, inicio: editInicio, fin: editFin }),
            });
            const data = await res.json();
            if (res.ok) {
                setCiclos((prev) =>
                    prev.map((c) =>
                        c.id === cicloId
                            ? { ...c, inicio: data.ciclo.inicio, fin: data.ciclo.fin }
                            : c
                    )
                );
                onSetMessage({ type: "success", text: `Fechas del ciclo "${nombreCiclo}" actualizadas.` });
                setEditandoId(null);
            } else {
                onSetMessage({ type: "error", text: data.error || "Error al actualizar las fechas." });
            }
        } catch {
            onSetMessage({ type: "error", text: "Error de conexión con el servidor." });
        } finally {
            setGuardandoFechas(false);
        }
    }

    function handleTogglePrograma(id: string) {
        setSeleccionados((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function handleSeleccionarTodos() {
        if (seleccionados.size === programasDisponibles.length) {
            setSeleccionados(new Set());
        } else {
            setSeleccionados(new Set(programasDisponibles.map((p) => p.id)));
        }
    }

    // ── Modo activación (ciclo inactivo) ─────────────────────────────────
    async function handleConfirmarActivacion(conMigracion: boolean) {
        if (!modal) return;
        const { cicloId, nombreCiclo } = modal;

        setGuardando(true);
        setActivatingId(cicloId);
        onSetMessage(null);

        try {
            const copiarProgramaIds = conMigracion ? Array.from(seleccionados) : [];

            const res = await fetch("/api/admin/ciclos", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: cicloId, copiarProgramaIds }),
            });

            const data = await res.json();

            if (res.ok) {
                const migMsg =
                    conMigracion && data.programasMigrados > 0
                        ? ` Se copiaron ${data.programasMigrados} programa(s) al nuevo ciclo.`
                        : "";
                onSetMessage({
                    type: "success",
                    text: `Ciclo "${nombreCiclo}" activado.${migMsg} Recargando...`,
                });
                setCiclos((prev) => prev.map((c) => ({ ...c, activo: c.id === cicloId })));
                setModal(null);
                setTimeout(() => window.location.reload(), 1800);
            } else {
                onSetMessage({ type: "error", text: data.error || "Error al activar el ciclo escolar." });
            }
        } catch (error) {
            console.error("Error activating cycle:", error);
            onSetMessage({ type: "error", text: "Error de conexión con el servidor." });
        } finally {
            setGuardando(false);
            setActivatingId(null);
        }
    }

    // ── Modo gestión (ciclo activo) ───────────────────────────────────────
    async function handleConfirmarGestion() {
        if (!modal) return;
        const { cicloId, nombreCiclo } = modal;

        // Calcular qué agregar y qué eliminar
        const conPeriodosSet = new Set(programasDisponibles.filter((p) => p.tienePeriodos).map((p) => p.id));
        const agregarProgramaIds = Array.from(seleccionados).filter((id) => !conPeriodosSet.has(id));
        const eliminarProgramaIds = programasDisponibles
            .filter((p) => p.tienePeriodos && !seleccionados.has(p.id))
            .map((p) => p.id);

        if (agregarProgramaIds.length === 0 && eliminarProgramaIds.length === 0) {
            onSetMessage({ type: "success", text: "Sin cambios que aplicar." });
            setModal(null);
            return;
        }

        // Confirmar si hay eliminaciones
        if (eliminarProgramaIds.length > 0) {
            const nombres = programasDisponibles
                .filter((p) => eliminarProgramaIds.includes(p.id))
                .map((p) => p.nombre)
                .join(", ");
            const ok = window.confirm(
                `Se eliminarán del ciclo "${nombreCiclo}" los periodos y entregas de: ${nombres}.\n` +
                    "Los archivos cargados por las escuelas en este ciclo también se borrarán.\n\n¿Continuar?"
            );
            if (!ok) return;
        }

        setGuardando(true);
        onSetMessage(null);

        try {
            const res = await fetch("/api/admin/ciclos", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: cicloId, agregarProgramaIds, eliminarProgramaIds }),
            });

            const data = await res.json();

            if (res.ok) {
                const partes: string[] = [];
                if (data.programasAgregados > 0) partes.push(`${data.programasAgregados} programa(s) agregado(s)`);
                if (data.programasEliminados > 0) partes.push(`${data.programasEliminados} programa(s) eliminado(s)`);
                onSetMessage({
                    type: "success",
                    text: `Ciclo "${nombreCiclo}" actualizado: ${partes.join(", ")}. Recargando...`,
                });
                setModal(null);
                setTimeout(() => window.location.reload(), 1800);
            } else {
                onSetMessage({ type: "error", text: data.error || "Error al actualizar el ciclo." });
            }
        } catch (error) {
            console.error("Error managing cycle:", error);
            onSetMessage({ type: "error", text: "Error de conexión con el servidor." });
        } finally {
            setGuardando(false);
        }
    }

    const TIPO_LABEL: Record<string, string> = {
        ANUAL: "Anual",
        SEMESTRAL: "Semestral",
        MENSUAL: "Mensual",
    };

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: "2rem" }}>
                <h1>Ciclos Escolares</h1>
                <p style={{ color: "var(--text-secondary)" }}>
                    Administra los periodos anuales de trabajo. Al activar un nuevo ciclo puedes elegir qué programas
                    continúan, conservando el historial del ciclo anterior.
                </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem", alignItems: "start" }}>

                {!readOnly && (
                    <div className="card">
                        <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <PlusCircle size={18} color="var(--primary)" />
                            <span>Crear Nuevo Ciclo Escolar</span>
                        </div>

                        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                                    Nombre del Ciclo
                                </label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Ej: 2026-2027"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    required
                                    style={{ width: "100%" }}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                                    Fecha de Inicio
                                </label>
                                <input
                                    type="date"
                                    className="input"
                                    value={inicio}
                                    onChange={(e) => setInicio(e.target.value)}
                                    required
                                    style={{ width: "100%" }}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                                    Fecha de Fin
                                </label>
                                <input
                                    type="date"
                                    className="input"
                                    value={fin}
                                    onChange={(e) => setFin(e.target.value)}
                                    required
                                    style={{ width: "100%" }}
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={submitting}
                                style={{ marginTop: "0.5rem", width: "100%" }}
                            >
                                {submitting ? "Creando..." : "Crear Ciclo Escolar"}
                            </button>
                        </form>
                    </div>
                )}

                {/* LISTADO DE CICLOS */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "1rem", padding: "1rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Calendar size={18} color="var(--primary)" />
                        <span>Historial de Ciclos Escolares</span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {ciclos.map((c) => {
                            const dateInicio = new Date(c.inicio).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
                            const dateFin = new Date(c.fin).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

                            return (
                                <div
                                    key={c.id}
                                    style={{
                                        padding: "1rem",
                                        borderBottom: "1px solid var(--border)",
                                        background: c.activo ? "var(--primary-bg, #eff6ff)" : "transparent",
                                    }}
                                >
                                    {/* Fila principal */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <strong style={{ fontSize: "0.9375rem", color: "var(--text)" }}>{c.nombre}</strong>
                                                {c.activo ? (
                                                    <span style={{
                                                        display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                                        fontSize: "0.65rem", fontWeight: 700,
                                                        color: "var(--success, #16a34a)", background: "var(--success-bg, #dcfce7)",
                                                        padding: "2px 8px", borderRadius: "12px"
                                                    }}>
                                                        <CheckCircle2 size={10} /> ACTIVO
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                                        fontSize: "0.65rem", fontWeight: 700,
                                                        color: "var(--text-muted, #64748b)", background: "var(--bg-secondary, #f1f5f9)",
                                                        padding: "2px 8px", borderRadius: "12px"
                                                    }}>
                                                        INACTIVO (Lectura)
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginTop: "0.25rem" }}>
                                                Rango: {dateInicio} - {dateFin}
                                            </span>
                                        </div>

                                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                            {/* Botón editar fechas: siempre visible si no readOnly */}
                                            {!readOnly && editandoId !== c.id && (
                                                <button
                                                    onClick={() => handleEditarClick(c)}
                                                    className="btn btn-outline"
                                                    style={{ padding: "0.375rem 0.5rem", fontSize: "0.75rem", minHeight: "auto" }}
                                                    title="Editar fechas del ciclo"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                            )}

                                            {/* Botón Activar: solo en ciclos inactivos */}
                                            {!c.activo && !readOnly && (
                                                <button
                                                    onClick={() => handleActivarClick(c.id, c.nombre)}
                                                    disabled={activatingId !== null || guardando}
                                                    className="btn btn-outline"
                                                    style={{ padding: "0.375rem 0.75rem", fontSize: "0.75rem", minHeight: "auto", display: "flex", alignItems: "center", gap: "0.25rem" }}
                                                >
                                                    <Play size={12} /> Activar
                                                </button>
                                            )}

                                            {/* Botón Gestionar programas: en el ciclo ACTIVO siempre,
                                                y en ciclos INACTIVOS también (para ver/editar sin activar) */}
                                            {!readOnly && (
                                                <button
                                                    onClick={() => handleGestionarClick(c.id, c.nombre)}
                                                    disabled={guardando}
                                                    className="btn btn-outline"
                                                    style={{ padding: "0.375rem 0.75rem", fontSize: "0.75rem", minHeight: "auto", display: "flex", alignItems: "center", gap: "0.25rem" }}
                                                    title={c.activo ? "Agregar o quitar programas del ciclo activo" : "Ver o editar los programas de este ciclo (sin activarlo)"}
                                                >
                                                    <Settings size={12} /> {c.activo ? "Gestionar programas" : "Ver programas"}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Formulario inline de edición de fechas */}
                                    {editandoId === c.id && !readOnly && (
                                        <div style={{
                                            marginTop: "0.75rem",
                                            padding: "0.75rem",
                                            background: "var(--bg-secondary, #f8fafc)",
                                            borderRadius: "8px",
                                            border: "1px solid var(--border)",
                                            display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end"
                                        }}>
                                            <div>
                                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>Fecha de inicio</label>
                                                <input
                                                    type="date"
                                                    className="input"
                                                    value={editInicio}
                                                    onChange={(e) => setEditInicio(e.target.value)}
                                                    style={{ fontSize: "0.8125rem", padding: "0.375rem 0.5rem" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>Fecha de fin</label>
                                                <input
                                                    type="date"
                                                    className="input"
                                                    value={editFin}
                                                    onChange={(e) => setEditFin(e.target.value)}
                                                    style={{ fontSize: "0.8125rem", padding: "0.375rem 0.5rem" }}
                                                />
                                            </div>
                                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                                <button
                                                    onClick={() => handleGuardarFechas(c.id, c.nombre)}
                                                    disabled={guardandoFechas}
                                                    className="btn btn-primary"
                                                    style={{ padding: "0.375rem 0.75rem", fontSize: "0.75rem", minHeight: "auto", display: "flex", alignItems: "center", gap: "0.25rem" }}
                                                >
                                                    {guardandoFechas ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                    {guardandoFechas ? "Guardando..." : "Guardar"}
                                                </button>
                                                <button
                                                    onClick={() => setEditandoId(null)}
                                                    className="btn btn-outline"
                                                    style={{ padding: "0.375rem 0.5rem", fontSize: "0.75rem", minHeight: "auto" }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>

            {/* AVISO */}
            <div className="card" style={{ marginTop: "1.5rem", background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e" }}>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                    <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div>
                        <strong style={{ fontSize: "0.9375rem", display: "block", marginBottom: "0.25rem" }}>Notas sobre el funcionamiento multiciclo:</strong>
                        <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8125rem", lineHeight: 1.5 }}>
                            <li>Al activar un nuevo ciclo se te preguntará qué programas copiar. Los programas no seleccionados no aparecerán en el nuevo ciclo.</li>
                            <li>En el ciclo activo puedes usar <strong>Gestionar programas</strong> para agregar o quitar programas en cualquier momento.</li>
                            <li>Supervisores y directores pueden alternar entre ciclos pasados desde el menú lateral para consultar históricos.</li>
                            <li>Los expedientes de docentes no se reinician; son datos del centro de trabajo permanentes.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* ── MODAL ──────────────────────────────────────────────────────────── */}
            {modal && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 1000,
                    background: "rgba(0,0,0,0.45)", display: "flex",
                    alignItems: "center", justifyContent: "center", padding: "1rem"
                }}>
                    <div className="card" style={{ width: "100%", maxWidth: "520px", maxHeight: "90vh", overflow: "auto", padding: "1.5rem", position: "relative" }}>
                        {/* Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "1rem" }}>
                                    {modal.modoGestion
                                        ? <><Settings size={18} color="var(--primary)" /> Gestionar programas: {modal.nombreCiclo}</>
                                        : programasDisponibles.some(p => p.tienePeriodos)
                                            ? <><Settings size={18} color="var(--warning, #d97706)" /> Reconfigurar ciclo: {modal.nombreCiclo}</>
                                            : <><Copy size={18} color="var(--primary)" /> Activar ciclo: {modal.nombreCiclo}</>
                                    }
                                </div>
                                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.375rem" }}>
                                    {modal.modoGestion
                                        ? "Marcados = el programa está en este ciclo. Desmarcar lo elimina del ciclo (incluye periodos y entregas)."
                                        : programasDisponibles.some(p => p.tienePeriodos)
                                            ? "Este ciclo ya tiene programas configurados (marcados). Al activarlo se respetará la selección actual. Puedes agregar o quitar programas antes de confirmar."
                                            : "Elige los programas que deseas incluir en este ciclo. Se crearán periodos vacíos listos para recibir entregas."
                                    }
                                </p>
                            </div>
                            <button
                                onClick={() => setModal(null)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Program list */}
                        {loadingProgramas ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)", padding: "1rem 0" }}>
                                <Loader2 size={16} className="spin" /> Cargando programas...
                            </div>
                        ) : programasDisponibles.length === 0 ? (
                            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", padding: "0.5rem 0" }}>
                                No hay programas activos disponibles.
                            </p>
                        ) : (
                            <>
                                {/* Select all row */}
                                <button
                                    onClick={handleSeleccionarTodos}
                                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--primary)", fontWeight: 600, padding: "0 0 0.75rem 0" }}
                                >
                                    {seleccionados.size === programasDisponibles.length
                                        ? <><CheckSquare size={15} /> Deseleccionar todos</>
                                        : <><Square size={15} /> Seleccionar todos</>
                                    }
                                </button>

                                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "1.25rem" }}>
                                    {programasDisponibles.map((p) => (
                                        <label
                                            key={p.id}
                                            style={{
                                                display: "flex", alignItems: "center", gap: "0.625rem",
                                                padding: "0.5rem 0.75rem", borderRadius: "8px", cursor: "pointer",
                                                background: seleccionados.has(p.id) ? "var(--primary-bg, #eff6ff)" : "var(--bg-secondary)",
                                                border: `1px solid ${seleccionados.has(p.id) ? "var(--primary, #3b82f6)" : "var(--border)"}`,
                                                transition: "background 0.15s, border-color 0.15s",
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={seleccionados.has(p.id)}
                                                onChange={() => handleTogglePrograma(p.id)}
                                                style={{ accentColor: "var(--primary)", width: "15px", height: "15px" }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</div>
                                                <div style={{ fontSize: "0.71875rem", color: "var(--text-muted)", display: "flex", gap: "0.5rem" }}>
                                                    <span>{TIPO_LABEL[p.tipo] ?? p.tipo}</span>
                                                    {modal.modoGestion && p.tienePeriodos && (
                                                        <span style={{ color: "var(--success, #16a34a)" }}>• En ciclo</span>
                                                    )}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Actions */}
                        {modal.modoGestion ? (
                            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                <button
                                    className="btn btn-primary"
                                    disabled={guardando}
                                    onClick={handleConfirmarGestion}
                                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}
                                >
                                    {guardando
                                        ? <><Loader2 size={14} className="spin" /> Guardando...</>
                                        : <><CheckCircle2 size={14} /> Guardar cambios</>
                                    }
                                </button>
                                <button
                                    className="btn btn-outline"
                                    disabled={guardando}
                                    onClick={() => setModal(null)}
                                    style={{ fontSize: "0.8125rem" }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                <button
                                    className="btn btn-primary"
                                    disabled={guardando}
                                    onClick={() => handleConfirmarActivacion(true)}
                                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}
                                >
                                    {guardando
                                        ? <><Loader2 size={14} className="spin" /> Activando...</>
                                        : <><CheckCircle2 size={14} /> Activar con {seleccionados.size} programa(s)</>
                                    }
                                </button>
                                <button
                                    className="btn btn-outline"
                                    disabled={guardando}
                                    onClick={() => handleConfirmarActivacion(false)}
                                    style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem" }}
                                    title="El nuevo ciclo iniciará sin ningún programa asignado"
                                >
                                    Iniciar vacío
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
