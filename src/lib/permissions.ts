export function hasBackendAccess(
    user: { role?: string; dbRole?: string; permisos?: any } | undefined,
    seccion: string,
    tipo: "read" | "write" = "read"
): boolean {
    if (!user) return false;

    // Directors have their own access control in specific APIs, hasBackendAccess returns true for general read but we override it there
    if (user.role === "director") {
        return false;
    }

    if (user.dbRole === "SUPER_ADMIN") return true;
    if (seccion === "seguridad") return false; // Solo Super Admin accede a seguridad

    const permisos = user.permisos;
    if (!permisos) {
        // Retrocompatibilidad
        const isMonitoringOrModule = [
            "general", "avances", "reportesNivel", 
            "eventos", "circular05", "olimpiada", "paec", "capems", "expedientes", "formatos"
        ].includes(seccion);
        
        if (user.dbRole === "ATP_EDITOR") {
            if (isMonitoringOrModule) return true;
            return tipo === "read";
        }
        if (isMonitoringOrModule) return tipo === "read";
        return false;
    }

    const userPermiso = permisos[seccion] || "NINGUNO";
    if (userPermiso === "ESCRITURA") return true;
    if (userPermiso === "LECTURA") return tipo === "read";
    return false;
}
