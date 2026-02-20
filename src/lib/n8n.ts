/**
 * n8n webhook helper
 * Calls n8n webhook endpoints to trigger notification workflows.
 * If N8N_WEBHOOK_BASE_URL is not configured, calls are silently skipped.
 */

const N8N_BASE = process.env.N8N_WEBHOOK_BASE_URL;

type N8nEvent =
    | "entrega-subida"
    | "correccion-enviada";

interface EntregaSubidaPayload {
    escuelaNombre: string;
    escuelaCCT: string;
    escuelaEmail: string;
    programaNombre: string;
    periodo: string;
    driveUrl?: string;
}

interface CorreccionEnviadaPayload {
    escuelaNombre: string;
    escuelaEmail: string;
    programaNombre: string;
    texto?: string;
    adminNombre: string;
}

type N8nPayload = EntregaSubidaPayload | CorreccionEnviadaPayload;

export async function notifyN8n(
    event: N8nEvent,
    payload: N8nPayload
): Promise<void> {
    if (!N8N_BASE) {
        // n8n not configured yet — skip silently
        return;
    }

    const url = `${N8N_BASE}/${event}`;

    try {
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            // Short timeout so it doesn't block the main request
            signal: AbortSignal.timeout(5000),
        });
    } catch (err) {
        // Log but don't throw — n8n errors shouldn't break the main flow
        console.warn(`[n8n] Failed to notify event "${event}":`, err);
    }
}
