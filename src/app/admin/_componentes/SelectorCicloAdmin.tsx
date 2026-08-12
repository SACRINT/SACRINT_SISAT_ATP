"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

type Ciclo = {
    id: string;
    nombre: string;
    activo: boolean;
};

interface SelectorCicloAdminProps {
    todosCiclos: Ciclo[];
    cicloIdActual: string; // el ciclo que se está viendo ahora
}

export default function SelectorCicloAdmin({
    todosCiclos,
    cicloIdActual,
}: SelectorCicloAdminProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [seleccionando, setSeleccionando] = useState(false);

    const cicloVisto = todosCiclos.find((c) => c.id === cicloIdActual);
    const cicloActivo = todosCiclos.find((c) => c.activo);

    async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const cicloId = e.target.value;
        setSeleccionando(true);

        try {
            await fetch("/api/admin/ciclos/seleccionar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cicloId }),
            });
            startTransition(() => {
                router.refresh();
            });
        } catch {
            // silencioso — la cookie no se guardó
        } finally {
            setSeleccionando(false);
        }
    }

    const esViendoActivo = cicloIdActual === cicloActivo?.id;

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.35rem 0.65rem",
                borderRadius: "0.5rem",
                background: esViendoActivo
                    ? "rgba(34,197,94,0.1)"
                    : "rgba(245,158,11,0.12)",
                border: `1px solid ${esViendoActivo ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.35)"}`,
                fontSize: "0.8rem",
                whiteSpace: "nowrap",
            }}
        >
            <span
                style={{
                    color: esViendoActivo ? "#16a34a" : "#b45309",
                    fontWeight: 600,
                    fontSize: "0.72rem",
                    letterSpacing: "0.03em",
                }}
            >
                {esViendoActivo ? "📅 Ciclo activo" : "🔍 Viendo ciclo"}
            </span>

            <select
                value={cicloIdActual}
                onChange={handleChange}
                disabled={seleccionando || isPending}
                style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    color: esViendoActivo ? "#15803d" : "#92400e",
                    padding: "0 0.25rem",
                    maxWidth: "160px",
                }}
            >
                {todosCiclos.map((c) => (
                    <option key={c.id} value={c.id}>
                        {c.nombre}{c.activo ? " ✓" : ""}
                    </option>
                ))}
            </select>

            {(seleccionando || isPending) && (
                <RefreshCw size={13} style={{ animation: "spin 1s linear infinite", color: "#6b7280" }} />
            )}

            {!esViendoActivo && (
                <button
                    onClick={() =>
                        handleChange({ target: { value: cicloActivo?.id ?? "" } } as any)
                    }
                    disabled={seleccionando || isPending}
                    title="Volver al ciclo activo"
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.72rem",
                        color: "#6b7280",
                        padding: "0 0.1rem",
                        textDecoration: "underline",
                    }}
                >
                    Volver al activo
                </button>
            )}
        </div>
    );
}
