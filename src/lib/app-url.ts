// URL base de la aplicación, configurable por entorno (multitenant-friendly).
export function getAppUrl(): string {
    if (process.env.APP_URL) {
        return process.env.APP_URL.replace(/\/+$/, "");
    }
    if (process.env.NEXTAUTH_URL) {
        return process.env.NEXTAUTH_URL.replace(/\/+$/, "");
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    return "http://localhost:3000";
}