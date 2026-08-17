import { NextResponse } from "next/server";
import { ejecutarVigilanciaProactiva } from "@/lib/vigilancia/vigilancia-engine";

// Disable Next.js caching for this cron route
export const dynamic = "force-dynamic";

/**
 * Endpoint de Vercel Cron para la ejecución programada del Agente de Vigilancia Proactiva.
 * Vercel Cron dispara exclusivamente peticiones GET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    console.log("[cron-vigilancia] Iniciando escaneo proactivo de zona...");
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") || process.env.TENANT_ID;

    if (!tenantId) {
      console.error("[cron-vigilancia] Error: TENANT_ID no configurado en entorno ni en parámetros");
      return NextResponse.json(
        { success: false, error: "TENANT_ID no configurado" },
        { status: 500 }
      );
    }

    const resultado = await ejecutarVigilanciaProactiva(tenantId);
    console.log("[cron-vigilancia] Escaneo completado:", resultado);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      resultado,
    });
  } catch (error: any) {
    console.error("[cron-vigilancia] Error ejecutando cron de vigilancia:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Error interno en cron de vigilancia",
      },
      { status: 500 }
    );
  }
}
