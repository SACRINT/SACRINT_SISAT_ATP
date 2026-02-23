"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BookOpen, Eye, EyeOff, LogIn } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError("Correo o contraseña incorrectos");
            } else {
                router.push("/");
                router.refresh();
            }
        } catch {
            setError("Error al conectar. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-container">
            <div className="login-card fade-in">
                <div className="login-logo">🏫</div>
                <h1>SISAT-ATP</h1>
                <p className="subtitle">Supervisión Escolar Zona 004 BG</p>

                {error && (
                    <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="input-group" style={{ marginBottom: "1rem" }}>
                        <label htmlFor="email">Correo electrónico</label>
                        <input
                            id="email"
                            type="email"
                            className="input"
                            placeholder="tu-cct@seppue.gob.mx"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="input-group" style={{ marginBottom: "1.5rem" }}>
                        <label htmlFor="password">Contraseña</label>
                        <div style={{ position: "relative" }}>
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                className="input"
                                style={{ width: "100%", paddingRight: "3rem" }}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: "absolute",
                                    right: "0.75rem",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--text-muted)",
                                    padding: "0.25rem",
                                }}
                                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg btn-block"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="loading">Ingresando...</span>
                        ) : (
                            <>
                                <LogIn size={20} />
                                Ingresar
                            </>
                        )}
                    </button>
                </form>

                <p
                    style={{
                        textAlign: "center",
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        marginTop: "1.5rem",
                    }}
                >
                    Zona Escolar 004 BG • Supervisión
                </p>
            </div>
        </div>
    );
}
