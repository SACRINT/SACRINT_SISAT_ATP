"use client";

import { BookOpen, FileText, Download } from "lucide-react";
import { RecursoDirector } from "@/types/director";

export default function RecursosListado({ recursos }: { recursos: RecursoDirector[] }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {recursos.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    <BookOpen size={48} style={{ margin: "0 auto 0.75rem", opacity: 0.3 }} />
                    <p>Aún no hay recursos disponibles</p>
                    <p style={{ fontSize: "0.8125rem" }}>Cuando la supervisión suba manuales o lineamientos, aparecerán aquí.</p>
                </div>
            ) : (
                recursos.map((rec) => (
                    <div key={rec.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, wordBreak: "break-word" }}>{rec.titulo}</div>
                            {rec.descripcion && <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", wordBreak: "break-word" }}>{rec.descripcion}</div>}
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.25rem" }}>
                                <FileText size={12} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.archivoNombre}</span>
                                {rec.programa && <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}> • {rec.programa.nombre}</span>}
                            </div>
                        </div>
                        {rec.archivoDriveUrl && (
                            <a href={rec.archivoDriveUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ padding: "0.5rem 1rem", minHeight: "auto", flexShrink: 0 }}>
                                <Download size={18} />
                                Descargar
                            </a>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}
