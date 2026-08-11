"use client";

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Settings2, ToggleLeft, ToggleRight } from "lucide-react";
import { ProgramaAdmin } from "@/types";

type Escuela = {
    id: string;
    cct: string;
    nombre: string;
    localidad?: string | null;
    esSupervision?: boolean;
    permisos?: { horariosDesactivado?: boolean; planeacionesDesactivado?: boolean; horariosSinRequisitos?: boolean; planeacionesSinRequisitos?: boolean; horariosSinApiKey?: boolean; horariosSinExpedientes?: boolean; planeacionesSinApiKey?: boolean; planeacionesSinPaec?: boolean; programasInactivos?: string[]; [key: string]: unknown };
};

interface ProgramasModulosPorEscuelaProps {
    escuelas?: Escuela[];
    inicialEscuelas?: Escuela[];
    programas: ProgramaAdmin[];
    readOnly?: boolean;
}

export default function ProgramasModulosPorEscuela({ 
    escuelas: escuelasProp,
    inicialEscuelas, 
    programas,
    readOnly = false
}: ProgramasModulosPorEscuelaProps) {
    const listadoInicial = escuelasProp || inicialEscuelas || [];
    const [escuelas, setEscuelas] = useState<Escuela[]>(listadoInicial);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/admin/escuelas");
                if (!res.ok) return;
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setEscuelas(data.map((e: any) => ({
                        id: e.id,
                        cct: e.cct,
                        nombre: e.nombre,
                        localidad: e.localidad ?? null,
                        esSupervision: e.esSupervision ?? false,
                        permisos: e.permisos ?? null,
                    })));
                }
            } catch {
                // Conserva la prop inicial si el fetch falla
            }
        })();
    }, []);

    const handleToggleHorariosEscuela = async (escuelaId: string, desactivado: boolean) => {
        if (readOnly) return;
        const escTarget = escuelas.find(e => e.id === escuelaId);
        if (!escTarget) return;

        const permisosActuales = escTarget.permisos || {};
        const permisosNuevos = { ...permisosActuales, horariosDesactivado: desactivado };

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
        } catch {
            toast.error("Error de red al actualizar");
        }
    };

    const handleTogglePlaneacionesEscuela = async (escuelaId: string, actualmenteDesactivado: boolean) => {
        if (readOnly) return;
        const escTarget = escuelas.find(e => e.id === escuelaId);
        if (!escTarget) return;
        const permisosNuevos = { ...(escTarget.permisos || {}), planeacionesDesactivado: !actualmenteDesactivado };
        setEscuelas(prev => prev.map(e => e.id === escuelaId ? { ...e, permisos: permisosNuevos } : e));
        try {
            const res = await fetch(`/api/escuelas/${escuelaId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permisos: permisosNuevos })
            });
            if (res.ok) {
                toast.success(!actualmenteDesactivado
                    ? `Planeaciones IA DESACTIVADO para ${escTarget.nombre}`
                    : `Planeaciones IA ACTIVADO para ${escTarget.nombre}`);
            } else {
                toast.error("Error al actualizar estado de Planeaciones IA");
            }
        } catch {
            toast.error("Error de red al actualizar Planeaciones IA");
        }
    };

    // ── Helper compartido para actualizar un campo de permisos por escuela ─────
    const updatePermisoEscuela = async (escuelaId: string, field: string, value: boolean, msgOk: string) => {
        if (readOnly) return;
        const escTarget = escuelas.find(e => e.id === escuelaId);
        if (!escTarget) return;
        const permisosNuevos = { ...(escTarget.permisos || {}), [field]: value };
        setEscuelas(prev => prev.map(e => e.id === escuelaId ? { ...e, permisos: permisosNuevos } : e));
        try {
            const res = await fetch(`/api/escuelas/${escuelaId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permisos: permisosNuevos })
            });
            if (res.ok) toast.success(msgOk);
            else toast.error("Error al actualizar permiso");
        } catch {
            toast.error("Error de red al actualizar");
        }
    };

    // ── Exenciones granulares: Horarios IA ──────────────────────────────────────
    const handleToggleHorariosSinApiKey = (escuelaId: string, sinApiKey: boolean) => {
        const nombre = escuelas.find(e => e.id === escuelaId)?.nombre ?? "";
        return updatePermisoEscuela(escuelaId, "horariosSinApiKey", sinApiKey,
            sinApiKey ? `API Key EXIMIDA en Horarios IA para ${nombre}` : `API Key requerida en Horarios IA para ${nombre}`);
    };

    const handleToggleHorariosSinExpedientes = (escuelaId: string, sinExpedientes: boolean) => {
        const nombre = escuelas.find(e => e.id === escuelaId)?.nombre ?? "";
        return updatePermisoEscuela(escuelaId, "horariosSinExpedientes", sinExpedientes,
            sinExpedientes ? `Expedientes EXIMIDOS en Horarios IA para ${nombre}` : `Expedientes requeridos en Horarios IA para ${nombre}`);
    };

    // ── Exenciones granulares: Planeaciones IA ──────────────────────────────────
    const handleTogglePlaneacionesSinApiKey = (escuelaId: string, sinApiKey: boolean) => {
        const nombre = escuelas.find(e => e.id === escuelaId)?.nombre ?? "";
        return updatePermisoEscuela(escuelaId, "planeacionesSinApiKey", sinApiKey,
            sinApiKey ? `API Key EXIMIDA en Planeaciones IA para ${nombre}` : `API Key requerida en Planeaciones IA para ${nombre}`);
    };

    const handleTogglePlaneacionesSinPaec = (escuelaId: string, sinPaec: boolean) => {
        const nombre = escuelas.find(e => e.id === escuelaId)?.nombre ?? "";
        return updatePermisoEscuela(escuelaId, "planeacionesSinPaec", sinPaec,
            sinPaec ? `PAEC-PEC EXIMIDO en Planeaciones IA para ${nombre}` : `PAEC-PEC requerido en Planeaciones IA para ${nombre}`);
    };

    const handleToggleProgramaEscuela = async (escuelaId: string, programaId: string, programaNombre: string, activar: boolean) => {
        if (readOnly) return;
        const escTarget = escuelas.find(e => e.id === escuelaId);
        if (!escTarget) return;

        const permisosActuales = escTarget.permisos || {};
        let inactivos: string[] = Array.isArray(permisosActuales.programasInactivos) ? [...permisosActuales.programasInactivos] : [];

        inactivos = inactivos.filter(p => p !== programaNombre);
        if (activar) {
            inactivos = inactivos.filter(p => p !== programaId);
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
        } catch {
            toast.error("Error al guardar permiso de programa");
        }
    };

    const handleAccionMasivaPermisos = async (tipo: "HORARIOS_IA" | "PLANEACIONES_IA" | "HORARIOS_SIN_API_KEY" | "HORARIOS_SIN_EXPEDIENTES" | "PLANEACIONES_SIN_API_KEY" | "PLANEACIONES_SIN_PAEC" | "PROGRAMA", accion: "ACTIVAR_TODOS" | "DESACTIVAR_TODOS", programaId?: string, programaNombre?: string) => {
        if (readOnly) return;
        const targetLabel =
            tipo === "HORARIOS_IA"             ? "Horarios IA" :
            tipo === "PLANEACIONES_IA"         ? "Planeaciones IA" :
            tipo === "HORARIOS_SIN_API_KEY"    ? "API Key en Horarios IA" :
            tipo === "HORARIOS_SIN_EXPEDIENTES"? "Expedientes en Horarios IA" :
            tipo === "PLANEACIONES_SIN_API_KEY"? "API Key en Planeaciones IA" :
            tipo === "PLANEACIONES_SIN_PAEC"   ? "PAEC-PEC en Planeaciones IA" :
                                                `Programa "${programaNombre}"` ;
        const accionLabel = accion === "ACTIVAR_TODOS" ? "ACTIVAR" : "DESACTIVAR";
        if (!confirm(`¿Estás seguro de ${accionLabel} ${targetLabel} para TODAS las escuelas?`)) return;

        setSaving(true);
        try {
            const res = await fetch("/api/admin/escuelas/masivo-permisos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tipo, accion, programaId, programaNombre })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                if (tipo === "HORARIOS_IA") {
                    const horariosDesactivado = accion === "DESACTIVAR_TODOS";
                    setEscuelas(prev => prev.map(e => ({
                        ...e,
                        permisos: { ...(e.permisos || {}), horariosDesactivado }
                    })));
                } else if (tipo === "PLANEACIONES_IA") {
                    const planeacionesDesactivado = accion === "DESACTIVAR_TODOS";
                    setEscuelas(prev => prev.map(e => ({
                        ...e,
                        permisos: { ...(e.permisos || {}), planeacionesDesactivado }
                    })));
                } else if (tipo === "HORARIOS_SIN_API_KEY") {
                    const v = accion === "ACTIVAR_TODOS";
                    setEscuelas(prev => prev.map(e => ({ ...e, permisos: { ...(e.permisos || {}), horariosSinApiKey: v } })));
                } else if (tipo === "HORARIOS_SIN_EXPEDIENTES") {
                    const v = accion === "ACTIVAR_TODOS";
                    setEscuelas(prev => prev.map(e => ({ ...e, permisos: { ...(e.permisos || {}), horariosSinExpedientes: v } })));
                } else if (tipo === "PLANEACIONES_SIN_API_KEY") {
                    const v = accion === "ACTIVAR_TODOS";
                    setEscuelas(prev => prev.map(e => ({ ...e, permisos: { ...(e.permisos || {}), planeacionesSinApiKey: v } })));
                } else if (tipo === "PLANEACIONES_SIN_PAEC") {
                    const v = accion === "ACTIVAR_TODOS";
                    setEscuelas(prev => prev.map(e => ({ ...e, permisos: { ...(e.permisos || {}), planeacionesSinPaec: v } })));
                } else if (tipo === "PROGRAMA" && (programaId || programaNombre)) {
                    const esDesactivar = accion === "DESACTIVAR_TODOS";
                    setEscuelas(prev => prev.map(e => {
                        const permisosActuales = e.permisos || {};
                        let programasInactivos: string[] = Array.isArray(permisosActuales.programasInactivos)
                            ? [...permisosActuales.programasInactivos]
                            : [];
                        if (programaNombre) programasInactivos = programasInactivos.filter(p => p !== programaNombre);
                        if (esDesactivar) {
                            const valor = programaId || programaNombre;
                            if (valor && !programasInactivos.includes(valor)) programasInactivos.push(valor);
                        } else if (programaId) {
                            programasInactivos = programasInactivos.filter(p => p !== programaId);
                        }
                        return { ...e, permisos: { ...permisosActuales, programasInactivos } };
                    }));
                }
            } else {
                toast.error(data.error || "No se pudo actualizar permisos masivos.");
            }
        } catch {
            toast.error("Error al actualizar permisos masivos.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Banner Informativo */}
            <div style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)", border: "1px solid #bfdbfe", padding: "1.25rem", borderRadius: "12px" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Settings2 style={{ width: "20px", height: "20px", color: "#2563eb" }} /> Matriz de Activación de Módulos y Programas por Escuela
                </h3>
                <p style={{ fontSize: "0.78125rem", color: "#475569", margin: "0.25rem 0 0" }}>
                    Active o desactive funciones específicas para cada escuela o use las acciones en el encabezado de cada columna para activar/desactivar masivamente a TODAS las escuelas.
                </p>
            </div>

            {/* Tabla Matriz Interactivas */}
            <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "auto", maxHeight: "65vh", background: "var(--bg)" }}>
                <table className="matriz-escuelas-table" style={{ width: "100%", fontSize: "0.8125rem" }}>
                    {(() => {
                        const escuelasLista = escuelas.filter(e => !e.esSupervision);
                        const todosHorariosActivos = escuelasLista.every(e => e.permisos?.horariosDesactivado !== true);
                        const todosPlaneacionesActivos = escuelasLista.every(e => e.permisos?.planeacionesDesactivado !== true);
                        const todosHorariosSinApiKey       = escuelasLista.length > 0 && escuelasLista.every(e => e.permisos?.horariosSinApiKey       === true);
                        const todosHorariosSinExpedientes  = escuelasLista.length > 0 && escuelasLista.every(e => e.permisos?.horariosSinExpedientes  === true);
                        const todosPlaneacionesSinApiKey   = escuelasLista.length > 0 && escuelasLista.every(e => e.permisos?.planeacionesSinApiKey   === true);
                        const todosPlaneacionesSinPaec     = escuelasLista.length > 0 && escuelasLista.every(e => e.permisos?.planeacionesSinPaec     === true);

                        return (
                            <thead>
                                <tr style={{ background: "var(--bg-secondary)", textAlign: "left" }}>
                                    <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text)", verticalAlign: "top" }}>Escuela / CCT</th>
                                    
                                    {/* Columna Horarios IA con Botón Único Master */}
                                    <th style={{ padding: "0.75rem 0.5rem", fontWeight: 800, color: "#1d4ed8", textAlign: "center", minWidth: "140px", verticalAlign: "top" }}>
                                        <div>📅 Horarios IA</div>
                                        <div style={{ display: "flex", justifyContent: "center", marginTop: "0.35rem" }}>
                                            <button
                                                type="button"
                                                disabled={saving || readOnly}
                                                onClick={() => handleAccionMasivaPermisos("HORARIOS_IA", todosHorariosActivos ? "DESACTIVAR_TODOS" : "ACTIVAR_TODOS")}
                                                style={{
                                                    padding: "0.25rem 0.6rem",
                                                    borderRadius: "20px",
                                                    fontSize: "0.725rem",
                                                    fontWeight: 800,
                                                    border: "none",
                                                    cursor: (saving || readOnly) ? "not-allowed" : "pointer",
                                                    opacity: (saving || readOnly) ? 0.7 : 1,
                                                    background: todosHorariosActivos ? "#dcfce7" : "#fee2e2",
                                                    color: todosHorariosActivos ? "#15803d" : "#b91c1c",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.35rem",
                                                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                                                }}
                                                title={todosHorariosActivos ? "Clic para DESACTIVAR Horarios IA en TODAS las escuelas" : "Clic para ACTIVAR Horarios IA en TODAS las escuelas"}
                                            >
                                                {todosHorariosActivos ? "🟢 Activo" : "🔴 Inactivo"}
                                            </button>
                                        </div>
                                    </th>

                                    {/* Columna Planeaciones IA con Botón Master */}
                                    <th style={{ padding: "0.75rem 0.5rem", fontWeight: 800, color: "#7c3aed", textAlign: "center", minWidth: "150px", verticalAlign: "top" }}>
                                        <div>📋 Planeaciones IA</div>
                                        <div style={{ display: "flex", justifyContent: "center", marginTop: "0.35rem" }}>
                                            <button
                                                type="button"
                                                disabled={saving || readOnly}
                                                onClick={() => handleAccionMasivaPermisos("PLANEACIONES_IA", todosPlaneacionesActivos ? "DESACTIVAR_TODOS" : "ACTIVAR_TODOS")}
                                                style={{
                                                    padding: "0.25rem 0.6rem",
                                                    borderRadius: "20px",
                                                    fontSize: "0.725rem",
                                                    fontWeight: 800,
                                                    border: "none",
                                                    cursor: (saving || readOnly) ? "not-allowed" : "pointer",
                                                    opacity: (saving || readOnly) ? 0.7 : 1,
                                                    background: todosPlaneacionesActivos ? "#f3e8ff" : "#fee2e2",
                                                    color: todosPlaneacionesActivos ? "#7c3aed" : "#b91c1c",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.35rem",
                                                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                                                }}
                                                title={todosPlaneacionesActivos ? "Clic para DESACTIVAR Planeaciones IA en TODAS" : "Clic para ACTIVAR Planeaciones IA en TODAS"}
                                            >
                                                {todosPlaneacionesActivos ? "🟣 Activo" : "🔴 Inactivo"}
                                            </button>
                                        </div>
                                    </th>

                                    {/* 🔑 API Key — Horarios IA */}
                                     <th style={{ padding: "0.75rem 0.5rem", fontWeight: 800, color: "#0f766e", textAlign: "center", minWidth: "110px", verticalAlign: "top" }}>
                                         <div>🔑 API Key</div>
                                         <div style={{ fontSize: "0.6rem", color: "#0d9488", fontWeight: 600 }}>Horarios IA</div>
                                         <div style={{ display: "flex", justifyContent: "center", marginTop: "0.35rem" }}>
                                             <button type="button" disabled={saving || readOnly}
                                                 onClick={() => handleAccionMasivaPermisos("HORARIOS_SIN_API_KEY", todosHorariosSinApiKey ? "DESACTIVAR_TODOS" : "ACTIVAR_TODOS")}
                                                 style={{ padding: "0.25rem 0.5rem", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 800, border: "none", cursor: (saving || readOnly) ? "not-allowed" : "pointer", opacity: (saving || readOnly) ? 0.7 : 1, background: todosHorariosSinApiKey ? "#ccfbf1" : "#fee2e2", color: todosHorariosSinApiKey ? "#0f766e" : "#b91c1c", display: "inline-flex", alignItems: "center", gap: "0.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
                                                 title={todosHorariosSinApiKey ? "Restablecer requisito de API Key en Horarios IA para TODAS" : "Eximir API Key en Horarios IA para TODAS"}
                                             >
                                                 {todosHorariosSinApiKey ? "🟢 Eximida" : "🔒 Req."}
                                             </button>
                                         </div>
                                     </th>

                                     {/* 📁 Expedientes — Horarios IA */}
                                     <th style={{ padding: "0.75rem 0.5rem", fontWeight: 800, color: "#1d4ed8", textAlign: "center", minWidth: "110px", verticalAlign: "top" }}>
                                         <div>📁 Expedientes</div>
                                         <div style={{ fontSize: "0.6rem", color: "#2563eb", fontWeight: 600 }}>Horarios IA</div>
                                         <div style={{ display: "flex", justifyContent: "center", marginTop: "0.35rem" }}>
                                             <button type="button" disabled={saving || readOnly}
                                                 onClick={() => handleAccionMasivaPermisos("HORARIOS_SIN_EXPEDIENTES", todosHorariosSinExpedientes ? "DESACTIVAR_TODOS" : "ACTIVAR_TODOS")}
                                                 style={{ padding: "0.25rem 0.5rem", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 800, border: "none", cursor: (saving || readOnly) ? "not-allowed" : "pointer", opacity: (saving || readOnly) ? 0.7 : 1, background: todosHorariosSinExpedientes ? "#dbeafe" : "#fee2e2", color: todosHorariosSinExpedientes ? "#1d4ed8" : "#b91c1c", display: "inline-flex", alignItems: "center", gap: "0.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
                                                 title={todosHorariosSinExpedientes ? "Restablecer requisito de Expedientes en Horarios IA para TODAS" : "Eximir Expedientes en Horarios IA para TODAS"}
                                             >
                                                 {todosHorariosSinExpedientes ? "🟢 Eximidos" : "🔒 Req."}
                                             </button>
                                         </div>
                                     </th>

                                     {/* 🔑 API Key — Planeaciones IA */}
                                     <th style={{ padding: "0.75rem 0.5rem", fontWeight: 800, color: "#7c3aed", textAlign: "center", minWidth: "110px", verticalAlign: "top" }}>
                                         <div>🔑 API Key</div>
                                         <div style={{ fontSize: "0.6rem", color: "#a78bfa", fontWeight: 600 }}>Planeaciones IA</div>
                                         <div style={{ display: "flex", justifyContent: "center", marginTop: "0.35rem" }}>
                                             <button type="button" disabled={saving || readOnly}
                                                 onClick={() => handleAccionMasivaPermisos("PLANEACIONES_SIN_API_KEY", todosPlaneacionesSinApiKey ? "DESACTIVAR_TODOS" : "ACTIVAR_TODOS")}
                                                 style={{ padding: "0.25rem 0.5rem", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 800, border: "none", cursor: (saving || readOnly) ? "not-allowed" : "pointer", opacity: (saving || readOnly) ? 0.7 : 1, background: todosPlaneacionesSinApiKey ? "#f3e8ff" : "#fee2e2", color: todosPlaneacionesSinApiKey ? "#7c3aed" : "#b91c1c", display: "inline-flex", alignItems: "center", gap: "0.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
                                                 title={todosPlaneacionesSinApiKey ? "Restablecer requisito de API Key en Planeaciones IA para TODAS" : "Eximir API Key en Planeaciones IA para TODAS"}
                                             >
                                                 {todosPlaneacionesSinApiKey ? "🟢 Eximida" : "🔒 Req."}
                                             </button>
                                         </div>
                                     </th>

                                     {/* 🔒 PAEC-PEC — Planeaciones IA */}
                                     <th style={{ padding: "0.75rem 0.5rem", fontWeight: 800, color: "#b45309", textAlign: "center", minWidth: "110px", verticalAlign: "top" }}>
                                         <div>🔒 PAEC-PEC</div>
                                         <div style={{ fontSize: "0.6rem", color: "#d97706", fontWeight: 600 }}>Planeaciones IA</div>
                                         <div style={{ display: "flex", justifyContent: "center", marginTop: "0.35rem" }}>
                                             <button type="button" disabled={saving || readOnly}
                                                 onClick={() => handleAccionMasivaPermisos("PLANEACIONES_SIN_PAEC", todosPlaneacionesSinPaec ? "DESACTIVAR_TODOS" : "ACTIVAR_TODOS")}
                                                 style={{ padding: "0.25rem 0.5rem", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 800, border: "none", cursor: (saving || readOnly) ? "not-allowed" : "pointer", opacity: (saving || readOnly) ? 0.7 : 1, background: todosPlaneacionesSinPaec ? "#fef3c7" : "#fee2e2", color: todosPlaneacionesSinPaec ? "#b45309" : "#b91c1c", display: "inline-flex", alignItems: "center", gap: "0.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
                                                 title={todosPlaneacionesSinPaec ? "Restablecer requisito de PAEC-PEC en Planeaciones IA para TODAS" : "Eximir PAEC-PEC en Planeaciones IA para TODAS"}
                                             >
                                                 {todosPlaneacionesSinPaec ? "🟢 Eximido" : "🔒 Req."}
                                             </button>
                                         </div>
                                     </th>

                                    {/* Columnas de Programas con Botón Único Master */}
                                    {programas.map((prog) => {
                                        const todosProgActivos = escuelasLista.every(e => {
                                            const inactivos: string[] = e.permisos?.programasInactivos || [];
                                            return !inactivos.includes(prog.id) && !inactivos.includes(prog.nombre);
                                        });

                                        return (
                                            <th key={prog.id} style={{ padding: "0.75rem 0.5rem", fontWeight: 700, color: "var(--text-secondary)", textAlign: "center", minWidth: "130px", verticalAlign: "top" }}>
                                                <div style={{ fontSize: "0.75rem", fontWeight: 800 }} title={prog.nombre}>
                                                    {prog.nombre}
                                                </div>
                                                <div style={{ display: "flex", justifyContent: "center", marginTop: "0.35rem" }}>
                                                    <button
                                                        type="button"
                                                        disabled={saving || readOnly}
                                                        onClick={() => handleAccionMasivaPermisos("PROGRAMA", todosProgActivos ? "DESACTIVAR_TODOS" : "ACTIVAR_TODOS", prog.id, prog.nombre)}
                                                        style={{
                                                            padding: "0.25rem 0.55rem",
                                                            borderRadius: "20px",
                                                            fontSize: "0.7rem",
                                                            fontWeight: 800,
                                                            border: "none",
                                                            cursor: (saving || readOnly) ? "not-allowed" : "pointer",
                                                            opacity: (saving || readOnly) ? 0.7 : 1,
                                                            background: todosProgActivos ? "#dcfce7" : "#fee2e2",
                                                            color: todosProgActivos ? "#15803d" : "#b91c1c",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "0.25rem",
                                                            boxShadow: "0 1px 2px rgba(0,0,0,0.06)"
                                                        }}
                                                        title={todosProgActivos ? `Clic para DESACTIVAR ${prog.nombre} en TODAS las escuelas` : `Clic para ACTIVAR ${prog.nombre} en TODAS las escuelas`}
                                                    >
                                                        {todosProgActivos ? "✓ Activo" : "✕ Inactivo"}
                                                    </button>
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                        );
                    })()}
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
                                    <td style={{ textAlign: "center", padding: "0.375rem" }}>
                                        <button
                                            type="button"
                                            disabled={saving || readOnly}
                                            onClick={() => handleToggleHorariosEscuela(esc.id, horariosActivo)}
                                            title={horariosActivo ? `Desactivar Horarios IA en ${esc.nombre}` : `Activar Horarios IA en ${esc.nombre}`}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                cursor: (saving || readOnly) ? "default" : "pointer",
                                                padding: "4px"
                                            }}
                                        >
                                            {horariosActivo
                                                ? <ToggleRight size={22} style={{ color: "#10b981" }} />
                                                : <ToggleLeft size={22} style={{ color: "#ef4444" }} />}
                                        </button>
                                    </td>

                                    {/* Toggle Planeaciones IA */}
                                    <td style={{ textAlign: "center", padding: "0.375rem" }}>
                                        <button
                                            type="button"
                                            disabled={saving || readOnly}
                                            onClick={() => handleTogglePlaneacionesEscuela(esc.id, permisosEsc.planeacionesDesactivado === true)}
                                            title={permisosEsc.planeacionesDesactivado === true ? `Activar Planeaciones IA en ${esc.nombre}` : `Desactivar Planeaciones IA en ${esc.nombre}`}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                cursor: (saving || readOnly) ? "default" : "pointer",
                                                padding: "4px"
                                            }}
                                        >
                                            {permisosEsc.planeacionesDesactivado === true
                                                ? <ToggleLeft size={22} style={{ color: "#ef4444" }} />
                                                : <ToggleRight size={22} style={{ color: "#10b981" }} />}
                                        </button>
                                    </td>

                                     {/* 🔑 API Key — Horarios IA */}
                                     <td style={{ textAlign: "center", padding: "0.5rem" }}>
                                         <button type="button" disabled={saving || readOnly}
                                             onClick={() => handleToggleHorariosSinApiKey(esc.id, permisosEsc.horariosSinApiKey !== true)}
                                             title={permisosEsc.horariosSinApiKey === true ? `Restablecer requisito de API Key en Horarios IA para ${esc.nombre}` : `Eximir API Key en Horarios IA para ${esc.nombre}`}
                                             style={{ padding: "0.3rem 0.6rem", borderRadius: "20px", fontWeight: 800, fontSize: "0.7rem", border: "none", cursor: (saving || readOnly) ? "not-allowed" : "pointer", opacity: (saving || readOnly) ? 0.7 : 1, background: permisosEsc.horariosSinApiKey === true ? "#ccfbf1" : "#f0fdfa", color: permisosEsc.horariosSinApiKey === true ? "#0f766e" : "#0d9488", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                                         >
                                             {permisosEsc.horariosSinApiKey === true ? "🟢 Exim." : "🔒 Req."}
                                         </button>
                                     </td>

                                     {/* 📁 Expedientes — Horarios IA */}
                                     <td style={{ textAlign: "center", padding: "0.5rem" }}>
                                         <button type="button" disabled={saving || readOnly}
                                             onClick={() => handleToggleHorariosSinExpedientes(esc.id, permisosEsc.horariosSinExpedientes !== true)}
                                             title={permisosEsc.horariosSinExpedientes === true ? `Restablecer requisito de Expedientes en Horarios IA para ${esc.nombre}` : `Eximir Expedientes en Horarios IA para ${esc.nombre}`}
                                             style={{ padding: "0.3rem 0.6rem", borderRadius: "20px", fontWeight: 800, fontSize: "0.7rem", border: "none", cursor: (saving || readOnly) ? "not-allowed" : "pointer", opacity: (saving || readOnly) ? 0.7 : 1, background: permisosEsc.horariosSinExpedientes === true ? "#dbeafe" : "#eff6ff", color: permisosEsc.horariosSinExpedientes === true ? "#1d4ed8" : "#3b82f6", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                                         >
                                             {permisosEsc.horariosSinExpedientes === true ? "🟢 Exim." : "🔒 Req."}
                                         </button>
                                     </td>

                                     {/* 🔑 API Key — Planeaciones IA */}
                                     <td style={{ textAlign: "center", padding: "0.5rem" }}>
                                         <button type="button" disabled={saving || readOnly}
                                             onClick={() => handleTogglePlaneacionesSinApiKey(esc.id, permisosEsc.planeacionesSinApiKey !== true)}
                                             title={permisosEsc.planeacionesSinApiKey === true ? `Restablecer requisito de API Key en Planeaciones IA para ${esc.nombre}` : `Eximir API Key en Planeaciones IA para ${esc.nombre}`}
                                             style={{ padding: "0.3rem 0.6rem", borderRadius: "20px", fontWeight: 800, fontSize: "0.7rem", border: "none", cursor: (saving || readOnly) ? "not-allowed" : "pointer", opacity: (saving || readOnly) ? 0.7 : 1, background: permisosEsc.planeacionesSinApiKey === true ? "#f3e8ff" : "#faf5ff", color: permisosEsc.planeacionesSinApiKey === true ? "#7c3aed" : "#a78bfa", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                                         >
                                             {permisosEsc.planeacionesSinApiKey === true ? "🟢 Exim." : "🔒 Req."}
                                         </button>
                                     </td>

                                     {/* 🔒 PAEC-PEC — Planeaciones IA */}
                                     <td style={{ textAlign: "center", padding: "0.5rem" }}>
                                         <button type="button" disabled={saving || readOnly}
                                             onClick={() => handleTogglePlaneacionesSinPaec(esc.id, permisosEsc.planeacionesSinPaec !== true)}
                                             title={permisosEsc.planeacionesSinPaec === true ? `Restablecer requisito de PAEC-PEC en Planeaciones IA para ${esc.nombre}` : `Eximir PAEC-PEC en Planeaciones IA para ${esc.nombre}`}
                                             style={{ padding: "0.3rem 0.6rem", borderRadius: "20px", fontWeight: 800, fontSize: "0.7rem", border: "none", cursor: (saving || readOnly) ? "not-allowed" : "pointer", opacity: (saving || readOnly) ? 0.7 : 1, background: permisosEsc.planeacionesSinPaec === true ? "#fef3c7" : "#fffbeb", color: permisosEsc.planeacionesSinPaec === true ? "#b45309" : "#d97706", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                                         >
                                             {permisosEsc.planeacionesSinPaec === true ? "🟢 Exim." : "🔒 Req."}
                                         </button>
                                     </td>

                                    {/* Toggles por Programa */}
                                    {programas.map((prog) => {
                                        const progActivo = !programasInactivos.includes(prog.id) && !programasInactivos.includes(prog.nombre);
                                        return (
                                            <td key={prog.id} style={{ textAlign: "center", padding: "0.375rem" }}>
                                                <button
                                                    type="button"
                                                    disabled={saving || readOnly}
                                                    onClick={() => handleToggleProgramaEscuela(esc.id, prog.id, prog.nombre, !progActivo)}
                                                    title={progActivo ? `Desactivar ${prog.nombre} en ${esc.nombre}` : `Activar ${prog.nombre} en ${esc.nombre}`}
                                                    style={{
                                                        background: "none",
                                                        border: "none",
                                                        cursor: (saving || readOnly) ? "default" : "pointer",
                                                        padding: "4px"
                                                    }}
                                                >
                                                    {progActivo
                                                        ? <ToggleRight size={22} style={{ color: "#10b981" }} />
                                                        : <ToggleLeft size={22} style={{ color: "#ef4444" }} />}
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
    );
}
