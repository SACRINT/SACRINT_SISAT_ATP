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
*   **Vista General (`VistaGeneral.tsx`)**: Un dashboard estadístico que cruza datos de escuelas con el total de entregas aprobadas, pendientes y rechazadas. Calcula el "semáforo" de cumplimiento de la zona escolar.
*   **Avance de Entregas (`GestionPeriodos.tsx` / `ListadoProgramas.tsx`)**: Muestra matrices de doble entrada (Escuela vs Programa) para identificar rápidamente qué escuela ya subió el PMC, PAEC, etc., y el estado de revisión por parte del ATP.
*   **Reportes al Nivel (`ReportesNivel.tsx`)**: Genera sábanas de excel (XLSX) y reportes automatizados (CEDAVIM, Día Naranja). Internamente llama a `/api/entregas/reportes` para consolidar toda la información de la zona.

### 2.2 Sección: Configuración
El núcleo de parametrización del sistema.
*   **Escuelas (`GestionEscuelas.tsx` / `ListadoEscuelas.tsx`)**: CRUD de las escuelas (CCT, Nombre, Director). Incluye el reseteo de contraseñas de directores (NextAuth).
*   **Programas y Módulos (`GestionProgramas.tsx`)**: Define los programas federales/estatales (ej. PEMC, PAEC). Aquí se asocian las **Plantillas de Evaluación** (Rúbricas en texto) que la IA leerá para pre-evaluar el documento.
*   **Periodos y Tareas (`GestionPeriodos.tsx` / `GestionFechas.tsx`)**: Controla las fechas de apertura y cierre para las entregas de cada escuela.
*   **Ciclos Escolares (`GestionCiclos.tsx`)**: Gestiona años lectivos (ej. "2025-2026") para separar la base de datos temporalmente.
*   **Formatos y Plantillas**: Subida de machotes oficiales en formato DOCX y PDF que los directores pueden descargar.
*   **Configuración CAPEMS (`GestionCapems.tsx`)**: Parametriza las fichas de Control de Actividades. Establece qué meses están activos y los requisitos de cada ficha.
*   **Accesos y Seguridad (`GestionATPs.tsx`)**: Panel exclusivo del SUPER ADMIN para dar de alta a ATPs. Utiliza un objeto JSON de Permisos para habilitar/deshabilitar lectura o escritura en las pestañas de este mismo menú.
*   **Herramientas de IA (`GestionLlavesIA.tsx` / `GestionPrompts.tsx`)**: Administración de llaves de API (Gemini/OpenRouter). Las llaves se marcan como premium o regulares, y el sistema rota entre ellas automáticamente si alguna excede la cuota.

### 2.3 Sección: Módulos Activos
*   **Expedientes de Personal (`GestionExpedientes.tsx`)**: Permite a la supervisión ver el listado completo de trabajadores de toda la zona. Filtra documentos faltantes o rechazados y visualiza los datos extraídos por el OCR (Clave Presupuestal, RFC, Grado).
*   **Documentos Admin (`GestionCircular05.tsx` etc)**: Sub-panel para administrar documentos exclusivos de la supervisión.

---

## 3. Portal del Director (Escuelas)

Ubicado en `src/app/director/DirectorPortal.tsx`. La interfaz de cada escuela está simplificada y centrada en tareas ("To-Do"). Los componentes viven en `src/app/director/_componentes/`.

*   **Avance de Entregas (`EntregasListado.tsx`)**: Lista de tareas (PMC, PAEC, etc). Al subir un archivo (`<input type="file">`), se dispara `/api/upload` y automáticamente se invoca la Pre-Revisión IA. Aquí vive el **Asistente de Correcciones**, una ventana de chat incrustada que habla con el LLM pasándole como contexto las observaciones de esa entrega.
*   **Expedientes de Personal (`ExpedientesPanel.tsx`)**: CRUD local de los trabajadores de esa escuela. El director llena datos básicos (RFC, nombre) y sube 10 tipos de documentos (INE, Título, Comprobante de Pago). Al subir, se lanza una validación de OCR en segundo plano.
*   **Fichas CAPEMS (`CapemsPanel.tsx`)**: Subida mensual de controles. La IA valida que la imagen corresponda a una ficha oficial y extrae observaciones si está borrosa.
*   **Inscripción de Eventos (`InscripcionEventos.tsx` / `OlimpiadaMatematicas.tsx`)**: Módulos temporales para cargar alumnos a concursos zonales.

---

## 4. Manual Técnico de Sistemas Centrales (Subsistemas)

Esta es la explicación profunda de cómo funcionan los motores invisibles de SISAT-ATP. Si necesitas modificarlos, busca en las rutas indicadas.

### 4.1 Sistema de Autenticación y Autorización (JWT / Middlewares)
*   **Ubicación**: `src/lib/auth.ts`, `src/middleware.ts`, `src/lib/permissions.ts`.
*   **Funcionamiento**: Utiliza NextAuth v5. Al hacer login (ruta `/api/auth/callback/credentials`), se verifica el password cifrado con `bcryptjs`. Si es correcto, NextAuth inyecta en el JSON Web Token (JWT) el `rol` (admin/director), `cct` (clave de escuela), y `permisos`.
*   **Modificación**: Si agregas una nueva pestaña en el Admin, debes agregar la llave de permiso en `src/lib/permissions.ts` y actualizar la base de datos (`schema.prisma > Admin > permisos (JSON)`).

### 4.2 Sistema OCR y Extracción de Datos Multimodal (Gemini Vision)
*   **Ubicación**: `src/lib/ocr-validator.ts` y la ruta `/api/expedientes/documentos/route.ts`.
*   **Funcionamiento**: Cuando se sube un documento personal (ej. INE o Comprobante de Pago) o una ficha CAPEMS:
    1. Se descarga temporalmente de Cloudinary al servidor local.
    2. Se convierte a buffer y se detecta el MimeType.
    3. Se arma un prompt de sistema rígido exigiendo respuesta en `JSON`.
    4. Se le pide a Gemini Vision analizar el documento. Por ejemplo: *"Si el documento es un COMPROBANTE_PAGO, extrae TODAS las Claves Presupuestales y únelas con punto y coma"*.
    5. El backend intercepta el JSON y actualiza automáticamente los registros en la base de datos (ej. parchea el campo `clavePresupuestal` del modelo `Personal`).
*   **Actualización**: Para añadir nuevos documentos al OCR, simplemente edita la constante `systemInstruction` y expande el `responseSchema` en `src/lib/ocr-validator.ts`.

### 4.3 Sistema de Pre-Revisión Textual, Evaluación Multiparte y Chat Contextual
*   **Ubicación**: `src/lib/pre-revision.ts`, `src/lib/gemini.ts` y `/api/entregas/[id]/chat/route.ts`.
*   **Funcionamiento (Pre-revisión en 3 Partes)**: Al subir un DOCX/PDF largo (PMC, PAEC-PEC, Informe Final, etc.), el backend extrae el texto puro usando `pdfjs-dist` o `jszip`. Para evitar recortes por límite de ventana de contexto o timeouts de Vercel, el documento se divide en 3 secciones temáticas (Parte 1: Diagnóstico y Contexto, Parte 2: Objetivos y Metas, Parte 3: Acciones y Seguimiento). Cada parte se procesa mediante una llamada independiente al motor `callGemini`.
*   **Funcionamiento (Chat Asistente)**: Si el director abre el chat, la API recupera de Prisma el historial de mensajes (`ChatMensaje`) y el JSON de la Pre-revisión actual. Se concatena un System Prompt pasándole la rúbrica y observaciones. La respuesta se procesa con la llave activa del pool y se transmite en tiempo real hacia el frontend.

---

### 4.6 Arquitectura de Orquestación de IA, Pool Multiproveedor y Rotación Round-Robin
*   **Ubicación**: `src/lib/gemini.ts`, `src/app/admin/_componentes/GestionLlavesIA.tsx`, `/api/admin/api-keys/probar/route.ts` y `schema.prisma` (`ApiKey`, `PreRevisionConfig`).
*   **Gestión del Pool de Llaves**: Permite registrar múltiples llaves de API (Google Gemini, OpenAI, MorphLLM, etc.) marcadas como activas/inactivas y de uso general o exclusivo ATP (Premium).
*   **Rotación Determinista Round-Robin (`globalKeyPointerIndex`)**:
    Para evitar saturar una sola API Key o agotar su límite por minuto (RPM) o por día (RPD), `callGemini` implementa un puntero anular en memoria (`globalKeyPointerIndex`). En cada llamada a la IA (incluso entre las partes 1, 2 y 3 de un mismo pre-dictamen), el motor calcula:
    $$\text{startIndex} = \text{globalKeyPointerIndex} \pmod{\text{keys.length}}$$
    Esto reordena el anillo de llaves para iniciar en la siguiente llave de la lista de manera matemática y secuencial. Por ejemplo, en una evaluación de 3 partes:
    - **Parte 1**: Consume la **Llave #1** y avanza el puntero global a 2.
    - **Parte 2**: Consume la **Llave #2** y avanza el puntero global a 3.
    - **Parte 3**: Consume la **Llave #3** y avanza el puntero global a 1.
*   **Catálogo de Modelos de Alta Cuota (500 RPD)**:
    El sistema prioriza y soporta modelos oficiales de alta cuota gratuita de Google AI Studio:
    - **`Gemini 3.5 Flash Lite`** (`gemini-3.5-flash-lite`): 15 RPM | 250K TPM | **500 solicitudes/día (RPD)**.
    - **`Gemini 3.1 Flash Lite`** (`gemini-3.1-flash-lite`): 15 RPM | 250K TPM | **500 solicitudes/día (RPD)**.
    - **`Gemini 1.5 Flash`**: Modelo legacy con fallback automático a modelos Lite en caso de recibir respuesta HTTP 404 (modelo descontinuado/no encontrado).
    - **`Gemini 2.5 Flash`**: 5 RPM | 20 RPD (usado para cuentas Pro / Pay-As-You-Go).
*   **Sistema de Diagnóstico y Salud de Llaves (`/api/admin/api-keys/probar`)**:
    Permite probar individualmente o en lote todas las llaves registradas. El probador ejecuta un barrido en orden por el catálogo de modelos oficiales (`2.5-flash` ➔ `3.5-flash-lite` ➔ `3.1-flash-lite` ➔ `2.5-flash-lite` ➔ `1.5-flash`). Si detecta respuesta `200 OK`, marca la llave como activa y reporta cuál modelo específico soporta esa cuenta, evitando falsos positivos de cuota agotada.
*   **Failover y Reactivación Automática**:
    Si una llave devuelve un error HTTP 429 transitorio (límite por minuto alcanzado), el sistema la salta en el bucle y prueba la siguiente llave rotada sin desactivarla en la base de datos. Si una llave sufre más de 5 errores graves consecutivos (ej. clave borrada o inválida), se desactiva temporalmente y se reactiva automáticamente tras 60 minutos.

### 4.4 Generador de Códigos CVD y Firmas SHA-256 (Trazabilidad)
*   **Ubicación**: Lógica embebida al aprobar documentos y en la visualización de formatos.
*   **Funcionamiento**: Para evitar falsificaciones de oficios (ej. Constancias de Participación). Cuando el ATP aprueba y genera una constancia oficial, el sistema crea un Hash SHA-256 combinando el ID de la escuela, la fecha, y un "salt" secreto.
*   **Código QR**: Este hash genera una URL de validación pública (ej. `sisat-atp.com/verify?cvd=ABCD...`). El backend usa librerías de códigos QR para estampar este código en el PDF final. Cualquiera que escanee el QR verá un portal validando que el oficio fue emitido oficialmente por la zona escolar.

### 4.5 Generación de Documentos Oficiales en Masa (Docxtemplater)
*   **Ubicación**: `src/app/api/expedientes/generar-oficios/` (y scripts de constancias).
*   **Funcionamiento**: Utiliza la librería `docxtemplater` combinada con `pizzip`. El sistema lee de la base de datos un machote `.docx` que tiene tags tipo `{DIRECTOR_NOMBRE}`, `{ATP1_CLAVE}`, `{FECHA}`.
*   **Inyección de Autoridades**: Existe un registro singleton en Prisma llamado `AutoridadesConfig`. Al generar un documento, el backend carga a las autoridades de la zona, a los docentes seleccionados de la tabla `Personal`, cruza la información, e inyecta las variables en el documento Word. Finalmente, comprime todo en un archivo `.zip` con todos los oficios de la escuela para que el director lo descargue en un solo clic.

---

*Este manual debe ser consultado y actualizado cada vez que se realicen modificaciones a la arquitectura profunda o se añadan nuevos modelos Prisma.*
