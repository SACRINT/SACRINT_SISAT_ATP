"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Save, X, Building2, User, Mail, School, Lock, Clock, Plus, Trash2, MapPin, FileDigit, Settings2, Calendar, Sparkles, Check, Ban } from "lucide-react";
import toast from "react-hot-toast";
import { SECCIONES_PERMISOS, DEFAULT_PERMISOS } from "@/lib/constants";
import { ProgramaAdmin } from "@/types";

type Escuela = {
    id: string;
    cct: string;
    nombre: string;
    localidad?: string | null;
    municipio?: string | null;
    zonaEscolar?: string | null;
    director: string | null;
    email: string | null;
    ultimoIngreso?: Date | string | null;
    esDePrueba?: boolean;
    esSupervision?: boolean;
    directorExpediente?: {
        rfc?: string | null;
        curp?: string | null;
        clavePresupuestal?: string | null;
        fechaIngreso?: Date | string | null;
    } | null;
    permisos?: any;
    // Personal con cargo RESPONSABLE para cruzar datos del director
    personal?: {
        id: string;
        nombre: string;
        apellidoPaterno: string;
        apellidoMaterno: string;
        curp?: string | null;
        rfc?: string | null;
        cargo?: string | null;
        clavePresupuestal?: string | null;
        fechaIngreso?: Date | string | null;
        telefono?: string | null;
        correoElectronico?: string | null;
    }[];
};



export default function GestionEscuelas({ inicialEscuelas, programas, readOnly = false }: { inicialEscuelas: Escuela[], programas: ProgramaAdmin[], readOnly?: boolean }) {
    const [escuelas, setEscuelas] = useState<Escuela[]>(inicialEscuelas);
    const [selectedId, setSelectedId] = useState<string>("");
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [tabEscuelas, setTabEscuelas] = useState<"escuelas" | "programas_modulos" | "supervision">("escuelas");
    const [autoridades, setAutoridades] = useState<any>(null);
    const router = useRouter();

    // Handlers para toggle individual y global de Horarios IA y Programas por Escuela
    const handleToggleHorariosEscuela = async (escuelaId: string, desactivado: boolean) => {
        const escTarget = escuelas.find(e => e.id === escuelaId);
        if (!escTarget) return;

        const permisosActuales = escTarget.permisos || {};
        const permisosNuevos = { ...permisosActuales, horariosDesactivado: desactivado };

        // Optimistic UI update
        setEscuelas(prev => prev.map(e => e.id === escuelaId ? { ...e, permisos: permisosNuevos } : e));

        try {
            const res = await fetch(`/api/escuelas/${escuelaId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permisos: permisosNuevos })
            });
            if (res.ok) {
                toast.success(desactivado ? `Generador Horarios IA DESACTIVADO para ${escTarget.nombre}` : `Generador Horarios IA ACTIVADO para ${escTarget.nombre}`);
            } else {
                toast.error("Error al actualizar estado");
            }
        } catch (e) {
            toast.error("Error de red al actualizar");
        }
    };

    const handleToggleGlobalHorarios = async (desactivado: boolean) => {
        setSaving(true);
        try {
            for (const esc of escuelas) {
                if (esc.esSupervision) continue;
                const permisosActuales = esc.permisos || {};
                const permisosNuevos = { ...permisosActuales, horariosDesactivado: desactivado };
                await fetch(`/api/escuelas/${esc.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ permisos: permisosNuevos })
                });
            }
            setEscuelas(prev => prev.map(e => ({
                ...e,
                permisos: { ...(e.permisos || {}), horariosDesactivado: desactivado }
            })));
            toast.success(desactivado ? "Módulo Horarios IA DESACTIVADO para TODAS las escuelas" : "Módulo Horarios IA ACTIVADO para TODAS las escuelas");
        } catch (e) {
            toast.error("Error al realizar cambio global");
        } finally {
            setSaving(false);
        }
    };

    const handleToggleProgramaEscuela = async (escuelaId: string, programaId: string, activar: boolean) => {
        const escTarget = escuelas.find(e => e.id === escuelaId);
        if (!escTarget) return;

        const permisosActuales = escTarget.permisos || {};
        let inactivos: string[] = Array.isArray(permisosActuales.programasInactivos) ? [...permisosActuales.programasInactivos] : [];

        if (activar) {
            inactivos = inactivos.filter(id => id !== programaId);
        } else {
            if (!inactivos.includes(programaId)) inactivos.push(programaId);
        }

        const permisosNuevos = { ...permisosActuales, programasInactivos: inactivos };

        setEscuelas(prev => prev.map(e => e.id === escuelaId ? { ...e, permisos: permisosNuevos } : e));

        try {
            const res = await fetch(`/api/escuelas/${escuelaId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permisos: permisosNuevos })
            });
            if (res.ok) {
                toast.success(activar ? `Programa activado para ${escTarget.nombre}` : `Programa desactivado para ${escTarget.nombre}`);
            } else {
                toast.error("Error al actualizar programa");
            }
        } catch (e) {
            toast.error("Error al guardar permiso de programa");
        }
    };

    // Fetch Autoridades Educativas
    useEffect(() => {
        fetch("/api/admin/autoridades-config")
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) setAutoridades(data);
            })
            .catch(err => console.error("Error loading autoridades:", err));
    }, []);

    // Form state
    const [formData, setFormData] = useState<{ cct: string; nombre: string; localidad: string; municipio: string; zonaEscolar: string; director: string; email: string; password?: string; rfc?: string; curp?: string; clavePresupuestal?: string; fechaIngreso?: string; esDePrueba?: boolean; esSupervision?: boolean; permisos?: any }>({
        cct: "",
        nombre: "",
        localidad: "",
        municipio: "",
        zonaEscolar: "",
        director: "",
        email: "",
        password: "",
        rfc: "",
        curp: "",
        clavePresupuestal: "",
        fechaIngreso: "",
        esDePrueba: false,
        esSupervision: false,
        permisos: { ...DEFAULT_PERMISOS },
    });

    const selectedEscuela = escuelas.find((e) => e.id === selectedId);

    // Custom configuration state
    const [configuraciones, setConfiguraciones] = useState<Record<string, number>>({});
    const [loadingConfig, setLoadingConfig] = useState(false);

    const cargarDatosEscuela = (id: string) => {
        setSelectedId(id);
        setIsEditing(false);
        setIsCreating(false);
        setMessage(null);

        if (id) {
            const esc = escuelas.find(sc => sc.id === id);
            if (esc) {
                // Cruzar directorExpediente con el Personal RESPONSABLE.
                // directorExpediente tiene prioridad; se usa personal[0] para llenar huecos.
                const responsable = esc.personal?.[0] ?? null;
                const exp = esc.directorExpediente;

                const getRFC              = exp?.rfc              || responsable?.rfc              || (esc.esSupervision ? autoridades?.supervisorRFC : "") || "";
                const getCURP             = exp?.curp             || responsable?.curp             || ""; // autoridades doesn't have curp
                const getClavePresup      = exp?.clavePresupuestal|| responsable?.clavePresupuestal|| (esc.esSupervision ? autoridades?.supervisorClave : "") || "";
                const getFechaIngreso     = exp?.fechaIngreso     || responsable?.fechaIngreso     || (esc.esSupervision ? autoridades?.supervisorFecha : null);

                setFormData(prev => ({
                    ...prev,
                    cct: esc.cct,
                    nombre: esc.nombre,
                    localidad: esc.localidad || "",
                    municipio: esc.municipio || "",
                    zonaEscolar: esc.zonaEscolar || "",
                    director: esc.esSupervision ? (esc.director || "") : (esc.director || ""),
                    email: esc.email || "",
                    password: "",
                    rfc: getRFC,
                    curp: getCURP,
                    clavePresupuestal: getClavePresup,
                    fechaIngreso: getFechaIngreso ? new Date(getFechaIngreso).toISOString().split('T')[0] : "",
                    esDePrueba: esc.esDePrueba ?? false,
                    esSupervision: esc.esSupervision ?? false,
                    permisos: esc.permisos || { ...DEFAULT_PERMISOS },
                }));

                // Fetch configuraciones
                setLoadingConfig(true);
                fetch(`/api/escuelas/${id}/configuracion`)
                    .then(res => res.json())
                    .then(data => {
                        const map: Record<string, number> = {};
                        if (Array.isArray(data)) {
                            data.forEach((c: any) => map[c.programaId] = c.numArchivos);
                        }
                        setConfiguraciones(map);
                    })
                    .catch(e => console.error("Error al obtener configuracion:", e))
                    .finally(() => setLoadingConfig(false));
            }
        } else {
            setConfiguraciones({});
        }
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        cargarDatosEscuela(e.target.value);
    };

    const startCreating = () => {
        setSelectedId("");
        setIsCreating(true);
        setIsEditing(false);
        setMessage(null);
        setFormData({ cct: "", nombre: "", localidad: "", municipio: "", zonaEscolar: "", director: "", email: "", password: "", esDePrueba: false, esSupervision: false, permisos: { ...DEFAULT_PERMISOS } });
        setConfiguraciones({});
    };

    const handleSave = async () => {
        if (!isCreating && !selectedId) return;
        
        if (formData.cct && !/^\d{2}[A-Z]{3}\d{4}[A-Z]$/.test(formData.cct.toUpperCase().trim())) {
            setMessage({ type: "error", text: "El formato de CCT es inválido. Debe tener 10 caracteres en formato oficial SEP (ej. 21EBH0088T)." });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const url = isCreating ? `/api/escuelas` : `/api/escuelas/${selectedId}`;
            const method = isCreating ? "POST" : "PUT";

            const payload = {
                ...formData,
                director: (formData.esSupervision || selectedEscuela?.esSupervision) && !formData.director && autoridades?.nombreSupervisor 
                          ? autoridades.nombreSupervisor 
                          : formData.director,
                rfc: (formData.esSupervision || selectedEscuela?.esSupervision) && !formData.rfc && autoridades?.supervisorRFC
                          ? autoridades.supervisorRFC
                          : formData.rfc,
                clavePresupuestal: (formData.esSupervision || selectedEscuela?.esSupervision) && !formData.clavePresupuestal && autoridades?.supervisorClave
                          ? autoridades.supervisorClave
                          : formData.clavePresupuestal,
                fechaIngreso: (formData.esSupervision || selectedEscuela?.esSupervision) && !formData.fechaIngreso && autoridades?.supervisorFecha
                          ? new Date(autoridades.supervisorFecha).toISOString().split('T')[0]
                          : formData.fechaIngreso,
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "No se pudo guardar la escuela");
            }

            const savedEscuela = await res.json();

            if (isCreating) {
                setEscuelas([...escuelas, savedEscuela]);
                setSelectedId(savedEscuela.id);
                setIsCreating(false);
            } else {
                setEscuelas(prev => prev.map(e => e.id === selectedId ? { ...e, ...savedEscuela } : e));
                setIsEditing(false);
            }

            // Save configuraciones
            const schoolId = isCreating ? savedEscuela.id : selectedId;
            const configData = Object.keys(configuraciones).map(progId => ({ programaId: progId, numArchivos: configuraciones[progId] }));

            await fetch(`/api/escuelas/${schoolId}/configuracion`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ configuraciones: configData })
            });

            setMessage({ type: "success", text: isCreating ? "Nueva escuela agregada correctamente." : "Datos actualizados correctamente." });


            router.refresh();
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedId || !selectedEscuela) return;
        if (!confirm(`¿Estás SEGURO de eliminar la escuela ${selectedEscuela.nombre} (${selectedEscuela.cct})? Esta acción eliminará TAMBIÉN todas sus entregas, archivos y correcciones, y NO se puede deshacer.`)) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/escuelas/${selectedId}`, { method: "DELETE" });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "No se pudo eliminar");
            }

            setEscuelas(prev => prev.filter(e => e.id !== selectedId));
            setSelectedId("");
            setMessage({ type: "success", text: "Escuela eliminada correctamente." });
            router.refresh();
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setSaving(false);
        }
    };

    const showForm = isCreating || selectedEscuela;
    const isEditingMode = isCreating || isEditing;

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 style={{ margin: 0 }}>Gestión de Centros de Trabajo</h1>
                    <p style={{ color: "var(--text-secondary)", margin: 0, marginTop: "0.25rem" }}>
                        Agrega nuevas escuelas, dale de baja o edita sus datos.
                    </p>
                </div>
                {!readOnly && (
                    <button className="btn btn-primary" onClick={startCreating}>
                        <Plus size={18} /> Agregar Escuela
                    </button>
                )}
            </div>

            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1.5rem" }}>
                    {message.text}
                </div>
            )}

            {!isCreating && (
                <div className="card" style={{ marginBottom: "2rem" }}>
                    <div className="tab-list" style={{ marginTop: "-1rem", marginLeft: "-1rem", marginRight: "-1rem", paddingLeft: "1.5rem", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
                        <button 
                            className={`tab-item ${tabEscuelas === "escuelas" ? "active" : ""}`}
                            onClick={() => { 
                                setTabEscuelas("escuelas"); 
                                setSelectedId(""); 
                            }}
                        >
                            Escuelas
                        </button>
                        <button 
                            className={`tab-item ${tabEscuelas === "programas_modulos" ? "active" : ""}`}
                            onClick={() => { 
                                setTabEscuelas("programas_modulos"); 
                                setSelectedId(""); 
                            }}
                        >
                            ⚙️ Programas y Módulos por Escuela
                        </button>
                        <button 
                            className={`tab-item ${tabEscuelas === "supervision" ? "active" : ""}`}
                            onClick={() => { 
                                setTabEscuelas("supervision"); 
                                const supervisiones = escuelas.filter(e => e.esSupervision);
                                if (supervisiones.length === 1) {
                                    cargarDatosEscuela(supervisiones[0].id);
                                } else {
                                    cargarDatosEscuela("");
                                }
                            }}
                        >
                            Supervisiones
                        </button>
                    </div>

                    {tabEscuelas === "programas_modulos" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                            {/* Banner Informativo con Botones de Acción Global */}
                            <div style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)", border: "1px solid #bfdbfe", padding: "1.25rem", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                                <div>
                                    <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <Settings2 style={{ width: "20px", height: "20px", color: "#2563eb" }} /> Matriz de Activación de Módulos y Programas por Escuela
                                    </h3>
                                    <p style={{ fontSize: "0.78125rem", color: "#475569", margin: "0.25rem 0 0" }}>
                                        Active o desactive funciones específicas (como el Generador de Horarios IA o programas individuales) para cada escuela en particular o de forma masiva.
                                    </p>
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => handleToggleGlobalHorarios(false)}
                                        style={{ background: "#2563eb", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.75rem", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}
                                    >
                                        <Sparkles size={14} /> Activar Horarios IA para TODAS
                                    </button>
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => handleToggleGlobalHorarios(true)}
                                        style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}
                                    >
                                        <Ban size={14} /> Desactivar Horarios IA para TODAS
                                    </button>
                                </div>
                            </div>

                            {/* Tabla Matriz Interactivas */}
                            <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflowX: "auto", background: "var(--bg)" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                                    <thead>
                                        <tr style={{ background: "var(--bg-secondary)", borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                                            <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text)" }}>Escuela / CCT</th>
                                            <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "#1d4ed8", textAlign: "center", minWidth: "150px" }}>📅 Horarios IA</th>
                                            {programas.map((prog) => (
                                                <th key={prog.id} style={{ padding: "0.75rem 0.5rem", fontWeight: 700, color: "var(--text-secondary)", textAlign: "center", minWidth: "110px" }}>
                                                    {prog.nombre}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {escuelas.filter(e => !e.esSupervision).map((esc) => {
                                            const permisosEsc = esc.permisos || {};
                                            const horariosActivo = permisosEsc.horariosDesactivado !== true;
                                            const programasInactivos: string[] = permisosEsc.programasInactivos || [];

                                            return (
                                                <tr key={esc.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                                    <td style={{ padding: "0.75rem 1rem" }}>
                                                        <div style={{ fontWeight: 800, color: "var(--text)" }}>{esc.nombre}</div>
                                                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>{esc.cct} • {esc.localidad || "Puebla"}</div>
                                                    </td>

                                                    {/* Toggle Horarios IA */}
                                                    <td style={{ textAlign: "center", padding: "0.75rem" }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleHorariosEscuela(esc.id, !horariosActivo)}
                                                            style={{
                                                                padding: "0.35rem 0.75rem",
                                                                borderRadius: "20px",
                                                                fontWeight: 800,
                                                                fontSize: "0.725rem",
                                                                border: "none",
                                                                cursor: "pointer",
                                                                background: horariosActivo ? "#dcfce7" : "#fee2e2",
                                                                color: horariosActivo ? "#15803d" : "#b91c1c",
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "0.35rem"
                                                            }}
                                                        >
                                                            {horariosActivo ? "🟢 Activo" : "🔴 Desactivado"}
                                                        </button>
                                                    </td>

                                                    {/* Toggles por Programa */}
                                                    {programas.map((prog) => {
                                                        const progActivo = !programasInactivos.includes(prog.id);
                                                        return (
                                                            <td key={prog.id} style={{ textAlign: "center", padding: "0.5rem" }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleProgramaEscuela(esc.id, prog.id, !progActivo)}
                                                                    title={progActivo ? `Haga clic para desactivar ${prog.nombre} en ${esc.nombre}` : `Haga clic para activar ${prog.nombre} en ${esc.nombre}`}
                                                                    style={{
                                                                        padding: "0.25rem 0.5rem",
                                                                        borderRadius: "6px",
                                                                        fontSize: "0.6875rem",
                                                                        fontWeight: 700,
                                                                        border: "1px solid " + (progActivo ? "#bbf7d0" : "#fca5a5"),
                                                                        background: progActivo ? "#f0fdf4" : "#fef2f2",
                                                                        color: progActivo ? "#16a34a" : "#dc2626",
                                                                        cursor: "pointer"
                                                                    }}
                                                                >
                                                                    {progActivo ? "✓ Activo" : "✕ Inactivo"}
                                                                </button>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : tabEscuelas === "supervision" && escuelas.filter(e => e.esSupervision).length === 1 ? (
                        <h3 style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Building2 size={20} color="var(--primary)" />
                            Supervisión
                        </h3>
                    ) : (
                        <>
                            <h3 style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Building2 size={20} color="var(--primary)" />
                                Seleccionar {tabEscuelas === "escuelas" ? "Escuela" : "Supervisión"} (CCT)
                            </h3>
                            <select
                                className="form-control"
                                value={selectedId}
                                onChange={handleSelectChange}
                                style={{ padding: "0.75rem", fontSize: "1rem", cursor: "pointer", width: "100%" }}
                            >
                                <option value="">-- Elige un Centro de Trabajo --</option>
                                {escuelas.filter(e => tabEscuelas === "escuelas" ? (!e.esSupervision) : (e.esSupervision))
                                    .sort((a, b) => {
                                        if (a.esDePrueba && !b.esDePrueba) return 1;
                                        if (!a.esDePrueba && b.esDePrueba) return -1;
                                        return a.nombre.localeCompare(b.nombre);
                                    })
                                    .map(escuela => (
                                    <option key={escuela.id} value={escuela.id}>
                                        {escuela.cct} - {escuela.nombre}
                                    </option>
                                ))}
                            </select>
                        </>
                    )}
                </div>
            )}

            {showForm && (
                <div className="card fade-in">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: "1rem" }}>
                        <h3 style={{ margin: 0, color: "var(--text)" }}>{isCreating ? "Nueva Escuela" : "Datos Generales"}</h3>
                        {!isEditingMode && selectedEscuela && !readOnly ? (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button className="btn btn-outline" onClick={() => setIsEditing(true)}>
                                    <Edit2 size={16} /> Modificar Datos
                                </button>
                                <button className="btn btn-outline" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={handleDelete} disabled={saving}>
                                    <Trash2 size={16} /> Eliminar Escuela
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button className="btn btn-outline" onClick={() => {
                                    if (isCreating) {
                                        setIsCreating(false);
                                    } else {
                                        setIsEditing(false);
                                        if (selectedEscuela) {
                                            setFormData({ cct: selectedEscuela.cct, nombre: selectedEscuela.nombre, localidad: selectedEscuela.localidad || "", municipio: selectedEscuela.municipio || "", zonaEscolar: selectedEscuela.zonaEscolar || "", director: selectedEscuela.director || "", email: selectedEscuela.email || "", password: "" });
                                        }
                                    }
                                }} disabled={saving}>
                                    <X size={16} /> Cancelar
                                </button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                    <Save size={16} /> {saving ? "Guardando..." : "Guardar"}
                                </button>
                            </div>
                        )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<Building2 size={14} />} /> Clave de Centro de Trabajo (CCT)
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={isEditingMode ? formData.cct : selectedEscuela?.cct}
                                onChange={(e) => setFormData({ ...formData, cct: e.target.value.toUpperCase() })}
                                disabled={!isCreating}
                                placeholder="Ej: 21EBH0000Z"
                                style={{
                                    ...(!isCreating && !isEditingMode ? { background: "var(--bg)", color: "var(--text-muted)", cursor: "not-allowed" } : {}),
                                    ...(!isCreating && isEditingMode ? { background: "var(--bg)", color: "var(--text-muted)", cursor: "not-allowed" } : {}),
                                    ...(isCreating ? { border: "1px dashed var(--border)" } : {})
                                }}
                                title={!isCreating ? "La CCT no se puede modificar una vez creada." : ""}
                            />
                        </div>

                        {!isCreating && selectedEscuela && (
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                    <BadgeIcon icon={<Clock size={14} />} /> Último Acceso
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={selectedEscuela.ultimoIngreso ? new Date(selectedEscuela.ultimoIngreso).toLocaleString("es-MX") : "Nunca"}
                                    disabled
                                    style={{ background: "var(--bg)", color: "var(--text-muted)", cursor: "not-allowed" }}
                                />
                            </div>
                        )}

                        <div>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem", cursor: isEditingMode ? "pointer" : "default" }}>
                                <input
                                    type="checkbox"
                                    checked={isEditingMode ? formData.esDePrueba : (selectedEscuela?.esDePrueba ?? false)}
                                    onChange={(e) => setFormData({ ...formData, esDePrueba: e.target.checked })}
                                    disabled={!isEditingMode}
                                    style={{ width: "1rem", height: "1rem", cursor: isEditingMode ? "pointer" : "default" }}
                                />
                                <BadgeIcon icon={<Building2 size={14} />} /> Esta institución es de PRUEBA (se excluye de estadísticas)
                            </label>

                            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1rem", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem", cursor: isEditingMode ? "pointer" : "default" }}>
                                <input
                                    type="checkbox"
                                    checked={isEditingMode ? formData.esSupervision : (selectedEscuela?.esSupervision ?? false)}
                                    onChange={(e) => setFormData({ ...formData, esSupervision: e.target.checked })}
                                    disabled={!isEditingMode}
                                    style={{ width: "1rem", height: "1rem", cursor: isEditingMode ? "pointer" : "default" }}
                                />
                                <BadgeIcon icon={<School size={14} />} /> Esta institución tiene rol de SUPERVISIÓN (verá portal de zona).
                            </label>

                            {((isEditingMode && formData.esSupervision) || (!isEditingMode && selectedEscuela?.esSupervision)) && (
                                <div style={{ marginTop: "0.5rem", padding: "1rem", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                                    <h4 style={{ margin: "0 0 1rem 0", fontSize: "0.875rem", color: "var(--text)" }}>Permisos de la Supervisión</h4>
                                    <div style={{ 
                                        maxHeight: "220px", 
                                        overflowY: "auto", 
                                        border: "1px solid var(--border)", 
                                        borderRadius: "6px",
                                        background: "var(--bg)",
                                        fontSize: "0.8125rem"
                                    }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                            <thead>
                                                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 1 }}>
                                                    <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600 }}>Sección</th>
                                                    <th style={{ textAlign: "center", padding: "0.5rem 0.25rem", fontWeight: 600, width: "80px" }}>Ninguno</th>
                                                    <th style={{ textAlign: "center", padding: "0.5rem 0.25rem", fontWeight: 600, width: "80px" }}>Lectura</th>
                                                    <th style={{ textAlign: "center", padding: "0.5rem 0.25rem", fontWeight: 600, width: "80px" }}>Escritura</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {SECCIONES_PERMISOS.map((sec) => {
                                                    const permisosActuales = isEditingMode ? formData.permisos : (selectedEscuela?.permisos || DEFAULT_PERMISOS);
                                                    const currentVal = permisosActuales[sec.key] || "NINGUNO";
                                                    
                                                    const handleParentChange = (newVal: string) => {
                                                        if (!isEditingMode) return;
                                                        const newPermisos = { ...formData.permisos, [sec.key]: newVal };
                                                        if (sec.sub) {
                                                            sec.sub.forEach(subItem => {
                                                                newPermisos[subItem.key] = newVal;
                                                            });
                                                        }
                                                        setFormData(prev => ({ ...prev, permisos: newPermisos }));
                                                    };

                                                    return (
                                                        <React.Fragment key={sec.key}>
                                                            <tr style={{ borderBottom: "1px solid var(--border)", background: sec.sub ? "var(--bg-secondary)" : "transparent" }}>
                                                                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500, color: !isEditingMode ? "var(--text-muted)" : "var(--text)" }}>{sec.label}</td>
                                                                <td style={{ textAlign: "center", padding: "0.25rem" }}>
                                                                    <input
                                                                        type="radio"
                                                                        name={`permiso-${sec.key}`}
                                                                        checked={currentVal === "NINGUNO"}
                                                                        onChange={() => handleParentChange("NINGUNO")}
                                                                        disabled={!isEditingMode}
                                                                        style={{ cursor: isEditingMode ? "pointer" : "not-allowed" }}
                                                                    />
                                                                </td>
                                                                <td style={{ textAlign: "center", padding: "0.25rem" }}>
                                                                    <input
                                                                        type="radio"
                                                                        name={`permiso-${sec.key}`}
                                                                        checked={currentVal === "LECTURA"}
                                                                        onChange={() => handleParentChange("LECTURA")}
                                                                        disabled={!isEditingMode}
                                                                        style={{ cursor: isEditingMode ? "pointer" : "not-allowed" }}
                                                                    />
                                                                </td>
                                                                <td style={{ textAlign: "center", padding: "0.25rem" }}>
                                                                    <input
                                                                        type="radio"
                                                                        name={`permiso-${sec.key}`}
                                                                        checked={currentVal === "ESCRITURA"}
                                                                        onChange={() => handleParentChange("ESCRITURA")}
                                                                        disabled={!isEditingMode}
                                                                        style={{ cursor: isEditingMode ? "pointer" : "not-allowed" }}
                                                                    />
                                                                </td>
                                                            </tr>
                                                            {sec.sub && sec.sub.map((subItem) => {
                                                                const subVal = permisosActuales[subItem.key] || "NINGUNO";
                                                                return (
                                                                    <tr key={subItem.key} style={{ borderBottom: "1px solid var(--border)" }}>
                                                                        <td style={{ padding: "0.5rem 0.75rem 0.5rem 2rem", fontSize: "0.75rem", color: !isEditingMode ? "var(--text-muted)" : "var(--text)" }}>└ {subItem.label}</td>
                                                                        <td style={{ textAlign: "center", padding: "0.25rem" }}>
                                                                            <input
                                                                                type="radio"
                                                                                name={`permiso-${subItem.key}`}
                                                                                checked={subVal === "NINGUNO"}
                                                                                onChange={() => {
                                                                                    if (isEditingMode) {
                                                                                        setFormData(prev => ({
                                                                                            ...prev,
                                                                                            permisos: { ...prev.permisos, [subItem.key]: "NINGUNO" }
                                                                                        }));
                                                                                    }
                                                                                }}
                                                                                disabled={!isEditingMode}
                                                                                style={{ cursor: isEditingMode ? "pointer" : "not-allowed" }}
                                                                            />
                                                                        </td>
                                                                        <td style={{ textAlign: "center", padding: "0.25rem" }}>
                                                                            <input
                                                                                type="radio"
                                                                                name={`permiso-${subItem.key}`}
                                                                                checked={subVal === "LECTURA"}
                                                                                onChange={() => {
                                                                                    if (isEditingMode) {
                                                                                        setFormData(prev => ({
                                                                                            ...prev,
                                                                                            permisos: { ...prev.permisos, [subItem.key]: "LECTURA" }
                                                                                        }));
                                                                                    }
                                                                                }}
                                                                                disabled={!isEditingMode}
                                                                                style={{ cursor: isEditingMode ? "pointer" : "not-allowed" }}
                                                                            />
                                                                        </td>
                                                                        <td style={{ textAlign: "center", padding: "0.25rem" }}>
                                                                            <input
                                                                                type="radio"
                                                                                name={`permiso-${subItem.key}`}
                                                                                checked={subVal === "ESCRITURA"}
                                                                                onChange={() => {
                                                                                    if (isEditingMode) {
                                                                                        setFormData(prev => ({
                                                                                            ...prev,
                                                                                            permisos: { ...prev.permisos, [subItem.key]: "ESCRITURA" }
                                                                                        }));
                                                                                    }
                                                                                }}
                                                                                disabled={!isEditingMode}
                                                                                style={{ cursor: isEditingMode ? "pointer" : "not-allowed" }}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<School size={14} />} /> Nombre de la Escuela
                            </label>
                            <textarea
                                className="form-control"
                                rows={2}
                                value={isEditingMode ? formData.nombre : selectedEscuela?.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                disabled={!isEditingMode}
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)" } : {}),
                                    resize: "vertical", fontFamily: "inherit"
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<MapPin size={14} />} /> Localidad
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={isEditingMode ? formData.localidad : (selectedEscuela?.localidad || "No especificado")}
                                onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder="Ej: Puebla, Pue."
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !selectedEscuela?.localidad ? "italic" : "normal", color: !selectedEscuela?.localidad ? "var(--text-muted)" : "inherit" } : {}),
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<MapPin size={14} />} /> Municipio
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={isEditingMode ? formData.municipio : (selectedEscuela?.municipio || "No especificado")}
                                onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder="Ej: Venustiano Carranza"
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !selectedEscuela?.municipio ? "italic" : "normal", color: !selectedEscuela?.municipio ? "var(--text-muted)" : "inherit" } : {}),
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<MapPin size={14} />} /> Zona Escolar
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={isEditingMode ? formData.zonaEscolar : (selectedEscuela?.zonaEscolar || "No especificado")}
                                onChange={(e) => setFormData({ ...formData, zonaEscolar: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder="Ej: 004"
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !selectedEscuela?.zonaEscolar ? "italic" : "normal", color: !selectedEscuela?.zonaEscolar ? "var(--text-muted)" : "inherit" } : {}),
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<User size={14} />} /> {formData.esSupervision || selectedEscuela?.esSupervision ? "Nombre del Supervisor(a)" : "Nombre del Director(a)"}
                            </label>
                            <textarea
                                className="form-control"
                                rows={2}
                                value={isEditingMode ? formData.director : (selectedEscuela?.esSupervision && autoridades?.nombreSupervisor ? autoridades.nombreSupervisor : (selectedEscuela?.director || "No especificado"))}
                                onChange={(e) => setFormData({ ...formData, director: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder={formData.esSupervision || selectedEscuela?.esSupervision ? "Ej: Mtro. Juan Pérez (Supervisor)" : "Ej: Mtro. Juan Pérez"}
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !(selectedEscuela?.director || (selectedEscuela?.esSupervision && autoridades?.nombreSupervisor)) ? "italic" : "normal", color: !(selectedEscuela?.director || (selectedEscuela?.esSupervision && autoridades?.nombreSupervisor)) ? "var(--text-muted)" : "inherit" } : {}),
                                    resize: "vertical", fontFamily: "inherit"
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<Mail size={14} />} /> Correo Electrónico (Notificaciones y Acceso)
                            </label>
                            <textarea
                                className="form-control"
                                rows={2}
                                value={isEditingMode ? formData.email : (selectedEscuela?.email || "No especificado")}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder="ejemplo@escuela.edu.mx"
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !selectedEscuela?.email ? "italic" : "normal", color: !selectedEscuela?.email ? "var(--text-muted)" : "inherit" } : {}),
                                    resize: "vertical", fontFamily: "inherit"
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<Lock size={14} />} /> {isCreating ? "Contraseña de Acceso Inicial" : "Cambiar Contraseña de Acceso"}
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={formData.password || ""}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder={isCreating ? "Contraseña obligatoria" : isEditingMode ? "Escribe la nueva contraseña aquí..." : "********"}
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", color: "var(--text-muted)", fontStyle: "italic" } : {}),
                                }}
                            />
                            {isEditing && !isCreating && (
                                <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                    Deja este campo en blanco si no deseas cambiar la contraseña actual del director.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="card fade-in" style={{ marginTop: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
                        <h3 style={{ margin: 0, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <User size={20} color="var(--primary)" /> {tabEscuelas === "supervision" ? "Datos del Supervisor" : "Datos del Director"}
                        </h3>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                RFC
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={formData.rfc || ""}
                                onChange={(e) => setFormData({ ...formData, rfc: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder="Ej: VECJ880326 XXX"
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !formData.rfc ? "italic" : "normal", color: !formData.rfc ? "var(--text-muted)" : "inherit" } : {}),
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                CURP
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={formData.curp || ""}
                                onChange={(e) => setFormData({ ...formData, curp: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder="Ej: VECJ880326HPLRXA05"
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !formData.curp ? "italic" : "normal", color: !formData.curp ? "var(--text-muted)" : "inherit" } : {}),
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                Clave Presupuestal
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={formData.clavePresupuestal || ""}
                                onChange={(e) => setFormData({ ...formData, clavePresupuestal: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder="Ej: 11007130200.0"
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !formData.clavePresupuestal ? "italic" : "normal", color: !formData.clavePresupuestal ? "var(--text-muted)" : "inherit" } : {}),
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                Fecha de Ingreso
                            </label>
                            <input
                                type="date"
                                className="form-control"
                                value={formData.fechaIngreso || ""}
                                onChange={(e) => setFormData({ ...formData, fechaIngreso: e.target.value })}
                                disabled={!isEditingMode}
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !formData.fechaIngreso ? "italic" : "normal", color: !formData.fechaIngreso ? "var(--text-muted)" : "inherit" } : {}),
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {showForm && tabEscuelas !== "supervision" && (
                <div className="card fade-in" style={{ marginTop: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
                        <h3 style={{ margin: 0, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <FileDigit size={20} color="var(--primary)" /> Configuración de Entregas (Archivos)
                        </h3>
                    </div>
                    {loadingConfig ? (
                        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Cargando configuración...</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: "0 0 0.5rem 0" }}>
                                Ajusta cuántos archivos debe subir esta escuela para cada programa específico.
                                Si lo dejas vacío, se usará el valor por defecto del programa.
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
                                {programas.map(prog => {
                                    const value = configuraciones[prog.id];
                                    return (
                                        <div key={prog.id} style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                            <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem", color: "var(--text)" }}>
                                                {prog.nombre}
                                            </div>
                                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                                                Por defecto: {prog.numArchivos} archivo(s)
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="50"
                                                    className="form-control"
                                                    disabled={!isEditingMode}
                                                    value={value !== undefined ? value : ""}
                                                    onChange={(e) => {
                                                        const num = parseInt(e.target.value);
                                                        setConfiguraciones(prev => {
                                                            const next = { ...prev };
                                                            if (isNaN(num)) {
                                                                delete next[prog.id];
                                                            } else {
                                                                next[prog.id] = num;
                                                            }
                                                            return next;
                                                        });
                                                    }}
                                                    placeholder={`Usar defecto (${prog.numArchivos})`}
                                                    style={{
                                                        padding: "0.375rem 0.5rem", width: "100%",
                                                        ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", color: "var(--text-muted)" } : {})
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function BadgeIcon({ icon }: { icon: React.ReactNode }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", background: "var(--primary-bg)", color: "var(--primary)", borderRadius: "4px", marginRight: "0.5rem", padding: "4px" }}>
            {icon}
        </span>
    );
}
