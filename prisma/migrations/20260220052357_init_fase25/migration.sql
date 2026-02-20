-- CreateEnum
CREATE TYPE "EstadoEntrega" AS ENUM ('PENDIENTE', 'EN_REVISION', 'REQUIERE_CORRECCION', 'APROBADO', 'NO_APROBADO', 'NO_ENTREGADO');

-- CreateEnum
CREATE TYPE "TipoPeriodo" AS ENUM ('ANUAL', 'SEMESTRAL', 'MENSUAL');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escuela" (
    "id" TEXT NOT NULL,
    "cct" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "hombres" INTEGER NOT NULL DEFAULT 0,
    "mujeres" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "rol" TEXT NOT NULL DEFAULT 'director',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escuela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CicloEscolar" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CicloEscolar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoPeriodo" NOT NULL DEFAULT 'ANUAL',
    "numArchivos" INTEGER NOT NULL DEFAULT 1,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Programa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodoEntrega" (
    "id" TEXT NOT NULL,
    "cicloEscolarId" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "mes" INTEGER,
    "semestre" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaLimite" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodoEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entrega" (
    "id" TEXT NOT NULL,
    "escuelaId" TEXT NOT NULL,
    "periodoEntregaId" TEXT NOT NULL,
    "estado" "EstadoEntrega" NOT NULL DEFAULT 'PENDIENTE',
    "observacionesATP" TEXT,
    "fechaSubida" TIMESTAMP(3),
    "fechaRevision" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Archivo" (
    "id" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "driveId" TEXT,
    "driveUrl" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'ENTREGA',
    "subidoPor" TEXT NOT NULL DEFAULT 'director',
    "etiqueta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Archivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correccion" (
    "id" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "texto" TEXT,
    "archivoId" TEXT,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Correccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recurso" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "archivoNombre" TEXT NOT NULL,
    "archivoDriveId" TEXT,
    "archivoDriveUrl" TEXT,
    "programaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recurso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Escuela_cct_key" ON "Escuela"("cct");

-- CreateIndex
CREATE UNIQUE INDEX "Escuela_email_key" ON "Escuela"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CicloEscolar_nombre_key" ON "CicloEscolar"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Programa_nombre_key" ON "Programa"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodoEntrega_cicloEscolarId_programaId_mes_semestre_key" ON "PeriodoEntrega"("cicloEscolarId", "programaId", "mes", "semestre");

-- CreateIndex
CREATE UNIQUE INDEX "Entrega_escuelaId_periodoEntregaId_key" ON "Entrega"("escuelaId", "periodoEntregaId");

-- CreateIndex
CREATE UNIQUE INDEX "Correccion_archivoId_key" ON "Correccion"("archivoId");

-- AddForeignKey
ALTER TABLE "PeriodoEntrega" ADD CONSTRAINT "PeriodoEntrega_cicloEscolarId_fkey" FOREIGN KEY ("cicloEscolarId") REFERENCES "CicloEscolar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodoEntrega" ADD CONSTRAINT "PeriodoEntrega_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_escuelaId_fkey" FOREIGN KEY ("escuelaId") REFERENCES "Escuela"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_periodoEntregaId_fkey" FOREIGN KEY ("periodoEntregaId") REFERENCES "PeriodoEntrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correccion" ADD CONSTRAINT "Correccion_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correccion" ADD CONSTRAINT "Correccion_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correccion" ADD CONSTRAINT "Correccion_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recurso" ADD CONSTRAINT "Recurso_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
