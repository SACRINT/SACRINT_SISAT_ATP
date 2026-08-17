/**
 * Motor Predictivo Determinista y Análisis de Capacidad Áulica para Estadística 911 / SICEP.
 * 
 * Cumple con:
 * - Determinismo matemático estricto (CERO llamadas a LLM para cálculo numérico).
 * - Arquitectura por capas:
 *   - Capa 1: Modelo Paramétrico Transversal SEP (Ratios 20 mín, 35 estándar, 45 saturación).
 *   - Capa 2: Avance de Cohortes con >= 2 ciclos históricos reales (deriva tasas de deserción y transición reales).
 * - Aislamiento Zero-Trust y marcado explícito `esProyeccion: true`.
 * - Regla 7: CERO datos personales sensibles (solo métricas agregadas por grado y plantel).
 */

import { prisma } from "@/lib/db";

export type SemaforoCapacidad = "EQUILIBRADO" | "RIESGO_SOBRECUPO" | "RIESGO_SUBUTILIZACION" | "RIESGO_DESERCION_CRITICA";

export interface ProyeccionGrado {
  grado: number; // 1, 2, 3 o semestre 1 a 6
  gruposAutorizados: number;
  matriculaEstimada: number;
  rangoMinimo: number; // grupos * 20
  rangoMaximo: number; // grupos * 45
  promedioAlumnosPorGrupo: number;
}

export interface ProyeccionEscuela911 {
  escuelaId: string;
  cct: string;
  nombre: string;
  localidad?: string | null;
  municipio?: string | null;
  esProyeccion: true;
  metodoCalculo: "PARAMETRICO_TRANSVERSAL" | "COHORTES_HISTORICAS";
  corteProyectado: "INICIO_DE_CURSOS" | "FIN_DE_CURSOS";
  
  // Matrícula proyectada
  matriculaTotalEstimada: number;
  intervaloConfianzaMin: number;
  intervaloConfianzaMax: number;
  
  // Capacidad áulica y grupos
  totalGruposAutorizados: number;
  gruposRequeridosOptimos: number; // matricula / 35
  capacidadInstaladaOptima: number; // grupos * 35
  densidadPromedioPorGrupo: number;
  
  // Plantilla docente
  docentesEstimadosRequeridos: number; // ceil(grupos * 1.3)
  
  // Semáforo y diagnóstico
  semaforoRiesgo: SemaforoCapacidad;
  observacionOperativa: string;
  
  // Desglose por grado
  desgloseGrados: ProyeccionGrado[];
  
  fechaCalculo: string;
}

export interface ProyeccionZonal911 {
  tenantId: string;
  esProyeccion: true;
  corteProyectado: "INICIO_DE_CURSOS" | "FIN_DE_CURSOS";
  totalEscuelasAnalizadas: number;
  
  // Totales acumulados
  matriculaZonalEstimada: number;
  matriculaZonalMin: number;
  matriculaZonalMax: number;
  totalGruposZonales: number;
  capacidadZonalOptima: number;
  docentesZonalesRequeridos: number;
  
  // Resumen de semáforos
  conteoEquilibradas: number;
  conteoRiesgoSobrecupo: number;
  conteoRiesgoSubutilizacion: number;
  conteoRiesgoDesercion: number;
  
  // Detalle por escuela
  escuelas: ProyeccionEscuela911[];
  
  fechaCalculo: string;
}

export interface RegistroHistorico911ParaProyeccion {
  cicloEscolarId: string;
  tipoCorte: string;
  totalAlumnos: number;
  totalGrupos: number;
  totalDocentes: number;
  totalAprobados?: number;
  totalReprobados?: number;
  totalDesercion?: number;
  totalEgresados?: number;
  createdAt?: Date;
  cicloEscolar?: {
    id?: string;
    nombre?: string;
    inicio?: Date;
    fin?: Date;
  } | null;
  detalles: Array<{
    semestreGrado: number;
    total: number;
    grupos: number;
    hombres?: number;
    mujeres?: number;
  }>;
}

// Parámetros normativos oficiales de la SEP para secundarias técnicas y bachilleratos
const RATIO_SEP_MIN_GRUPO = 20;     // Mínimo para mantener grupo abierto
const RATIO_SEP_OPTIMO_GRUPO = 35;  // Capacidad pedagógica estándar
const RATIO_SEP_MAX_GRUPO = 45;     // Límite de saturación física
const FACTOR_CARGA_DOCENTE = 1.3;   // Docentes equivalentes por grupo (cobertura curricular)

/**
 * Calcula la proyección predictiva determinista para una escuela.
 */
export function calcularProyeccionEscuela(
  escuela: {
    id: string;
    cct: string;
    nombre: string;
    localidad?: string | null;
    municipio?: string | null;
    gruposPrimerAno?: number | null;
    gruposSegundoAno?: number | null;
    gruposTercerAno?: number | null;
    hombres?: number | null;
    mujeres?: number | null;
    total?: number | null;
  },
  registrosHistoricos911: RegistroHistorico911ParaProyeccion[],
  corteProyectado: "INICIO_DE_CURSOS" | "FIN_DE_CURSOS" = "INICIO_DE_CURSOS"
): ProyeccionEscuela911 {
  const g1 = Math.max(1, escuela.gruposPrimerAno || 1);
  const g2 = Math.max(1, escuela.gruposSegundoAno || 1);
  const g3 = Math.max(1, escuela.gruposTercerAno || 1);
  const totalGrupos = g1 + g2 + g3;

  // 1. Ordenar cronológicamente los registros históricos por cicloEscolar/fecha y corte
  const registrosOrdenados = [...registrosHistoricos911].sort((a, b) => {
    const fechaA = (a.cicloEscolar?.inicio ? new Date(a.cicloEscolar.inicio).getTime() : 0) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const fechaB = (b.cicloEscolar?.inicio ? new Date(b.cicloEscolar.inicio).getTime() : 0) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    if (fechaA !== fechaB) return fechaA - fechaB;
    // INICIO antes que FIN dentro del mismo ciclo
    if (a.tipoCorte === "INICIO_DE_CURSOS" && b.tipoCorte === "FIN_DE_CURSOS") return -1;
    if (a.tipoCorte === "FIN_DE_CURSOS" && b.tipoCorte === "INICIO_DE_CURSOS") return 1;
    return 0;
  });

  // Agrupar registros ordenados por cicloEscolarId
  const mapaCiclos = new Map<string, {
    cicloId: string;
    nombre?: string;
    inicio?: Date;
    inicioCursos?: RegistroHistorico911ParaProyeccion;
    finCursos?: RegistroHistorico911ParaProyeccion;
  }>();

  for (const reg of registrosOrdenados) {
    const key = reg.cicloEscolarId;
    const item = mapaCiclos.get(key) || {
      cicloId: key,
      nombre: reg.cicloEscolar?.nombre,
      inicio: reg.cicloEscolar?.inicio
    };
    if (reg.tipoCorte === "INICIO_DE_CURSOS") {
      item.inicioCursos = reg;
    } else if (reg.tipoCorte === "FIN_DE_CURSOS") {
      item.finCursos = reg;
    }
    mapaCiclos.set(key, item);
  }

  const ciclosOrdenados = Array.from(mapaCiclos.values());
  const tiene2CiclosOMas = ciclosOrdenados.length >= 2;

  let metodo: "PARAMETRICO_TRANSVERSAL" | "COHORTES_HISTORICAS" = "PARAMETRICO_TRANSVERSAL";
  let desgloseGrados: ProyeccionGrado[] = [];
  let totalEstimado = 0;
  let totalMin = 0;
  let totalMax = 0;
  let motivoDegradacion: string | null = null;

  if (tiene2CiclosOMas) {
    // Tomar los 2 ciclos más recientes en orden cronológico estricto
    const cicloAnterior = ciclosOrdenados[ciclosOrdenados.length - 2];
    const cicloReciente = ciclosOrdenados[ciclosOrdenados.length - 1];

    // A. Derivar Tasa de Deserción Intraciclo Real por Grado (TasaDesercion_g = 1 - (Fin_g / Inicio_g))
    const tasaDesercionPorGrado: Record<number, number> = {};
    const cicloConAmbos = (cicloReciente.inicioCursos && cicloReciente.finCursos)
      ? cicloReciente
      : (cicloAnterior.inicioCursos && cicloAnterior.finCursos) ? cicloAnterior : null;

    if (cicloConAmbos?.inicioCursos && cicloConAmbos.finCursos) {
      for (const g of [1, 2, 3]) {
        const dIni = cicloConAmbos.inicioCursos.detalles.find(d => d.semestreGrado === g);
        const dFin = cicloConAmbos.finCursos.detalles.find(d => d.semestreGrado === g);
        if (dIni && dFin && dIni.total > 0) {
          const tasaRet = dFin.total / dIni.total;
          tasaDesercionPorGrado[g] = Math.max(0, Math.min(0.5, 1 - tasaRet));
        }
      }
    }

    // B. Derivar Tasa de Transición Interanual / Promoción (1° -> 2° y 2° -> 3°)
    const regBaseAnt = cicloAnterior.finCursos || cicloAnterior.inicioCursos;
    const regBaseRec = cicloReciente.inicioCursos || cicloReciente.finCursos;

    const tasaTransicion: Record<number, number> = {}; // 2: 1->2, 3: 2->3
    const matriculaUltimoGrado: Record<number, { total: number; grupos: number }> = {};

    if (regBaseAnt && regBaseRec) {
      const detAnt = regBaseAnt.detalles;
      const detRec = regBaseRec.detalles;

      // Grado 1 a Grado 2
      const g1Ant = detAnt.find(d => d.semestreGrado === 1);
      const g2Rec = detRec.find(d => d.semestreGrado === 2);
      if (g1Ant && g2Rec && g1Ant.total > 0 && g2Rec.total > 0) {
        const t12 = g2Rec.total / g1Ant.total;
        if (t12 >= 0.5 && t12 <= 1.4) {
          tasaTransicion[2] = t12;
        }
      }

      // Grado 2 a Grado 3
      const g2Ant = detAnt.find(d => d.semestreGrado === 2);
      const g3Rec = detRec.find(d => d.semestreGrado === 3);
      if (g2Ant && g3Rec && g2Ant.total > 0 && g3Rec.total > 0) {
        const t23 = g3Rec.total / g2Ant.total;
        if (t23 >= 0.5 && t23 <= 1.4) {
          tasaTransicion[3] = t23;
        }
      }

      for (const g of [1, 2, 3]) {
        const d = detRec.find(item => item.semestreGrado === g);
        if (d && d.total > 0) {
          matriculaUltimoGrado[g] = { total: d.total, grupos: d.grupos || 1 };
        }
      }
    }

    // Verificar si fue posible derivar todas las tasas requeridas
    const tasasCompletas = Boolean(
      tasaTransicion[2] &&
      tasaTransicion[3] &&
      matriculaUltimoGrado[1] &&
      matriculaUltimoGrado[2]
    );

    if (tasasCompletas) {
      metodo = "COHORTES_HISTORICAS";

      // Grado 1 (Nuevo Ingreso): Basado en densidad histórica observada en 1° grado
      const densidadHistG1 = matriculaUltimoGrado[1].grupos > 0
        ? matriculaUltimoGrado[1].total / matriculaUltimoGrado[1].grupos
        : RATIO_SEP_OPTIMO_GRUPO;
      const matG1Ini = Math.round(g1 * Math.max(RATIO_SEP_MIN_GRUPO, Math.min(RATIO_SEP_MAX_GRUPO, densidadHistG1)));

      // Grado 2 (Cohorte de 1° que avanza con tasa de transición derivada)
      const matG2Ini = Math.round(matriculaUltimoGrado[1].total * tasaTransicion[2]);

      // Grado 3 (Cohorte de 2° que avanza con tasa de transición derivada)
      const matG3Ini = Math.round(matriculaUltimoGrado[2].total * tasaTransicion[3]);

      const baseEstimada: Record<number, number> = { 1: matG1Ini, 2: matG2Ini, 3: matG3Ini };

      for (const gradoNum of [1, 2, 3]) {
        const grp = gradoNum === 1 ? g1 : gradoNum === 2 ? g2 : g3;
        let mat = baseEstimada[gradoNum];

        // Si el corte proyectado es FIN_DE_CURSOS, aplicar tasa de deserción real derivada
        if (corteProyectado === "FIN_DE_CURSOS") {
          const tasaDes = tasaDesercionPorGrado[gradoNum] ?? 0.05;
          mat = Math.round(mat * (1 - tasaDes));
        }

        const minG = grp * RATIO_SEP_MIN_GRUPO;
        const maxG = grp * RATIO_SEP_MAX_GRUPO;

        desgloseGrados.push({
          grado: gradoNum,
          gruposAutorizados: grp,
          matriculaEstimada: mat,
          rangoMinimo: minG,
          rangoMaximo: maxG,
          promedioAlumnosPorGrupo: grp > 0 ? Math.round((mat / grp) * 10) / 10 : 0
        });

        totalEstimado += mat;
        totalMin += minG;
        totalMax += maxG;
      }
    } else {
      motivoDegradacion = "Registros históricos con datos incompletos o inconsistentes en desglose por grado";
    }
  }

  // Fallback o método estándar: Capa 1 (Paramétrico Transversal SEP)
  if (metodo === "PARAMETRICO_TRANSVERSAL") {
    desgloseGrados = [];
    totalEstimado = 0;
    totalMin = 0;
    totalMax = 0;

    const factorCorte = corteProyectado === "FIN_DE_CURSOS" ? 0.95 : 1.0;

    for (const gradoNum of [1, 2, 3]) {
      const grp = gradoNum === 1 ? g1 : gradoNum === 2 ? g2 : g3;
      const matOptima = Math.round(grp * RATIO_SEP_OPTIMO_GRUPO * factorCorte);
      const minG = grp * RATIO_SEP_MIN_GRUPO;
      const maxG = grp * RATIO_SEP_MAX_GRUPO;

      desgloseGrados.push({
        grado: gradoNum,
        gruposAutorizados: grp,
        matriculaEstimada: matOptima,
        rangoMinimo: minG,
        rangoMaximo: maxG,
        promedioAlumnosPorGrupo: grp > 0 ? Math.round((matOptima / grp) * 10) / 10 : 0
      });

      totalEstimado += matOptima;
      totalMin += minG;
      totalMax += maxG;
    }
  }

  const densidadPromedio = totalGrupos > 0 ? Math.round((totalEstimado / totalGrupos) * 10) / 10 : 0;
  const gruposRequeridos = Math.ceil(totalEstimado / RATIO_SEP_OPTIMO_GRUPO);
  const docentesRequeridos = Math.ceil(totalGrupos * FACTOR_CARGA_DOCENTE);

  // Clasificación de semáforo operativo
  let semaforo: SemaforoCapacidad = "EQUILIBRADO";
  let observacion = `Plantel operando en equilibrio pedagógico (${densidadPromedio} alumnos/grupo). Plantilla docente balanceada.`;

  if (densidadPromedio > 42) {
    semaforo = "RIESGO_SOBRECUPO";
    observacion = `ALERTA DE SOBRECUPO: Densidad proyectada de ${densidadPromedio} alumnos/grupo excede el estándar SEP. Se recomienda gestionar apertura de grupo adicional o ampliación de aulas.`;
  } else if (densidadPromedio < RATIO_SEP_MIN_GRUPO) {
    semaforo = "RIESGO_SUBUTILIZACION";
    observacion = `ALERTA DE SUBUTILIZACIÓN: Densidad de ${densidadPromedio} alumnos/grupo está por debajo del mínimo normativo (20). Riesgo de observación o compactación de grupos por Corde.`;
  } else if (corteProyectado === "FIN_DE_CURSOS" && totalEstimado < totalGrupos * 23) {
    semaforo = "RIESGO_DESERCION_CRITICA";
    observacion = `ATENCIÓN: Deserción acumulada estimada compromete la viabilidad del turno. Se sugiere seguimiento técnico-pedagógico PAEC / SISAT.`;
  }

  if (motivoDegradacion) {
    observacion += ` [Nota: Proyección calculada mediante Modelo Paramétrico Transversal SEP debido a ${motivoDegradacion.toLowerCase()}].`;
  }

  return {
    escuelaId: escuela.id,
    cct: escuela.cct,
    nombre: escuela.nombre,
    localidad: escuela.localidad,
    municipio: escuela.municipio,
    esProyeccion: true,
    metodoCalculo: metodo,
    corteProyectado,
    matriculaTotalEstimada: totalEstimado,
    intervaloConfianzaMin: totalMin,
    intervaloConfianzaMax: totalMax,
    totalGruposAutorizados: totalGrupos,
    gruposRequeridosOptimos: gruposRequeridos,
    capacidadInstaladaOptima: totalGrupos * RATIO_SEP_OPTIMO_GRUPO,
    densidadPromedioPorGrupo: densidadPromedio,
    docentesEstimadosRequeridos: docentesRequeridos,
    semaforoRiesgo: semaforo,
    observacionOperativa: observacion,
    desgloseGrados,
    fechaCalculo: new Date().toISOString()
  };
}

/**
 * Calcula la proyección zonal consolidada para todas las escuelas del tenant.
 */
export async function calcularProyeccionZonal(
  tenantId: string,
  corteProyectado: "INICIO_DE_CURSOS" | "FIN_DE_CURSOS" = "INICIO_DE_CURSOS"
): Promise<ProyeccionZonal911> {
  // 1. Obtener todas las escuelas reales de la zona
  const escuelas = await prisma.escuela.findMany({
    where: { esSupervision: false, esDePrueba: false },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      cct: true,
      nombre: true,
      localidad: true,
      municipio: true,
      gruposPrimerAno: true,
      gruposSegundoAno: true,
      gruposTercerAno: true,
      hombres: true,
      mujeres: true,
      total: true
    }
  });

  // 2. Obtener registros 911 históricos del tenant si existen
  const registros = await prisma.estadistica911Registro.findMany({
    where: { tenantId },
    include: {
      detalles: true,
      cicloEscolar: true
    }
  });

  // Agrupar registros por escuelaId
  const registrosPorEscuela = new Map<string, typeof registros>();
  for (const r of registros) {
    const list = registrosPorEscuela.get(r.escuelaId) || [];
    list.push(r);
    registrosPorEscuela.set(r.escuelaId, list);
  }

  // 3. Generar proyección por escuela
  const escuelasProyectadas: ProyeccionEscuela911[] = escuelas.map(esc => {
    const hist = registrosPorEscuela.get(esc.id) || [];
    return calcularProyeccionEscuela(esc, hist, corteProyectado);
  });

  // 4. Consolidar totales zonales
  let matZonal = 0;
  let matMin = 0;
  let matMax = 0;
  let grpZonal = 0;
  let docZonal = 0;
  let eq = 0;
  let sob = 0;
  let sub = 0;
  let des = 0;

  for (const p of escuelasProyectadas) {
    matZonal += p.matriculaTotalEstimada;
    matMin += p.intervaloConfianzaMin;
    matMax += p.intervaloConfianzaMax;
    grpZonal += p.totalGruposAutorizados;
    docZonal += p.docentesEstimadosRequeridos;

    if (p.semaforoRiesgo === "EQUILIBRADO") eq++;
    else if (p.semaforoRiesgo === "RIESGO_SOBRECUPO") sob++;
    else if (p.semaforoRiesgo === "RIESGO_SUBUTILIZACION") sub++;
    else if (p.semaforoRiesgo === "RIESGO_DESERCION_CRITICA") des++;
  }

  return {
    tenantId,
    esProyeccion: true,
    corteProyectado,
    totalEscuelasAnalizadas: escuelas.length,
    matriculaZonalEstimada: matZonal,
    matriculaZonalMin: matMin,
    matriculaZonalMax: matMax,
    totalGruposZonales: grpZonal,
    capacidadZonalOptima: grpZonal * RATIO_SEP_OPTIMO_GRUPO,
    docentesZonalesRequeridos: docZonal,
    conteoEquilibradas: eq,
    conteoRiesgoSobrecupo: sob,
    conteoRiesgoSubutilizacion: sub,
    conteoRiesgoDesercion: des,
    escuelas: escuelasProyectadas,
    fechaCalculo: new Date().toISOString()
  };
}
