# SISAT-ATP: Centro de Control de Supervisión

**SISAT-ATP** es el **Sistema Inteligente de Supervisión Administrativa Tecnológica y Automatización Técnica Pedagógica**, una plataforma web moderna diseñada para la supervisión de bachilleratos de la zona escolar. Su objetivo principal es automatizar la recepción, pre-evaluación y retroalimentación de planes escolares y evidencias entregadas por las escuelas del ciclo escolar.

---

## 🛠️ Tecnologías y Arquitectura

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions, API Routes)
- **Base de Datos**: PostgreSQL alojado en [Neon](https://neon.tech/) gestionado con [Prisma ORM](https://www.prisma.io/)
- **Procesamiento de Archivos**: Cloudinary para almacenamiento temporal, extracción local de texto (PDF/Word)
- **Motor de Evaluación**: Inteligencia Artificial (Google Gemini API) con un orquestador multiproveedor que rotación de llaves, control de errores y fallbacks automáticos.
- **Notificaciones**: Envío de correos oficiales mediante Resend / Nodemailer.

---

## 📂 Módulos del Sistema

1. **Monitoreo y Avances**: Tableros de control con avance porcentual de entregas de documentos PMC, PAEC, etc.
2. **Pre-evaluación Automática**: Asistente automático que lee documentos y genera observaciones preliminares detalladas con base en rúbricas.
3. **Control de Accesos**: Permisos granulares de lectura y escritura para Asesores Técnicos Pedagógicos (ATPs).
4. **Validación de Expedientes**: Detección de validez de títulos, cédulas y documentos personales mediante OCR y análisis visual.
5. **Verificación CVD**: Generación de firmas digitales SHA-256 y códigos CVD verificables públicamente mediante QR.
6. **Reportes al Nivel**: Redacción automática y consolidación de reportes de acoso escolar (CEDAVIM) y Día Naranja (25N).

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
