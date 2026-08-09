"use client";

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Settings2 } from "lucide-react";
import { ProgramaAdmin } from "@/types";

type Escuela = {
    id: string;
    cct: string;
    nombre: string;
    localidad?: string | null;
    esSupervision?: boolean;
    permisos?: { horariosDesactivado?: boolean; planeacionesDesactivado?: boolean; horariosSinRequisitos?: boolean; planeacionesSinRequisitos?: boolean; programasInactivos?: string[]; [key: string]: unknown };
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

    const handleToggleHorariosSinRequisitos = async (escuelaId: string, sinRequisitos: boolean) => {
        if (readOnly) return;
        const escTarget = escuelas.find(e => e.id === escuelaId);
        if (!escTarget) return;
        const permisosNuevos = { ...(escTarget.permisos || {}), horariosSinRequisitos: sinRequisitos };
        setEscuelas(prev => prev.map(e => e.id === escuelaId ? { ...e, permisos: permisosNuevos } : e));
        try {
            const res = await fetch(`/api/escuelas/${escuelaId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permisos: permisosNuevos })
            });
            if (res.ok) {
                toast.success(sinRequisitos
                    ? `Horarios IA SIN REQUISITOS para ${escTarget.nombre}`
                    : `Horarios IA con requisitos para ${escTarget.nombre}`);
            } else {
                toast.error("Error al actualizar estado");
            }
        } catch {
            toast.error("Error de red al actualizar");
        }
    };

    const handleTogglePlaneacionesSinRequisitos = async (escuelaId: string, sinRequisitos: boolean) => {
        if (readOnly) return;
        const escTarget = escuelas.find(e => e.id === escuelaId);
        if (!escTarget) return;
        const permisosNuevos = { ...(escTarget.permisos || {}), planeacionesSinRequisitos: sinRequisitos };
        setEscuelas(prev => prev.map(e => e.id === escuelaId ? { ...e, permisos: permisosNuevos } : e));
        try {
            const res = await fetch(`/api/escuelas/${escuelaId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permisos: permisosNuevos })
            });
            if (res.ok) {
                toast.success(sinRequisitos
                    ? `Planeaciones IA SIN REQUISITOS para ${escTarget.nombre}`
                    : `Planeaciones IA con requisitos para ${escTarget.nombre}`);
            } else {
                toast.error("Error al actualizar estado de Planeaciones IA");
            }
        } catch {
            toast.error("Error de red al actualizar Planeaciones IA");
        }
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

    const handleAccionMasivaPermisos = async (tipo: "HORARIOS_IA" | "PLANEACIONES_IA" | "HORARIOS_SIN_REQUISITOS" | "PLANEACIONES_SIN_REQUISITOS" | "PROGRAMA", accion: "ACTIVAR_TODOS" | "DESACTIVAR_TODOS", programaId?: string, programaNombre?: string) => {
        if (readOnly) return;
        const targetLabel = tipo === "HORARIOS_IA" ? "Horarios IA" : tipo === "PLANEACIONES_IA" ? "Planeaciones IA" : tipo === "HORARIOS_SIN_REQUISITOS" ? "Horarios IA (requisitos)" : tipo === "PLANEACIONES_SIN_REQUISITOS" ? "Planeaciones IA (requisitos)" : `Programa "${programaNombre}"`;
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
                } else if (tipo === "HORARIOS_SIN_REQUISITOS") {
                    const sinRequisitos = accion === "ACTIVAR_TODOS";
                    setEscuelas(prev => prev.map(e => ({
                        ...e,
                        permisos: { ...(e.permisos || {}), horariosSinRequisitos: sinRequisitos }
                    })));
                } else if (tipo === "PLANEACIONES_SIN_REQUISITOS") {
                    const sinRequisitos = accion === "ACTIVAR_TODOS";
                    setEscuelas(prev => prev.map(e => ({
                        ...e,
                        permisos: { ...(e.permisos || {}), planeacionesSinRequisitos: sinRequisitos }
                    })));
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
            <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflowX: "auto", background: "var(--bg)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                    {(() => {
                        const escuelasLista = escuelas.filter(e => !e.esSupervision);
                        const todosHorariosActivos = escuelasLista.every(e => e.permisos?.horariosDesactivado !== true);
                        const todosPlaneacionesActivos = escuelasLista.every(e => e.permisos?.planeacionesDesactivado !== true);
                        const todosHorariosSinRequisitos = escuelasLista.length > 0 && escuelasLista.every(e => e.permisos?.horariosSinRequisitos === true);
                        const todosPlaneacionesSinRequisitos = escuelasLista.length > 0 && escuelasLista.every(e => e.permisos?.planeacionesSinRequisitos === true);

                        return (
                            <thead>
                                <tr style={{ background: "var(--bg-secondary)", borderBottom: "2px solid var(--border)", textAlign: "left" }}>
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

                                    {/* Columna Requisitos Horarios IA con Botón Master */}
                                    <th style={{ padding: "0.75rem 0.5rem", fontWeight: 800, color: "#0f766e", textAlign: "center", minWidth: "150px", verticalAlign: "top" }}>
                                        <div>🛡️ Requisitos Horarios IA</div>
                                        <div style={{ fontSize: "0.65rem", color: "#0d9488", fontWeight: 600 }}>Sin requisitos = sin API/expedientes</div>
                                        <div style={{ display: "flex", justifyContent: "center", marginTop: "0.35rem" }}>
                                            <button
                                                type="button"
                                                disabled={saving || readOnly}
                                                onClick={() => handleAccionMasivaPermisos("HORARIOS_SIN_REQUISITOS", todosHorariosSinRequisitos ? "DESACTIVAR_TODOS" : "ACTIVAR_TODOS")}
                                                style={{
                                                    padding: "0.25rem 0.6rem",
                                                    borderRadius: "20px",
                                                    fontSize: "0.725rem",
                                                    fontWeight: 800,
                                                    border: "none",
                                                    cursor: (saving || readOnly) ? "not-allowed" : "pointer",
                                                    opacity: (saving || readOnly) ? 0.7 : 1,
                                                    background: todosHorariosSinRequisitos ? "#ccfbf1" : "#fee2e2",
                                                    color: todosHorariosSinRequisitos ? "#0f766e" : "#b91c1c",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.35rem",
                                                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                                                }}
                                                title={todosHorariosSinRequisitos ? "Clic para que TODAS las escuelas vuelvan a requerir requisitos en Horarios IA" : "Clic para EXIMIR requisitos de Horarios IA en TODAS las escuelas"}
                                            >
                                                {todosHorariosSinRequisitos ? "🟢 Sin req." : "🔒 Con req."}
                                            </button>
                                        </div>
                                    </th>

                                    {/* Columna Requisitos Planeaciones IA con Botón Master */}
                                    <th style={{ padding: "0.75rem 0.5rem", fontWeight: 800, color: "#7c3aed", textAlign: "center", minWidth: "160px", verticalAlign: "top" }}>
                                        <div>🛡️ Requisitos Planeaciones IA</div>
                                        <div style={{ fontSize: "0.65rem", color: "#a78bfa", fontWeight: 600 }}>Sin requisitos = sin PAEC/API</div>
                                        <div style={{ display: "flex", justifyContent: "center", marginTop: "0.35rem" }}>
                                            <button
                                                type="button"
                                                disabled={saving || readOnly}
                                                onClick={() => handleAccionMasivaPermisos("PLANEACIONES_SIN_REQUISITOS", todosPlaneacionesSinRequisitos ? "DESACTIVAR_TODOS" : "ACTIVAR_TODOS")}
                                                style={{
                                                    padding: "0.25rem 0.6rem",
                                                    borderRadius: "20px",
                                                    fontSize: "0.725rem",
                                                    fontWeight: 800,
                                                    border: "none",
                                                    cursor: (saving || readOnly) ? "not-allowed" : "pointer",
                                                    opacity: (saving || readOnly) ? 0.7 : 1,
                                                    background: todosPlaneacionesSinRequisitos ? "#f3e8ff" : "#fee2e2",
                                                    color: todosPlaneacionesSinRequisitos ? "#7c3aed" : "#b91c1c",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.35rem",
                                                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                                                }}
                                                title={todosPlaneacionesSinRequisitos ? "Clic para que TODAS las escuelas vuelvan a requerir requisitos en Planeaciones IA" : "Clic para EXIMIR requisitos de Planeaciones IA en TODAS las escuelas"}
                                            >
                                                {todosPlaneacionesSinRequisitos ? "🟢 Sin req." : "🔒 Con req."}
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
                                    <td style={{ textAlign: "center", padding: "0.75rem" }}>
                                        <button
                                            type="button"
                                            disabled={saving || readOnly}
                                            onClick={() => handleToggleHorariosEscuela(esc.id, horariosActivo)}
                                            style={{
                                                padding: "0.35rem 0.75rem",
                                                borderRadius: "20px",
                                                fontWeight: 800,
                                                fontSize: "0.725rem",
                                                border: "none",
                                                cursor: (saving || readOnly) ? "not-allowed" : "pointer",
                                                opacity: (saving || readOnly) ? 0.7 : 1,
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

                                    {/* Toggle Planeaciones IA */}
                                    <td style={{ textAlign: "center", padding: "0.75rem" }}>
                                        <button
                                            type="button"
                                            disabled={saving || readOnly}
                                            onClick={() => handleTogglePlaneacionesEscuela(esc.id, permisosEsc.planeacionesDesactivado === true)}
                                            style={{
                                                padding: "0.35rem 0.75rem",
                                                borderRadius: "20px",
                                                fontWeight: 800,
                                                fontSize: "0.725rem",
                                                border: "none",
                                                cursor: (saving || readOnly) ? "not-allowed" : "pointer",
                                                opacity: (saving || readOnly) ? 0.7 : 1,
                                                background: permisosEsc.planeacionesDesactivado === true ? "#fee2e2" : "#f3e8ff",
                                                color: permisosEsc.planeacionesDesactivado === true ? "#b91c1c" : "#7c3aed",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.35rem"
                                            }}
                                        >
                                            {permisosEsc.planeacionesDesactivado === true ? "🔴 Desactivado" : "🟣 Activo"}
                                        </button>
                                    </td>

                                    {/* Toggle Requisitos Horarios IA */}
                                    <td style={{ textAlign: "center", padding: "0.75rem" }}>
                                        <button
                                            type="button"
                                            disabled={saving || readOnly}
                                            onClick={() => handleToggleHorariosSinRequisitos(esc.id, permisosEsc.horariosSinRequisitos !== true)}
                                            title={`${permisosEsc.horariosSinRequisitos === true ? "Haga clic para exigir requisitos (API/expedientes) en Horarios IA" : "Haga clic para EXIMIR requisitos (API/expedientes) en Horarios IA"} de ${esc.nombre}`}
                                            style={{
                                                padding: "0.35rem 0.75rem",
                                                borderRadius: "20px",
                                                fontWeight: 800,
                                                fontSize: "0.725rem",
                                                border: "none",
                                                cursor: (saving || readOnly) ? "not-allowed" : "pointer",
                                                opacity: (saving || readOnly) ? 0.7 : 1,
                                                background: permisosEsc.horariosSinRequisitos === true ? "#ccfbf1" : "#f0fdfa",
                                                color: permisosEsc.horariosSinRequisitos === true ? "#0f766e" : "#0d9488",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.35rem"
                                            }}
                                        >
                                            {permisosEsc.horariosSinRequisitos === true ? "🟢 Sin req." : "🔒 Con req."}
                                        </button>
                                    </td>

                                    {/* Toggle Requisitos Planeaciones IA */}
                                    <td style={{ textAlign: "center", padding: "0.75rem" }}>
                                        <button
                                            type="button"
                                            disabled={saving || readOnly}
                                            onClick={() => handleTogglePlaneacionesSinRequisitos(esc.id, permisosEsc.planeacionesSinRequisitos !== true)}
                                            title={`${permisosEsc.planeacionesSinRequisitos === true ? "Haga clic para exigir requisitos (PAEC/API) en Planeaciones IA" : "Haga clic para EXIMIR requisitos (PAEC/API) en Planeaciones IA"} de ${esc.nombre}`}
                                            style={{
                                                padding: "0.35rem 0.75rem",
                                                borderRadius: "20px",
                                                fontWeight: 800,
                                                fontSize: "0.725rem",
                                                border: "none",
                                                cursor: (saving || readOnly) ? "not-allowed" : "pointer",
                                                opacity: (saving || readOnly) ? 0.7 : 1,
                                                background: permisosEsc.planeacionesSinRequisitos === true ? "#f3e8ff" : "#faf5ff",
                                                color: permisosEsc.planeacionesSinRequisitos === true ? "#7c3aed" : "#a78bfa",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.35rem"
                                            }}
                                        >
                                            {permisosEsc.planeacionesSinRequisitos === true ? "🟢 Sin req." : "🔒 Con req."}
                                        </button>
                                    </td>

                                    {/* Toggles por Programa */}
                                    {programas.map((prog) => {
                                        const progActivo = !programasInactivos.includes(prog.id) && !programasInactivos.includes(prog.nombre);
                                        return (
                                            <td key={prog.id} style={{ textAlign: "center", padding: "0.5rem" }}>
                                                <button
                                                    type="button"
                                                    disabled={saving || readOnly}
                                                    onClick={() => handleToggleProgramaEscuela(esc.id, prog.id, prog.nombre, !progActivo)}
                                                    title={progActivo ? `Haga clic para desactivar ${prog.nombre} en ${esc.nombre}` : `Haga clic para activar ${prog.nombre} en ${esc.nombre}`}
                                                    style={{
                                                        padding: "0.35rem 0.65rem",
                                                        borderRadius: "20px",
                                                        fontWeight: 800,
                                                        fontSize: "0.7rem",
                                                        border: "none",
                                                        cursor: (saving || readOnly) ? "not-allowed" : "pointer",
                                                        opacity: (saving || readOnly) ? 0.7 : 1,
                                                        background: progActivo ? "#dcfce7" : "#fee2e2",
                                                        color: progActivo ? "#15803d" : "#b91c1c",
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: "0.25rem",
                                                        minWidth: "85px",
                                                        justifyContent: "center"
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
    );
}
