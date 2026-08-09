"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Save, X, Building2, User, Mail, School, Lock, Clock, Plus, Trash2, MapPin, FileDigit, Calendar, Sparkles, Check, Ban, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { SECCIONES_PERMISOS, DEFAULT_PERMISOS } from "@/lib/constants";
import { ProgramaAdmin } from "@/types";
import { FORMACIONES_LABORALES, FFE_OPTATIVAS_CATALOGO, generarGruposPorEstructura } from "@/lib/escuela-grupos";
import ModalConfiguracionMapaCurricular from "@/components/ModalConfiguracionMapaCurricular";

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
    gruposPrimerAno?: number;
    gruposSegundoAno?: number;
    gruposTercerAno?: number;
    mapaCurricularCompletado?: boolean;
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
    const [tabEscuelas, setTabEscuelas] = useState<"escuelas" | "supervision">("escuelas");
    const [autoridades, setAutoridades] = useState<any>(null);
    const router = useRouter();

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
    const [formData, setFormData] = useState<{ cct: string; nombre: string; localidad: string; municipio: string; zonaEscolar: string; director: string; email: string; password?: string; rfc?: string; curp?: string; clavePresupuestal?: string; fechaIngreso?: string; esDePrueba?: boolean; esSupervision?: boolean; permisos?: any; gruposPrimerAno?: number; gruposSegundoAno?: number; gruposTercerAno?: number }>({
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
        gruposPrimerAno: 1,
        gruposSegundoAno: 1,
        gruposTercerAno: 1,
        permisos: { ...DEFAULT_PERMISOS },
    });

    const selectedEscuela = escuelas.find((e) => e.id === selectedId);

    const [configuraciones, setConfiguraciones] = useState<Record<string, number>>({});
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [gruposConfigList, setGruposConfigList] = useState<any[]>([]);
    const [mapaModalAbierto, setMapaModalAbierto] = useState(false);

    const handleGuardarCapacitacionEscuela = async (grupoNombre: string, semestre: number, capacitacionNombre: string, ffeOptativas?: string[]) => {
        if (!selectedId) return;
        try {
            const res = await fetch(`/api/escuelas/${selectedId}/grupos-config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ grupoNombre, semestre, capacitacionNombre, ffeOptativas })
            });
            if (!res.ok) throw new Error("Error al guardar");
            toast.success(`Capacitación ${capacitacionNombre} guardada para Grupo ${grupoNombre}`);
            setGruposConfigList(prev => {
                const idx = prev.findIndex((g: any) => g.nombre === grupoNombre);
                if (idx >= 0) {
                    const copia = [...prev];
                    copia[idx] = { ...copia[idx], capacitacionNombre, ffeOptativas };
                    return copia;
                }
                return [...prev, { nombre: grupoNombre, semestre, capacitacionNombre, ffeOptativas }];
            });
        } catch (err: any) {
            toast.error("Error al actualizar la configuración del grupo");
        }
    };

    const handleReiniciarMapaEscuela = async () => {
        if (!selectedId) return;
        if (!confirm(`¿Estás SEGURO de reiniciar y borrar el Mapa Curricular de ${selectedEscuela?.nombre}? La escuela volverá a estado PENDIENTE.`)) return;

        try {
            const res = await fetch(`/api/escuelas/${selectedId}/mapa-curricular`, { method: "DELETE" });
            if (!res.ok) throw new Error("Error al reiniciar");
            toast.success("Mapa curricular reiniciado exitosamente");
            setGruposConfigList([]);
            router.refresh();
        } catch (err: any) {
            toast.error("Error al reiniciar el mapa curricular");
        }
    };

    const cargarDatosEscuela = (id: string) => {
        setSelectedId(id);
        setIsEditing(false);
        setIsCreating(false);
        setMessage(null);

        if (id) {
            const esc = escuelas.find(sc => sc.id === id);
            if (esc) {
                // Cruzar directorExpediente con el Personal RESPONSABLE.
                const responsable = esc.personal?.[0] ?? null;
                const exp = esc.directorExpediente;

                const getRFC              = exp?.rfc              || responsable?.rfc              || (esc.esSupervision ? autoridades?.supervisorRFC : "") || "";
                const getCURP             = exp?.curp             || responsable?.curp             || "";
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
                    gruposPrimerAno: esc.gruposPrimerAno ?? 1,
                    gruposSegundoAno: esc.gruposSegundoAno ?? 1,
                    gruposTercerAno: esc.gruposTercerAno ?? 1,
                    permisos: esc.permisos || { ...DEFAULT_PERMISOS },
                }));

                // Fetch configuraciones de programas
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

                // Fetch configuraciones de grupos y capacitaciones
                fetch(`/api/horarios/configuracion?escuelaId=${id}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.escuela) {
                            const { gruposPrimerAno, gruposSegundoAno, gruposTercerAno, mapaCurricularCompletado } = data.escuela;
                            setEscuelas(prev => prev.map(e => e.id === id ? {
                                ...e,
                                gruposPrimerAno: gruposPrimerAno ?? 1,
                                gruposSegundoAno: gruposSegundoAno ?? 1,
                                gruposTercerAno: gruposTercerAno ?? 1,
                                mapaCurricularCompletado: mapaCurricularCompletado ?? false
                            } : e));
                            setFormData(prev => ({
                                ...prev,
                                gruposPrimerAno: gruposPrimerAno ?? 1,
                                gruposSegundoAno: gruposSegundoAno ?? 1,
                                gruposTercerAno: gruposTercerAno ?? 1
                            }));
                        }
                        if (Array.isArray(data.grupos)) {
                            setGruposConfigList(data.grupos);
                        }
                    })
                    .catch(e => console.error("Error al obtener grupos config:", e));
            }
        } else {
            setConfiguraciones({});
            setGruposConfigList([]);
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

                    {tabEscuelas === "supervision" && escuelas.filter(e => e.esSupervision).length === 1 ? (
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

                        {/* Estructura de Grupos por Grado / Año (Solo para Escuelas, no para Supervisiones) */}
                        {!formData.esSupervision && !selectedEscuela?.esSupervision && (
                            <div style={{
                                gridColumn: "1 / -1",
                                background: "var(--bg-secondary)",
                                border: "1px solid var(--border)",
                                borderRadius: "12px",
                                padding: "1.25rem",
                                marginTop: "0.5rem"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <School size={18} style={{ color: "var(--primary)" }} /> Estructura de Grupos por Grado / Año
                                        </h4>
                                        <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            Configura la cantidad de grupos activos por año. Se sincroniza con Horarios IA y Planeaciones Didácticas.
                                        </p>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                         <span style={{
                                             fontSize: "0.75rem",
                                             fontWeight: 800,
                                             padding: "0.25rem 0.6rem",
                                             borderRadius: "20px",
                                             background: selectedEscuela?.mapaCurricularCompletado ? "#dcfce7" : "#fef2f2",
                                             color: selectedEscuela?.mapaCurricularCompletado ? "#15803d" : "#dc2626",
                                             border: "1px solid var(--border)"
                                         }}>
                                             {selectedEscuela?.mapaCurricularCompletado ? "🟢 Mapa Curricular Configurado" : "🔴 Pendiente de Configurar"}
                                         </span>
                                         <span style={{
                                             fontSize: "0.75rem",
                                             fontWeight: 700,
                                             padding: "0.25rem 0.6rem",
                                             borderRadius: "20px",
                                             background: "white",
                                             border: "1px solid var(--border)",
                                             color: "var(--primary)"
                                         }}>
                                             Estructura: {(isEditingMode ? formData.gruposPrimerAno : selectedEscuela?.gruposPrimerAno) ?? 1}-{(isEditingMode ? formData.gruposSegundoAno : selectedEscuela?.gruposSegundoAno) ?? 1}-{(isEditingMode ? formData.gruposTercerAno : selectedEscuela?.gruposTercerAno) ?? 1}
                                         </span>

                                         {selectedEscuela && (
                                             <>
                                                 <button
                                                     type="button"
                                                     className="btn btn-sm btn-primary"
                                                     onClick={() => setMapaModalAbierto(true)}
                                                     style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.65rem" }}
                                                 >
                                                     <Sparkles size={14} /> ⚙️ Editar Mapa Curricular
                                                 </button>
                                                 <button
                                                     type="button"
                                                     className="btn btn-sm"
                                                     onClick={handleReiniciarMapaEscuela}
                                                     style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.65rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }}
                                                     title="Borra la configuración de la escuela para probar el asistente desde cero"
                                                 >
                                                     <RefreshCw size={14} /> 🔄 Reiniciar / Borrar Datos
                                                 </button>
                                             </>
                                         )}
                                     </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                                    <div>
                                        <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                                            1.er Año (1.º y 2.º Semestre)
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            className="form-control"
                                            value={isEditingMode ? (formData.gruposPrimerAno ?? 1) : (selectedEscuela?.gruposPrimerAno ?? 1)}
                                            onChange={(e) => setFormData({ ...formData, gruposPrimerAno: Math.max(1, parseInt(e.target.value) || 1) })}
                                            disabled={!isEditingMode}
                                            style={{ fontSize: "0.9rem", fontWeight: 700, textAlign: "center" }}
                                        />
                                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Grupos: 1º A, 1º B...</span>
                                    </div>

                                    <div>
                                        <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                                            2.º Año (3.er y 4.º Semestre)
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            className="form-control"
                                            value={isEditingMode ? (formData.gruposSegundoAno ?? 1) : (selectedEscuela?.gruposSegundoAno ?? 1)}
                                            onChange={(e) => setFormData({ ...formData, gruposSegundoAno: Math.max(1, parseInt(e.target.value) || 1) })}
                                            disabled={!isEditingMode}
                                            style={{ fontSize: "0.9rem", fontWeight: 700, textAlign: "center" }}
                                        />
                                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Grupos: 3º A, 3º B...</span>
                                    </div>

                                    <div>
                                        <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                                            3.er Año (5.º y 6.º Semestre)
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            className="form-control"
                                            value={isEditingMode ? (formData.gruposTercerAno ?? 1) : (selectedEscuela?.gruposTercerAno ?? 1)}
                                            onChange={(e) => setFormData({ ...formData, gruposTercerAno: Math.max(1, parseInt(e.target.value) || 1) })}
                                            disabled={!isEditingMode}
                                            style={{ fontSize: "0.9rem", fontWeight: 700, textAlign: "center" }}
                                        />
                                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Grupos: 5º A, 5º B...</span>
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* Configuración de Capacitaciones Laborales por Grupo (3º y 5º Semestre) */}
                        {selectedEscuela && !selectedEscuela.esSupervision && (
                            <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <Sparkles size={16} color="var(--primary)" /> Capacitaciones Laborales y Optativas FFE por Grupo
                                        </h4>
                                        <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            Asigne qué Formación Laboral y Optativas lleva cada grupo de 3.er y 5.º Semestre. Se sincroniza con Planeaciones IA y Horarios IA.
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
                                    {generarGruposPorEstructura(selectedEscuela, "SEMESTRE_A")
                                        .filter(g => g.semestre >= 3)
                                        .map(g => {
                                            const cfg = gruposConfigList.find((item: any) => item.nombre === g.nombre);
                                            const capNombre = cfg?.capacitacionNombre || "Administracion";
                                            const ffeOpts = Array.isArray(cfg?.ffeOptativas) ? cfg.ffeOptativas : [];

                                            return (
                                                <div key={g.id} style={{ background: "var(--bg)", padding: "0.85rem 1rem", borderRadius: "10px", border: "1px solid var(--border)" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                                        <span style={{ fontWeight: 800, fontSize: "0.875rem", color: "var(--primary)" }}>
                                                            Grupo {g.nombre} ({g.semestre}° Semestre)
                                                        </span>
                                                        <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: "12px", background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                                                            {g.semestre === 3 ? "Laboral (9 UACs)" : "Laboral + FFE (10 UACs)"}
                                                        </span>
                                                    </div>

                                                    <div style={{ marginBottom: "0.5rem" }}>
                                                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                                                            Formación Laboral (Capacitación del Grupo):
                                                        </label>
                                                        <select
                                                            className="form-control"
                                                            value={capNombre}
                                                            onChange={(e) => handleGuardarCapacitacionEscuela(g.nombre, g.semestre, e.target.value, ffeOpts)}
                                                            style={{ fontSize: "0.8rem", fontWeight: 700 }}
                                                        >
                                                            {FORMACIONES_LABORALES.map(c => (
                                                                <option key={c} value={c}>{c}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
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

            {/* Modal de Mapa Curricular para Administrador */}
            {selectedEscuela && (
                <ModalConfiguracionMapaCurricular
                    escuela={selectedEscuela}
                    gruposIniciales={gruposConfigList}
                    isOpen={mapaModalAbierto}
                    onClose={() => setMapaModalAbierto(false)}
                    onSaved={() => {
                        setMapaModalAbierto(false);
                        cargarDatosEscuela(selectedEscuela.id);
                    }}
                    isAdmin={true}
                />
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
