# Manual Técnico y Memoria de Arquitectura - SISAT-ATP

Este documento es el **Manual Técnico Definitivo** de **SISAT-ATP (Sistema Inteligente de Supervisión Administrativa Tecnológica y Automatización Técnica Pedagógica)**. Está diseñado para que cualquier desarrollador (humano o Inteligencia Artificial) pueda comprender la estructura completa del proyecto, la ubicación de cada módulo, y el funcionamiento técnico de los subsistemas, facilitando la implementación, actualización y modificación de la plataforma.

---

## 1. Arquitectura General y Stack Tecnológico

SISAT-ATP está construido sobre una arquitectura **Serverless** y **SSR (Server-Side Rendering)** híbrida utilizando los últimos estándares de React.

*   **Framework Principal**: **Next.js 14+** (App Router). La lógica de frontend se encuentra en componentes de cliente (`"use client"`) y la lógica de negocio en **Server Actions** o **API Routes** (`/api`).
*   **Base de Datos**: PostgreSQL alojada en [Neon](https://neon.tech/), optimizada para entornos serverless.
*   **ORM**: **Prisma** (`prisma/schema.prisma`). Gestiona los modelos, migraciones y el cliente fuertemente tipado.
*   **Autenticación**: **NextAuth.js v5 (Beta)**. Implementa estrategias JWT usando el proveedor `Credentials`. Soporta roles mixtos (Director de Escuela, ATP Lector, ATP Editor, Super Admin).
*   **Almacenamiento de Archivos**: **Cloudinary**. Se usa para almacenar PDFs, DOCX y JPGs de manera temporal o persistente. La subida se orquesta desde `/api/upload/route.ts`.
*   **Motor de Inteligencia Artificial**: **Google Gemini API** (`@google/genai`). Utilizado para revisión de documentos (texto) y OCR inteligente (visión). Cuenta con un sistema interno de rotación y fallback de API Keys.

---

## 2. Panel del Administrador (Supervisión / ATPs)

El portal administrativo se encuentra en la ruta `src/app/admin/AdminDashboard.tsx`. Actúa como el centro de mando y se divide en secciones renderizadas dinámicamente según los permisos granulares (JSON) del usuario en sesión. Los componentes individuales viven en `src/app/admin/_componentes/`.

### 2.1 Sección: Monitoreo
Enfocada en la visualización de métricas y el cumplimiento de las escuelas.
*   **Vista General (`VistaGeneral.tsx`)**: Dashboard estadístico que cruza datos de escuelas con el total de entregas aprobadas, pendientes y rechazadas. Calcula el "semáforo" de cumplimiento de la zona escolar.
*   **Avance de Entregas (`GestionPeriodos.tsx` / `ListadoProgramas.tsx`)**: Matrices de doble entrada (Escuela vs Programa) para identificar qué escuela ya subió el PMC, PAEC, etc.
*   **Reportes al Nivel (`ReportesNivel.tsx`)**: Genera sábanas Excel (XLSX) y reportes automatizados (CEDAVIM, Día Naranja). Llama a `/api/entregas/reportes`.

### 2.2 Sección: Configuración
El núcleo de parametrización del sistema.

*   **Gestión de Escuelas (`GestionEscuelas.tsx`)**: CRUD de escuelas (CCT, Nombre, Director). Incluye:
    - Reset de contraseñas de directores.
    - **Pestaña "Programas y Módulos por Escuela"** (nueva): Tabla-matriz donde cada fila es una escuela y cada columna es un módulo del sistema (Horarios IA, PMC, PAEC-PEC, etc.). Permite activar o desactivar módulos de forma individual por escuela o masivamente para todas. Ver sección 5.1.

*   **Programas y Módulos (`GestionProgramas.tsx`)**: Define los programas federales/estatales. Aquí se asocian las **Plantillas de Evaluación** (Rúbricas) que la IA leerá. Cuando se crea un programa nuevo, automáticamente aparece como columna nueva en la Matriz de Escuelas.

*   **Fechas y Entregas de Programas** *(antes llamada "Periodos y Tareas")*: Controla las fechas de apertura y cierre de entregas.

*   **Ciclos Escolares (`GestionCiclos.tsx`)**: Gestiona años lectivos (ej. "2025-2026").

*   **Formatos y Plantillas**: Subida de machotes en DOCX/PDF descargables por los directores.

*   **Configuración CAPEMS (`GestionCapems.tsx`)**: Parametriza las fichas de Control de Actividades. Establece qué meses están activos.

*   **Accesos y Seguridad (`GestionATPs.tsx`)**: Panel exclusivo del SUPER ADMIN para dar de alta a ATPs con permisos granulares en JSON.

*   **Herramientas de IA (`GestionLlavesIA.tsx` / `GestionPrompts.tsx`)**: Administración de llaves de API (Gemini/OpenRouter). Rotación automática entre llaves.

### 2.3 Sección: Módulos Activos
*   **Expedientes de Personal**: Listado completo de trabajadores de toda la zona con filtros por documento faltante/rechazado.
*   **Documentos Admin**: Sub-panel para documentos exclusivos de la supervisión.

---

## 3. Portal del Director (Escuelas)

Ubicado en `src/app/director/DirectorPortal.tsx`. Los componentes viven en `src/app/director/_componentes/`.

*   **Avance de Entregas (`EntregasListado.tsx`)**: Lista de tareas (PMC, PAEC, etc). Al subir un archivo, se dispara `/api/upload` y se invoca la Pre-Revisión IA automáticamente. El **Asistente de Correcciones** es una ventana de chat embebida que habla con el LLM usando como contexto las observaciones de esa entrega.

*   **Expedientes de Personal (`ExpedientesPanel.tsx`)**: CRUD de trabajadores de la escuela. El director llena datos básicos (RFC, nombre) y sube hasta 10 tipos de documentos. Al subir, se lanza validación OCR en segundo plano. **Regla de validación de Título según Cargo**:
    - **Personal de Apoyo Administrativo**: acepta Certificado de Bachillerato como Título válido (marcado como correcto).
    - **Docentes, Directores, Responsables de Plantel, ATPs, Supervisores**: requieren Título universitario completo.

*   **Fichas CAPEMS (`CapemsPanel.tsx`)**: Subida mensual de controles. La IA valida que la imagen corresponda a una ficha oficial.

*   **Generador de Horarios IA** (`src/app/director/_componentes/horarios/`): Ver sección 5.2.

*   **Inscripción de Eventos (`InscripcionEventos.tsx` / `OlimpiadaMatematicas.tsx`)**: Módulos temporales para concursos zonales.

---

## 4. Manual Técnico de Sistemas Centrales (Subsistemas)

### 4.1 Sistema de Autenticación y Autorización (JWT / Middlewares)
*   **Ubicación**: `src/lib/auth.ts`, `src/middleware.ts`, `src/lib/permissions.ts`.
*   **Funcionamiento**: NextAuth v5. Al hacer login (`/api/auth/callback/credentials`), se verifica el password con `bcryptjs`. Si es correcto, NextAuth inyecta en el JWT el `rol`, `cct` y `permisos`.
*   **Modificación**: Si agregas una nueva pestaña en el Admin, añade la llave de permiso en `src/lib/permissions.ts` y actualiza la DB (`schema.prisma > Admin > permisos (JSON)`).

### 4.2 Sistema OCR y Extracción de Datos Multimodal (Gemini Vision)
*   **Ubicación**: `src/lib/ocr-validator.ts` y `/api/expedientes/documentos/route.ts`.
*   **Funcionamiento**:
    1. Se descarga temporalmente de Cloudinary al servidor.
    2. Se convierte a buffer y se detecta el MimeType.
    3. Se arma un prompt rígido exigiendo respuesta en JSON.
    4. Gemini Vision analiza el documento (ej. extrae TODAS las Claves Presupuestales si es COMPROBANTE_PAGO).
    5. El backend intercepta el JSON y actualiza la DB automáticamente.
*   **Actualización**: Edita `systemInstruction` y expande `responseSchema` en `src/lib/ocr-validator.ts`.

### 4.3 Sistema de Pre-Revisión Textual, Evaluación Multiparte y Chat Contextual
*   **Ubicación**: `src/lib/pre-revision.ts`, `src/lib/gemini.ts`, `/api/entregas/[id]/chat/route.ts`.
*   **Pre-revisión en 3 Partes**: Documentos largos (PMC, PAEC-PEC, etc.) se dividen en 3 secciones temáticas para evitar timeouts de Vercel y recortes por ventana de contexto.
*   **Chat Asistente**: La API recupera el historial de mensajes (`ChatMensaje`) y el JSON de la Pre-revisión. Se concatena un System Prompt con la rúbrica y observaciones. Respuesta en tiempo real al frontend.

### 4.4 Generador de Códigos CVD y Firmas SHA-256 (Trazabilidad)
*   **Ubicación**: Lógica al aprobar documentos y en la visualización de formatos.
*   **Funcionamiento**: Hash SHA-256 combinando ID de escuela, fecha y un salt secreto. Se genera una URL de validación pública con QR estampado en el PDF final.

### 4.5 Generación de Documentos Oficiales en Masa (Docxtemplater)
*   **Ubicación**: `src/app/api/expedientes/generar-oficios/`.
*   **Funcionamiento**: `docxtemplater` + `pizzip`. Lee machotes `.docx` con tags tipo `{DIRECTOR_NOMBRE}`, `{ATP1_CLAVE}`, `{FECHA}`. El backend carga autoridades desde `AutoridadesConfig`, cruza con `Personal` e inyecta variables. Comprime todo en `.zip` descargable.

### 4.6 Arquitectura de Orquestación de IA, Pool Multiproveedor y Rotación Round-Robin
*   **Ubicación**: `src/lib/gemini.ts`, `src/app/admin/_componentes/GestionLlavesIA.tsx`, `/api/admin/api-keys/probar/route.ts` y `schema.prisma` (`ApiKey`, `PreRevisionConfig`).
*   **Rotación Round-Robin**: Puntero anular `globalKeyPointerIndex` que rota entre llaves en cada llamada.
*   **Modelos Autorizados Exclusivos**:
    - **Predeterminado (Principal)**: `gemini-3.5-flash-lite`
    - **Reserva (Fallback)**: `gemini-3.1-flash-lite`
    - ⛔ **REGLA ESTRICTA**: Queda prohibido usar o solicitar modelos obsoletos o de alto costo como `gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-pro` o similares. Toda la plataforma (Pre-revisión, OCR, Horarios, Reportes y Planeaciones) debe operar exclusivamente con `gemini-3.5-flash-lite` (o `gemini-3.1-flash-lite`).
*   **Failover y Reactivación Automática**: Si una llave devuelve HTTP 429 transitorio, se salta y prueba la siguiente. Si una llave tiene 5+ errores graves, se desactiva y reactiva tras 60 minutos.

---

## 5. Módulos Nuevos (v3.0 - v3.1)

### 5.1 Módulo: Generador de Horarios IA

#### Rutas y Archivos
| Archivo | Descripción |
|---------|-------------|
| `src/app/director/horarios/page.tsx` | Página principal del generador (Server Component) |
| `src/app/director/horarios/HorariosClient.tsx` | Shell cliente que decide si mostrar el Wizard o el Editor |
| `src/app/director/_componentes/horarios/WizardConfiguracion.tsx` | Wizard de 3 pasos para configurar el horario |
| `src/app/director/_componentes/horarios/EditorHorarios.tsx` | Visor y editor del horario ya generado |
| `src/app/api/horarios/configuracion/route.ts` | API para guardar/leer/borrar configuración de grupos y cargas |
| `src/app/api/horarios/generar/route.ts` | API que invoca la IA para generar el horario sin empalmes |
| `src/app/api/horarios/catalogos/route.ts` | API para gestionar catálogos (docentes manuales, etc.) |

#### Flujo del Wizard (3 Pasos)

**Paso 1 — Estructura & Currículo**
- Selector de Modo:
  - **Semiautomático (SEP Bachillerato General)**: Pre-carga el Mapa Curricular Oficial MCCEMS 2025-2026 (UACs universales, Capacitaciones Laborales, FFE Optativas). Cada grupo tiene un selector de Formación Laboral y opciones FFE independientes.
  - **Manual Libre (Tecnológicos / CBTIS)**: El usuario escribe libremente los nombres de las asignaturas y sus horas semanales. **Clave técnica**: se usa `curriculoManualPorGrupo: Record<string, any[]>` con clave `"semestre_letra"` (ej. `"1_A"`, `"3_B"`). Si hay 2+ grupos, aparece una barra de **tabs** (Grupo A | Grupo B | Grupo C…) que permite configurar las asignaturas de cada grupo de forma completamente independiente.
- Número de grupos por grado (1–20). Se autogenera la letra oficial (A, B, C…).
- Jornada Escolar (5, 6, 7 u 8 horas diarias).

**Paso 2 — Plantilla Docente**
- Lista de docentes activos en la escuela.
- Cada docente tiene un campo de **Horas Oficiales de Nombramiento** (cargado automáticamente desde `Personal.horasOficiales` en la DB).
- Permite agregar docentes directamente desde los expedientes de la plataforma (botón "Usar Expedientes") o crear docentes manuales.
- El sistema deshabilita la asignación de materias a docentes que ya superaron sus horas contratadas.

**Paso 3 — Matriz de Asignación Docente por Semestre**
- Muestra todos los grupos y sus UACs/asignaturas.
- Para cada celda (UAC × Grupo), el director selecciona el docente responsable de un `<select>`.
- Las opciones con exceso de horas se deshabilitan automáticamente.
- Contador en tiempo real: Horas Asignadas vs Horas Totales Requeridas del plantel.
- Botón **"Generar Horarios con IA"**: envía la configuración completa a la API que construye el horario sin empalmes usando lógica de restricciones.
- Botón **"Limpiar Datos"**: borra todas las cargas docentes y horarios generados de la DB (para empezar de cero).

#### Descarga de Horarios
- **Por Grupo (PDF)**: incluye nombre completo de asignaturas, horario de lunes a viernes.
- **Por Docente (PDF)**: horario personal de un único docente con todas sus horas.
- **Todos los Docentes (lote)**: descarga masiva en un solo clic.
- **Excel**: exportación de la matriz completa.

#### Campo `horasOficiales` en Modelo `Personal` (Prisma)
```prisma
model Personal {
  ...
  fechaIngreso      DateTime?
  clavePresupuestal String?
  horasOficiales    Int       @default(20)   // ← NUEVO en v3.0
  orden             Int       @default(0)
  ...
}
```
Este campo se carga automáticamente en el Paso 2 del Wizard para evitar inconsistencias entre lo que el director escribe manualmente y el nombramiento oficial del docente.

#### Variables de LocalStorage (v4)
El Wizard persiste su estado en `localStorage` con clave `horarios_wizard_v4_${escuelaId}`. Guarda: `paso`, `numGruposPorGrado`, `numPeriodos`, `grupos`, `horasDocentes`, `curriculoManualPorGrupo`, `grupoActivoManual`. Las **cargas (asignaciones docente-materia)** se excluyen del localStorage para evitar datos fantasma entre sesiones.

> ⚠️ **Nota de versión**: Si se cambia la estructura de datos del Wizard, hay que incrementar el sufijo de versión (`v4` → `v5`, etc.) para forzar la limpieza del caché viejo en los navegadores de los usuarios.

---

### 5.2 Módulo: Matriz de Control de Programas y Módulos por Escuela

#### Ubicación
`src/app/admin/_componentes/GestionEscuelas.tsx` — pestaña **"Programas y Módulos por Escuela"**

#### Descripción
Tabla-matriz donde:
- Cada **fila** representa una escuela de la zona.
- Cada **columna** representa un módulo del sistema (Horarios IA, PMC, PAEC-PEC, y cualquier programa nuevo).

#### Comportamiento de los Toggles
- **Toggle individual por escuela**: Activa/desactiva un módulo para una sola escuela. Optimistic UI update (cambia el color inmediatamente, luego hace el POST al API `/api/escuelas/${escuelaId}`).
- **Botón maestro por columna** (en el encabezado): Activa/desactiva un módulo para TODAS las escuelas en un solo clic. Usa el endpoint `/api/admin/escuelas/masivo-permisos`. **Importante**: después de la respuesta exitosa se actualiza el estado local directamente (`setEscuelas`) en lugar de llamar a `router.refresh()` (que no resetea `useState` en Client Components).

#### Endpoint Masivo
`POST /api/admin/escuelas/masivo-permisos`

Cuerpo de solicitud:
```json
{
  "tipo": "HORARIOS_IA" | "PLANEACIONES_IA" | "PROGRAMA",
  "accion": "ACTIVAR_TODOS" | "DESACTIVAR_TODOS",
  "programaNombre": "string (solo si tipo=PROGRAMA)"
}
```

#### Persistencia de Permisos en la DB
Los permisos se almacenan como JSON en el campo `permisos` de `Escuela`:
```json
{
  "horariosDesactivado": false,
  "planeacionesDesactivado": false,
  "programasInactivos": ["PMC", "PAEC-PEC"]
}
```

#### Propagación Automática de Nuevos Programas
Cuando el administrador crea un nuevo programa en "Programas y Módulos", automáticamente aparece como una nueva columna en la tabla de escuelas. No se requiere intervención manual.

#### Visibilidad de módulos en el Portal del Director
- Si `horariosDesactivado === true`, el Generador de Horarios desaparece del portal.
- Si `planeacionesDesactivado === true`, la Revisión de Planeaciones desaparece del portal.
- Ambas condiciones se consultan en `src/app/director/page.tsx` junto con la configuración global del módulo (`HorariosConfig`, `PlaneacionesConfig`).

---

### 5.4 Módulo: Revisión de Planeaciones Didácticas con IA (v3.3)

Implementado en julio 2026. Permite a los directores subir planeaciones didácticas de sus docentes y recibir retroalimentación automática generada por IA con base en el Anexo 12 USICAMM.

#### Rutas y Archivos
| Archivo | Descripción |
|---------|-------------|
| `src/lib/planeaciones-evaluator.ts` | Motor de IA: prompt engineering, criterios Anexo 12, llamada a `callGemini()` |
| `src/app/api/director/planeaciones/route.ts` | GET (lista + requisitos) / POST (sube y lanza revisión IA asíncrona) |
| `src/app/api/director/planeaciones/[id]/route.ts` | GET (detalle) / DELETE (eliminar) |
| `src/app/api/admin/planeaciones-config/route.ts` | GET/POST para que el admin active/desactive globalmente |
| `src/app/director/_componentes/planeaciones/GestionPlaneaciones.tsx` | UI del director: subida, listado, dictámenes, descarga Word |
| `src/app/admin/_componentes/GestionEscuelas.tsx` | Columna "📋 Planeaciones IA" en la Matriz de Módulos |

#### Estructura de Grupos por Escuela y Catálogo MCCEMS 2025-2026 (v3.4)
- **Estructura de Grupos en `Escuela` (`gruposPrimerAno`, `gruposSegundoAno`, `gruposTercerAno`)**: Define la cantidad de grupos por año lectivo (ej. `3-3-3` = 3 grupos de 1.º/2.º semestre, 3 de 3.er/4.º semestre, 3 de 5.º/6.º semestre).
- **Semestres A / B**:
  - **Semestre A**: 1.º, 3.er y 5.º Semestres.
  - **Semestre B**: 2.º, 4.º y 6.º Semestres.
- **Formaciones Laborales (15 Capacitaciones BGE Puebla)**: Cada grupo de 3.er y 5.º Semestre tiene asignada su Capacitación Laboral (Administración, Tecnología Informática, Redes y Mantenimiento, Área de la Salud, etc.), resolviendo automáticamente los 2 submódulos oficiales de esa capacitación.
- **Optativas FFE (5.º y 6.º Semestre)**: Cada grupo en 5.º Semestre lleva 4 Optativas FFE asignadas, sustituyendo nombres obsoletos.

#### Modelos Prisma Nuevos
```prisma
model PlaneacionesConfig {
  id              String   @id @default("singleton")
  activoGlobal    Boolean  @default(false)   // El admin activa/desactiva el módulo para todos
  requierePaecPec Boolean  @default(true)    // ← CANDADO: Sin PAEC-PEC no se puede usar
  requiereApiKey  Boolean  @default(true)
}

model PlaneacionDidactica {
  id                      String   @id @default(cuid())
  escuelaId               String
  cct                     String
  docenteNombre           String
  asignatura              String
  semestre                Int
  estado                  String   // PENDIENTE | EN_REVISION | REVISADO | ERROR
  archivoUrl              String
  puntajeObtenido         Int?
  puntajeMaximo           Int?
  nivelCumplimiento       String?  // COMPLETO | PARCIAL | REQUIERE_CORRECCION
  retroalimentacionDocente String?
  resultadoJson           Json?
  observacionesJson       Json?
  revisadoPor             String?
  fechaRevision           DateTime?
  fechaSubida             DateTime @default(now())
  escuela                 Escuela  @relation(fields: [escuelaId], references: [id])
}
```

#### Flujo de Revisión IA
1. Director sube PDF/DOCX de planeación en `GestionPlaneaciones.tsx`.
2. El POST sube el archivo a Cloudinary, crea el registro con `estado: EN_REVISION`.
3. Se lanza `revisarPlaneacionEnBackground()` (sin `await`) → respuesta rápida al frontend.
4. El background: descarga el PDF con `fetch()`, determina el tipo de evaluación (sem 1-4 / 5-6 / Laboral), llama a `evaluarPlaneacion()` → `callGemini()` con el buffer del PDF + prompt del Anexo 12.
5. Al terminar, actualiza el registro con el JSON de resultados y `estado: REVISADO`.
6. El director puede descargar la retroalimentación como `.docx` formal.

#### Tipos de Evaluación (según semestre)
| Tipo | Semestres | Rúbrica | Términos |
|------|-----------|---------|----------|
| `FUNDAMENTAL_1_4` | 1° – 4° | Anexo 12 CC 1-4 | Propósitos Formativos, Contenidos |
| `FUNDAMENTAL_5_6` | 5° – 6° | Anexo 12 CC 5-6 | Progresiones, Categorías, Metas |
| `LABORAL` | Cualquiera | Guía Retroalimentación Laboral | Competencias Laborales |

#### Candado de PAEC-PEC (REGLA CRÍTICA)
> ⚠️ Si la escuela **no ha subido su PAEC-PEC** (en cualquier estado distinto a `PENDIENTE`/`NO_ENTREGADO`), el módulo queda **completamente bloqueado** para esa escuela. La UI muestra un banner con el mensaje: *"Para usar la Revisión de Planeaciones Didácticas es obligatorio haber subido el PAEC-PEC de tu escuela."*

#### Control de Acceso por Nivel
| Nivel | Control |
|-------|---------|
| **Global** | `PlaneacionesConfig.activoGlobal` (el admin activa/desactiva para todos) |
| **Por escuela** | `Escuela.permisos.planeacionesDesactivado` (toggle en Matriz de Módulos) |
| **Por requisito** | `PlaneacionesConfig.requierePaecPec` + existencia de entrega PAEC-PEC |
| **Modo Pruebas (Admin)** | `PlaneacionesConfig.modoSinRestricciones` / `PreRevisionConfig.modoSinRestriccionesHorarios` (Omite todas las restricciones de PAEC-PEC, API Key y permisos para pruebas rápidas) |

#### Modelos Autorizados para Evaluación
- **Principal**: `gemini-3.5-flash-lite` (configurado en `PreRevisionConfig.modelDefault`)
- **Reserva**: `gemini-3.1-flash-lite`
- ⛔ NO usar `gemini-1.5-flash`, `gemini-2.0-flash` ni ningún modelo de costo elevado.


### 5.3 Módulo: Reporte de Cumplimiento con IA (v3.2)

Implementado en julio 2026. Reemplaza el antiguo reporte estático del botón "Descargar Reporte Final (Word)" con un sistema completo de análisis narrativo generado por IA.

#### Rutas y Archivos
| Archivo | Descripción |
|---------|-------------|
| `src/app/api/admin/reporte-cumplimiento/route.ts` | **[NUEVO]** API que consulta la BD, clasifica documentos y llama a la IA |
| `src/app/api/admin/ranking/route.ts` | **[MODIFICADO]** Agrega campos de breakdown y corrige el orden del ranking |
| `src/app/admin/_componentes/RankingEscuelas.tsx` | **[MODIFICADO]** Indicadores visuales + botón con IA + Word generado en cliente |

#### Distinción Crítica de Tipos de Incumplimiento

El sistema diferencia explícitamente dos situaciones con distinta severidad:

| Tipo | Estado en BD | Significado | Severidad | Lenguaje en el reporte |
|------|-------------|-------------|-----------|----------------------|
| **TIPO A** | `REQUIERE_CORRECCION` | La escuela SÍ entregó el documento, el ATP señaló correcciones que el director NO ha atendido | Moderada | "entregó el documento, sin embargo las correcciones no han sido atendidas" |
| **TIPO B** | `PENDIENTE`, `NO_ENTREGADO`, `NO_APROBADO` | La escuela NUNCA presentó el documento | **Grave** — penalización | "no fue presentado en ningún momento", "incumplimiento total", "el plantel adeuda completamente" |

> ⚠️ **Regla de negocio**: TIPO A y TIPO B **no son equivalentes**. Una escuela que entregó pero no corrigió es MENOS grave que una que nunca entregó. Esta distinción se refleja tanto en el ranking (posición) como en el Word (narrativa y color de tabla).

#### API: `GET /api/admin/reporte-cumplimiento`

**Proceso interno:**
1. Consulta todas las escuelas con entregas del ciclo activo (incluyendo `programa.nombre` y `correcciones` vía Prisma includes).
2. Clasifica cada documento:
   - `APROBADO` / `ENTREGADO_FISICO` → aprobados
   - `EN_REVISION` → en revisión (pendiente de dictamen ATP)
   - `REQUIERE_CORRECCION` → **TIPO A** (`docsConCorreccionesPendientes`)
   - `PENDIENTE` / `NO_ENTREGADO` / `NO_APROBADO` → **TIPO B** (`docsNoEntregados`)
   - `EXENTO` → excluido del cálculo
3. Calcula cumplimiento, medalla y ordenamiento.
4. Construye un prompt textual con datos de cada escuela, indicando explícitamente el tipo de incumplimiento y su gravedad.
5. Llama a `callGemini()` con el pool de llaves configurado en la plataforma.
6. Si la IA falla, genera narrativas de respaldo con `generarNarrativaFallback()`.
7. Retorna JSON con: `escuelas`, `narrativaPorEscuela`, `observacionesGenerales`, `conclusion`, `resumen`.

**Respuesta JSON (esquema):**
```typescript
{
  cicloNombre: string,
  fechaGeneracion: string,        // ISO
  supervisor: string,
  atpNombre: string,
  escuelas: EscuelaData[],
  narrativaPorEscuela: { cct: string; narrativa: string }[],
  observacionesGenerales: string,
  conclusion: string,
  resumen: {
    total: number,
    conOro: number, conPlata: number, conBronce: number, sinMedalla: number,
    conCorreccionesPendientes: number,  // escuelas con TIPO A
    conDocsNoEntregados: number,        // escuelas con TIPO B
    ningunoATiempo: boolean,
    promedioZona: number
  }
}
```

**Configuración de timeout:** `export const maxDuration = 60;` para permitir hasta 60 segundos en Vercel (necesario para la llamada IA con 17+ escuelas).

#### Prompt Engineering (Sistema de IA)

El `SYSTEM_INSTRUCTION` distingue explícitamente los dos tipos:

```
TIPO A — ENTREGÓ PERO NO ATENDIÓ CORRECCIONES:
  Severidad: MODERADA — entregó, pero el expediente quedó con observaciones.
  Redacción: "presentó el documento, sin embargo las correcciones no han sido atendidas"

TIPO B — NUNCA ENTREGÓ:
  Severidad: GRAVE — incumplimiento total.
  Redacción: "no fue presentado en ningún momento", "adeuda completamente"
```

El prompt de usuario envía los datos estructurados de cada escuela con marcadores explícitos:
```
--- TIPO A: ENTREGÓ PERO NO ATENDIÓ CORRECCIONES (1 documento) ---
   * Informe de Diagnóstico | Observación ATP: "Faltan gráficas de la sección 3"

--- TIPO B: NUNCA ENTREGÓ — INCUMPLIMIENTO TOTAL (2 documentos) ---
   * PAEC-PEC [NO_ENTREGADO] ← NO presentado en ningún momento
   * Plan de Mejora Continua [PENDIENTE] ← NO presentado en ningún momento
```

#### Corrección del Ranking (`ranking/route.ts`)

Se agregaron dos campos nuevos a cada elemento del ranking:
```typescript
docsConCorreccionesPendientes: number  // TIPO A: entregó pero no corrigió
docsNoEntregados: number               // TIPO B: nunca entregó (más grave)
```

**Nuevo orden de clasificación** (cuando el % de cumplimiento es igual):
1. Por medalla (ORO > PLATA > BRONCE > NINGUNA)
2. Por `cumplimiento` descendente
3. **Menos `docsNoEntregados` = mejor posición** (TIPO B penaliza el ranking)
4. Menos `docsConCorreccionesPendientes` (TIPO A penaliza menos)
5. Alfabético por nombre

**Ejemplo:** Dos escuelas con 87.5% de cumplimiento:
- Escuela A: 2 docs `REQUIERE_CORRECCION` → posición más alta
- Escuela B: 1 `REQUIERE_CORRECCION` + 1 `NO_ENTREGADO` → posición media
- Escuela C: 2 docs `NO_ENTREGADO` → posición más baja (Luis Donaldo Colosio)

#### Componente `RankingEscuelas.tsx`

**Cambios en la interfaz:**
```typescript
interface RankingItem {
  // ... campos existentes ...
  docsConCorreccionesPendientes: number;  // nuevo — TIPO A
  docsNoEntregados: number;               // nuevo — TIPO B
}
```

**Nueva columna "Estado de Entrega"** con etiquetas coloreadas:
- 🔴 Rojo `#fdecea` → nunca entregó (`docsNoEntregados > 0`)
- 🟠 Ámbar `#fffbeb` → sin corregir (`docsConCorreccionesPendientes > 0`)
- ✅ Verde → completo (ambos en 0)

**Botón "Descargar Reporte Final (Word)":**
- Muestra spinner con texto "Generando con IA..." mientras llama a `/api/admin/reporte-cumplimiento`
- Al recibir respuesta, llama a `buildWordReport(data)` en el cliente
- Descarga automáticamente el DOCX generado

#### Generador del Word (`buildWordReport`)

Función cliente que usa la librería `docx` para construir un documento con **8 secciones**:

| Sección | Contenido |
|---------|-----------|
| I | Datos de identificación (tabla) |
| II | Antecedentes y contexto (párrafos) |
| III | Resumen ejecutivo (tabla con estadísticas) |
| IV.1 | Tabla de escuelas con Medalla ORO (fondo dorado) |
| IV.2 | Tabla de escuelas con Medalla PLATA (fondo azul) |
| IV.3 | **TIPO A** — Entregaron sin corregir (fondo ámbar) |
| IV.4 | **TIPO B** — Nunca entregaron (fondo rojo) |
| V.A | Narrativas IA de planteles con cumplimiento completo |
| V.B | Narrativas IA de planteles con incumplimiento (con etiquetas de color) |
| VI | Observaciones y recomendaciones (párrafo IA) |
| VII | Conclusión (párrafo IA) |
| VIII | Firmas (tabla sin bordes, dos columnas: ATP y Supervisor) |

**Colores de tablas:**
```
ORO:    encabezado #B7860D / filas #FEF9C3, #FFFFF0
PLATA:  encabezado #2E5F9A / filas #D6E4F0, #EFF5FB
TIPO A: encabezado #C57B21 / filas #FEF3E2, #FFFBF5
TIPO B: encabezado #8B1A1A / filas #FDECEA, #FFF5F5
```

---

## 6. Historial de Bugs Corregidos (relevantes para futuros desarrollos)

### Bug: Toggle individual de Horarios IA (lógica invertida)
**Archivo**: `GestionEscuelas.tsx` — función `handleToggleHorariosEscuela`

**Causa**: El onClick pasaba `!horariosActivo` cuando debería pasar `horariosActivo`.
```tsx
// ❌ Incorrecto (bug)
onClick={() => handleToggleHorariosEscuela(esc.id, !horariosActivo)}

// ✅ Correcto
onClick={() => handleToggleHorariosEscuela(esc.id, horariosActivo)}
```
La función recibe `desactivado: boolean`. Si la escuela está activa (`horariosActivo = true`), hay que desactivarla (`desactivado = true`). Con `!horariosActivo` siempre se pasaba el valor incorrecto y el botón no cambiaba nada.

### Bug: Botones masivos no actualizaban la UI
**Archivo**: `GestionEscuelas.tsx` — función `handleAccionMasivaPermisos`

**Causa**: Después de un POST exitoso se llamaba `router.refresh()`. En Next.js App Router, `router.refresh()` re-renderiza Server Components pero **no resetea el `useState` de Client Components** que ya tienen datos cargados. El estado de la tabla permanecía igual aunque la DB sí se actualizaba.

**Solución**: Reemplazar `router.refresh()` por una actualización directa del estado local:
```tsx
// ❌ Incorrecto
if (data.success) { toast.success(...); router.refresh(); }

// ✅ Correcto
if (data.success) {
  toast.success(...);
  if (tipo === "HORARIOS_IA") {
    setEscuelas(prev => prev.map(e => ({ ...e, permisos: { ...e.permisos, horariosDesactivado } })));
  }
}
```

### Bug: Unique Constraint en `/api/horarios/configuracion`
**Error**: `PrismaClientKnownRequestError: Unique constraint failed on the fields: (escuelaId, nombre)`

**Causa**: Se intentaba hacer `upsert` de `HorarioGrupo` con una combinación de `escuelaId + nombre` que ya existía pero con un `id` diferente.

**Solución**: Usar `deleteMany` + `createMany` en lugar de `upsert` para grupos, garantizando idempotencia completa.

### Arquitectura: Modo Manual con currículo compartido (bug de diseño)
**Problema original**: El modo manual usaba 3 arrays compartidos (`materiasManualesSem1/3/5`) para TODOS los grupos. Con 2+ grupos, todos veían las mismas materias.

**Solución**: Cambio de estructura de datos a `curriculoManualPorGrupo: Record<string, any[]>` con clave `"semestre_letra"`. Así el Grupo A puede tener "Módulo de Mecatrónica" en 3er semestre mientras el Grupo B tiene "Módulo de Electrónica".

---

## 7. Modelos de Prisma Relevantes (actualizados)

```prisma
model Personal {
  id                String    @id @default(cuid())
  escuelaId         String
  nombre            String
  apellidoPaterno   String
  apellidoMaterno   String?
  cargo             String    // DOCENTE, DIRECTOR, ATP, APOYO_ADMINISTRATIVO, etc.
  rfcSinHomoclave   String?
  sexo              String    @default("MASCULINO")
  fechaIngreso      DateTime?
  clavePresupuestal String?
  horasOficiales    Int       @default(20)   // ← v3.0: horas de nombramiento oficial
  orden             Int       @default(0)
  escuela           Escuela   @relation(...)
  documentos        Documento[]
}

model Escuela {
  id           String   @id @default(cuid())
  cct          String   @unique
  nombre       String
  permisos     Json     @default("{}")  // horariosDesactivado, planeacionesDesactivado, programasInactivos
  // ... otros campos
}

model HorarioGrupo {
  id        String  @id @default(cuid())
  escuelaId String
  nombre    String  // "1° A", "3° B", etc.
  // Unique constraint: @@unique([escuelaId, nombre])
  escuela   Escuela @relation(...)
}
```

---

## 8. Asistente de Mapa Curricular, Formación Socioemocional y Bachilleratos Tecnológicos (v3.5)

### 8.1 Catálogo Oficial de Formación Socioemocional (Currículum Ampliado / FFEO)
Nombres exactos oficiales según el marco MCCEMS BGE Puebla:
1. `Educación para la Salud`
2. `Educación Integral en Sexualidad y Género`
3. `Práctica y Colaboración Ciudadana`

#### Regla de Asignación y No Repetición por Grupo:
Para cada grupo a lo largo de su trayectoria (3.er -> 4.º -> 5.º -> 6.º semestre):
*   **3.er Semestre (Semestre A)**: El director selecciona 1 de las 3 opciones (ej: *Educación para la Salud*).
*   **4.º Semestre (Semestre B)**: Continúa automáticamente con la materia de 3.er semestre.
*   **5.º Semestre (Semestre A)**: El director selecciona 1 de las 2 opciones restantes que NO fueron elegidas en 3.er semestre (ej: *Educación Integral en Sexualidad y Género*). El sistema filtra automáticamente las opciones para evitar repeticiones.
*   **6.º Semestre (Semestre B)**: Continúa automáticamente con la materia de 5.º semestre.

### 8.2 Optativas FFE Categorizadas por Cuadros (5.º Semestre BGE)
Las Optativas de Formación Formativa Extendida (FFE) están divididas en 2 bloques independientes:

#### Bloque 1: Recursos Sociocognitivos (Optativas 1 y 2)
1. `Comunicación y Sociedad I`
2. `Raíces Etimológicas del Español I`
3. `Inglés V (Avanzado)`
4. `Taller de Pensamiento Variacional I`
5. `Dibujo Técnico I`
6. `Pensamiento Matemático Aplicado a las Finanzas I`
7. `Taller de Probabilidad y Estadística I`

#### Bloque 2: Áreas de Conocimiento (Optativas 3 y 4)
1. `Salud Integral I`
2. `Análisis de Fenómenos y Procesos Biológicos`
3. `Análisis de Fenómenos Físicos I`
4. `Organización del Flujo de Materia y Energía en los Organismos I`
5. `Fundamentos de Administración I`
6. `Procesos Contables I`
7. `Derecho y Sociedad I`
8. `Economía I. La Función de los Agentes Económicos en la Sociedad`
9. `Temas Selectos de Ciencias Sociales I`
10. `Psicología I`
11. `Arte y Cultura I`
12. `Lógica y Pensamiento Crítico`
13. `Pensamiento Filosófico I`

### 8.3 Estructura de Datos para Bachilleratos Tecnológicos (CBTIS / DGETI / CBTa / CECYTE)
Basado en la Estructura Curricular Oficial del Bachillerato Tecnológico (Subsecretaría de Educación Media Superior):
*   **`Escuela.tipoBachillerato`**: `BACHILLERATO_GENERAL` vs `BACHILLERATO_TECNOLOGICO`.
*   **`Escuela.trayectoTecnologico`** / **`HorarioGrupo.trayectoTecnologico`**:
    - `FISICO_MATEMATICAS` (Temas de Física, Dibujo Técnico, Matemáticas Aplicadas).
    - `ECONOMICO_ADMINISTRATIVA` (Temas de Administración, Introducción a la Economía, Introducción al Derecho).
    - `QUIMICO_BIOLOGICA` (Introducción a la Bioquímica, Temas de Biología Contemporánea, Temas de Ciencias de la Salud).
    - `HUMANIDADES_Y_CIENCIAS_SOCIALES` (Temas de Ciencias Sociales, Literatura, Historia, Otras).
*   **`CarreraTecnica` (Modelo Prisma)**:
    - `modulo1`: Módulo I (Semestre 2, 17 hrs).
    - `modulo2`: Módulo II (Semestre 3, 17 hrs).
    - `modulo3`: Módulo III (Semestre 4, 17 hrs).
    - `modulo4`: Módulo IV (Semestre 5, 12 hrs).
    - `modulo5`: Módulo V (Semestre 6, 12 hrs).

---

*Este manual debe ser consultado y actualizado cada vez que se realicen modificaciones a la arquitectura profunda o se añadan nuevos modelos Prisma.*

*Última actualización: Julio 2026 — v3.5 — Mapa Curricular MCCEMS BGE, Categorías FFE, Socioemocional y Bachilleratos Tecnológicos integrados.*
