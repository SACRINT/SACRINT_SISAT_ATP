import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { procesarConsultaAgentica, ModuloCopilotoConfig } from "@/lib/tramites/agentic-chat";
import type { AgentSessionContext } from "@/lib/tramites/agentic-tools";

// Extender el timeout de Vercel a 60s para dar tiempo a la llamada Gemini con Function Calling
export const maxDuration = 60;

const CONFIG_MODULOS: Record<string, ModuloCopilotoConfig> = {
  oficios: {
    moduloId: "oficios",
    nombreVisible: "Copiloto de Oficios y Circulares",
    systemInstruction: "Tu rol principal en este módulo es asistir en la redacción institucional de oficios, circulares y avisos oficiales para la Secretaría de Educación Pública y la Supervisión Escolar y verificar plazos perentorios. Utiliza prioritariamente las herramientas 'redactarBorradorOficio' y 'consultarOficiosPendientes'.",
    toolsAllowlist: ["redactarBorradorOficio", "consultarOficiosPendientes"]
  },
  estadistica_911: {
    moduloId: "estadistica_911",
    nombreVisible: "Copiloto de Estadística 911 / SICEP",
    systemInstruction: "Tu rol principal en este módulo es auditar la coherencia aritmética de los formatos estadísticos 911 (alumnos por grado, género H+M, grupos y docentes), identificar inconsistencias antes de la entrega formal a Corde y generar reportes ejecutivos. Utiliza prioritariamente 'validarCoherenciaEstadistica911' y 'consultarResumen911'.",
    toolsAllowlist: ["validarCoherenciaEstadistica911", "consultarResumen911"]
  },
  usicamm: {
    moduloId: "usicamm",
    nombreVisible: "Copiloto de Procesos USICAMM",
    systemInstruction: "Tu rol principal en este módulo es asesorar a directores y docentes sobre los requisitos, etapas, documentación y fechas clave de convocatorias USICAMM (Promoción Horizontal/Vertical, Admisión, Horas Adicionales y Cambios de C.T.). Utiliza prioritariamente 'orientarConvocatoriaUsicamm' y 'consultarConvocatoriasUsicamm'.",
    toolsAllowlist: ["orientarConvocatoriaUsicamm", "consultarConvocatoriasUsicamm"]
  },
  expedientes_personal: {
    moduloId: "expedientes_personal",
    nombreVisible: "Copiloto de Expedientes de Personal",
    systemInstruction: "Tu rol principal en este módulo es informar y asesorar sobre los expedientes del personal docente, directivo y administrativo de los planteles, verificar el estado de integración de los 10 documentos obligatorios, identificar faltantes o expedientes incompletos y auditar la plantilla laboral activa. Utiliza prioritariamente 'consultarExpedientesPersonal'.",
    toolsAllowlist: ["consultarExpedientesPersonal"]
  },
  capems: {
    moduloId: "capems",
    nombreVisible: "Copiloto de Sesiones CAPEMS y CORDE",
    systemInstruction: "Tu rol principal en este módulo es asesorar en la gestión de sesiones del Consejo Académico (CAPEMS) y Reuniones Educativas Regionales de Estructura CORDE. REGLA OBLIGATORIA DE CONSULTA: ANTE CUALQUIER pregunta sobre temas tratados en reuniones o sesiones (inventarios, seguros patrimoniales, inscripciones, evaluaciones diagnósticas EIA, lineamientos de inicio de ciclo, acuerdos o trámites), DEBES CONSULTAR OBLIGATORIAMENTE la herramienta 'consultarSesionesCAPEMS' con el parámetro 'query' y CITAR las diapositivas y formatos oficiales de la presentación oficial subida (ej. Diapositiva 82, 84, 90, 98, Formato BM-03, Formato 01, Formato 04, plazos de 2 días hábiles, Seguro Estatal GMX vs Seguro Federal AGROASEMEX y correos oficiales de contacto). Utiliza 'consultarCompromisosZonales' para acuerdos específicos de escuelas.",
    toolsAllowlist: ["consultarSesionesCAPEMS", "consultarCompromisosZonales"]
  }
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await req.json();
    const { mensaje, modulo } = body;

    if (!mensaje || !mensaje.trim()) {
      return NextResponse.json({ error: "El mensaje es requerido." }, { status: 400 });
    }

    // Aislamiento Zero Trust: NUNCA se lee escuelaId del body. Se mapea exclusivamente de la sesión JWT.
    const userRole = (user.role || "director") as "admin" | "supervision" | "director";
    let tenantId = user.tenantId || user.organizacionId;

    if (!tenantId && user.id) {
      try {
        if (userRole === "admin") {
          const adm = await prisma.admin.findUnique({ where: { id: user.id }, select: { organizacionId: true } });
          tenantId = adm?.organizacionId;
        } else {
          const esc = await prisma.escuela.findUnique({ where: { id: user.id }, select: { zonaEscolar: true } });
          if (esc?.zonaEscolar) {
            tenantId = `zona${esc.zonaEscolar.replace(/^0+/, "").padStart(3, "0")}`;
          }
        }
      } catch (err) {
        console.error("Error resolviendo tenantId en chat:", err);
      }
    }

    if (!tenantId) {
      try {
        const primerAdmin = await prisma.admin.findFirst({ select: { organizacionId: true } });
        tenantId = primerAdmin?.organizacionId || "zona004";
      } catch {
        tenantId = "zona004";
      }
    }

    const sessionContext: AgentSessionContext = {
      userId: user.id,
      userEmail: user.email || undefined,
      role: userRole,
      dbRole: user.dbRole,
      tenantId,
      // Para directores y supervisores, user.id es el id de la escuela; para admins es undefined (zonal)
      escuelaId: userRole === "director" || userRole === "supervision" ? user.id : undefined,
      nombreUsuario: user.name || user.email
    };

    // Obtener configuración del módulo si se especificó
    const moduloConfig = modulo && CONFIG_MODULOS[modulo] ? CONFIG_MODULOS[modulo] : undefined;

    // 1. Obtener historial reciente de la conversación aislado por usuario
    const historialPrevio = await prisma.chatTramitesMensaje.findMany({
      where: { usuarioId: user.id },
      orderBy: { createdAt: "desc" },
      take: 4
    });
    const historialFormateado = historialPrevio.reverse().map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content
    }));

    // 2. Guardar mensaje de usuario en historial
    await prisma.chatTramitesMensaje.create({
      data: {
        usuarioId: user.id,
        role: "user",
        content: mensaje.trim()
      }
    });

    // 3. Ejecutar motor de Chat Agéntico con Function Calling y configuración de módulo
    const resultadoAgentico = await procesarConsultaAgentica(
      mensaje.trim(),
      sessionContext,
      historialFormateado,
      moduloConfig
    );

    // 4. Guardar respuesta del asistente
    await prisma.chatTramitesMensaje.create({
      data: {
        usuarioId: user.id,
        role: "assistant",
        content: resultadoAgentico.respuesta,
        fuentes: (resultadoAgentico.fuentes as any) || undefined
      }
    });

    return NextResponse.json({
      success: true,
      respuesta: resultadoAgentico.respuesta,
      fuentes: resultadoAgentico.fuentes,
      huboFuentes: resultadoAgentico.huboFuentes,
      herramientasEjecutadas: resultadoAgentico.herramientasEjecutadas
    });
  } catch (error: any) {
    console.error("[api/tramites/chat] Error en POST:", error);
    return NextResponse.json({ error: "Error al procesar la consulta agéntica" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;

    // Corrección de fuga de seguridad: Filtrar estrictamente por usuarioId
    const mensajes = await prisma.chatTramitesMensaje.findMany({
      where: { usuarioId: user.id },
      orderBy: { createdAt: "asc" },
      take: 30
    });

    return NextResponse.json({ success: true, mensajes });
  } catch (error: any) {
    console.error("[api/tramites/chat] Error en GET:", error);
    return NextResponse.json({ error: "Error al obtener historial de chat" }, { status: 500 });
  }
}
