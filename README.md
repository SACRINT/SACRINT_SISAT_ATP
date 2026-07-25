# SISAT-ATP: Centro de Control de Supervisión

**SISAT-ATP** es el **Sistema Inteligente de Supervisión Administrativa Tecnológica y Automatización Técnica Pedagógica**, una plataforma web moderna diseñada para la supervisión de bachilleratos de la zona escolar. Su objetivo principal es automatizar la recepción, pre-evaluación y retroalimentación de planes escolares y evidencias entregadas por las escuelas del ciclo escolar.

---

## 🛠️ Tecnologías y Arquitectura

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions, API Routes)
- **Base de Datos**: PostgreSQL alojado en [Neon](https://neon.tech/) gestionado con [Prisma ORM](https://www.prisma.io/)
- **Procesamiento de Archivos**: Cloudinary para almacenamiento temporal, extracción local de texto (PDF/Word)
- **Motor de Evaluación**: Inteligencia Artificial (Google Gemini API) con un orquestador multiproveedor con rotación de llaves, control de errores y fallbacks automáticos.
- **Notificaciones**: Envío de correos oficiales mediante Resend / Nodemailer.

---

## 📂 Módulos del Sistema

### Módulos del Director (Escuelas)

1. **Monitoreo y Avances**: Tableros de control con avance porcentual de entregas de documentos PMC, PAEC, etc.
2. **Pre-evaluación Automática con IA**: Asistente que lee documentos y genera observaciones preliminares con base en rúbricas oficiales. Incluye chat contextual integrado.
3. **Expedientes de Personal**: CRUD de trabajadores de la escuela. Soporta subida de 10 tipos de documentos (INE, Título, Comprobante de Pago, Cédula Profesional, etc.) con validación automática por OCR/IA. La validación de **Título** varía según el cargo:
   - **Personal de Apoyo / Administrativo**: se acepta Certificado de Bachillerato como Título válido.
   - **Docentes, Directores, ATPs, Supervisores**: se requiere Título universitario completo.
4. **Fichas CAPEMS**: Subida y validación mensual de controles de actividades pedagógicas.
5. **Generador de Horarios IA** *(módulo nuevo)*: Asistente paso a paso para construir el horario escolar:
   - **Modo Semiautomático (SEP Bachillerato General)**: Precarga automáticamente el Mapa Curricular Oficial MCCEMS 2025-2026, UACs universales, capacitaciones laborales y expediente de personal.
   - **Modo Manual Libre (Tecnológicos / CBTIS)**: Configuración 100% personalizada de asignaturas, carreras técnicas y horas. Cada grupo (A, B, C…) tiene su propio plan de asignaturas independiente, ya que pueden pertenecer a carreras diferentes.
   - Paso 1: Estructura de grupos (número de grupos por grado, jornada escolar, currículo por grupo).
   - Paso 2: Plantilla Docente (horas oficiales de nombramiento, importación desde expedientes).
   - Paso 3: Matriz de Asignación Docente por Grupo y Semestre.
   - Generación automática del horario con IA (sin empalmes).
   - Descarga de horarios individuales por docente (PDF) y por grupo (PDF), así como descarga en lote.
6. **Inscripción de Eventos y Olimpiadas**: Módulos para cargar alumnos a concursos zonales.

### Módulos del Administrador (Supervisión / ATPs)

1. **Control de Accesos**: Permisos granulares de lectura y escritura para Asesores Técnicos Pedagógicos (ATPs).
2. **Validación de Expedientes y Fichas CAPEMS**: Detección de validez de títulos, cédulas, comprobantes de pago y extracción inteligente de datos (ej. múltiples Claves Presupuestales) mediante OCR y análisis visual de IA.
3. **Verificación CVD**: Generación de firmas digitales SHA-256 y códigos CVD verificables públicamente mediante QR.
4. **Reportes al Nivel**: Redacción automática y consolidación de reportes de acoso escolar (CEDAVIM) y Día Naranja (25N).
5. **Generación Automática de Documentos**: Creación dinámica de oficios, constancias y minutas (PDF/Word) auto-completando firmas y datos de autoridades educativas.
6. **Gestión de Escuelas con Matriz de Control de Programas** *(mejorado)*: CRUD de escuelas con una pestaña dedicada **"Programas y Módulos por Escuela"** que muestra una tabla-matriz. Cada fila es una escuela y cada columna es un módulo/programa. Permite:
   - Activar/desactivar módulos individualmente por escuela (toggle por celda).
   - Activar/desactivar un módulo para TODAS las escuelas simultáneamente (botón maestro por columna en el encabezado).
   - Los módulos nuevos se agregan automáticamente como columnas al registrarse en el sistema.
7. **Herramientas de IA**: Administración de llaves de API (Gemini/OpenRouter), rotación automática y diagnóstico de salud por llave.
8. **Fechas y Entregas de Programas**: Control de fechas de apertura y cierre por programa y escuela.

---

## 🚀 Comenzar Desarrollo

Primero, configura tu entorno con el archivo `.env` en la raíz (usando variables de base de datos y llaves de API necesarias).

Luego, inicia el servidor de desarrollo:

```bash
npm run dev
# o
yarn dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación corriendo localmente.

---

## 📋 Historial de Versiones Principales

| Versión | Fecha | Cambios |
|---------|-------|---------|
| v1.0 | 2024 | Lanzamiento inicial: entregas PMC/PAEC, pre-evaluación IA, expedientes básicos |
| v2.0 | 2025-Q1 | Motor OCR multimodal, validación de títulos/cédulas, CVD SHA-256, CAPEMS |
| v3.0 | 2025-Q2 | Generador de Horarios IA (modos Semiautomático y Manual), Matriz de Control de Programas por Escuela, campo horasOficiales en Personal, validación de Título según cargo |
| v3.1 | 2025-Q3 | Modo Manual con currículo independiente por grupo (tabs A/B/C), botones masivos de activación en matriz, corrección de bugs en toggles de módulos |
