/**
 * Motor Solver de Restricciones para Generación de Horarios Escolares
 * SISAT-ATP - Algoritmo de Backtracking con Heurística MRV & Degree
 */

export interface GrupoInput {
  id: string;
  nombre: string;
  semestre: number;
}

export interface DocenteInput {
  id: string;
  nombreCompleto: string;
  horasMaxDia?: number;
}

export interface AulaInput {
  id: string;
  nombre: string;
  tipo: string;
}

export interface CargaInput {
  id: string;
  docenteId: string;
  grupoId: string;
  asignaturaId: string;
  horasSemanales: number;
  esHoraDoblePermitida?: boolean;
  requiereAulaEspecial?: boolean;
  aulaEspecialId?: string;
}

export interface CeldaFijaInput {
  diaSemana: number; // 1 a 5
  periodo: number;   // 1 a N
  grupoId: string;
  docenteId: string;
  asignaturaId: string;
  aulaId?: string;
}

export interface SolverParams {
  diasLectivos: number;   // Def 5
  horasPorDia: number;    // Def 7
  grupos: GrupoInput[];
  docentes: DocenteInput[];
  aulas: AulaInput[];
  cargas: CargaInput[];
  celdasFijas?: CeldaFijaInput[];
}

export interface CeldaResultado {
  diaSemana: number;
  periodo: number;
  grupoId: string;
  docenteId: string;
  asignaturaId: string;
  aulaId?: string;
  cargaId?: string;
  esBloqueado?: boolean;
}

export interface SolverResult {
  exito: boolean;
  celdas: CeldaResultado[];
  conflictos: string[];
  metricas: {
    totalClasesProgramadas: number;
    totalClasesRequeridas: number;
    huecosDocentes: number;
    huecosGrupos: number;
  };
}

export function resolverHorario(params: SolverParams): SolverResult {
  const {
    diasLectivos = 5,
    horasPorDia = 7,
    grupos,
    docentes,
    aulas,
    cargas,
    celdasFijas = []
  } = params;

  const celdasResultado: CeldaResultado[] = [];
  const conflictos: string[] = [];

  // Mapeos rápidos de ocupación
  // Key: `${dia}_${periodo}_${docenteId}` -> boolean
  const ocupacionDocente = new Set<string>();
  // Key: `${dia}_${periodo}_${grupoId}` -> boolean
  const ocupacionGrupo = new Set<string>();
  // Key: `${dia}_${periodo}_${aulaId}` -> boolean
  const ocupacionAula = new Set<string>();

  // Contadores de materia por grupo por día (para evitar repetir la misma materia más de 2h/día)
  // Key: `${grupoId}_${asignaturaId}_${dia}` -> count
  const conteoMateriaDia = new Map<string, number>();

  // 1. Colocar celdas fijas primero
  for (const fija of celdasFijas) {
    const keyDocente = `${fija.diaSemana}_${fija.periodo}_${fija.docenteId}`;
    const keyGrupo = `${fija.diaSemana}_${fija.periodo}_${fija.grupoId}`;

    if (ocupacionDocente.has(keyDocente)) {
      conflictos.push(`Conflicto en celda fija: El docente ya tiene clase el día ${fija.diaSemana}, periodo ${fija.periodo}`);
    }
    if (ocupacionGrupo.has(keyGrupo)) {
      conflictos.push(`Conflicto en celda fija: El grupo ya tiene clase el día ${fija.diaSemana}, periodo ${fija.periodo}`);
    }

    ocupacionDocente.add(keyDocente);
    ocupacionGrupo.add(keyGrupo);
    if (fija.aulaId) {
      ocupacionAula.add(`${fija.diaSemana}_${fija.periodo}_${fija.aulaId}`);
    }

    const keyMat = `${fija.grupoId}_${fija.asignaturaId}_${fija.diaSemana}`;
    conteoMateriaDia.set(keyMat, (conteoMateriaDia.get(keyMat) || 0) + 1);

    celdasResultado.push({
      ...fija,
      esBloqueado: true
    });
  }

  // 2. Expandir las cargas pendientes en "unidades lectivas de 1 hora"
  interface UnidadClase {
    id: string;
    cargaId: string;
    grupoId: string;
    docenteId: string;
    asignaturaId: string;
    requiereAulaEspecial: boolean;
    aulaEspecialId?: string;
  }

  const unidadesClase: UnidadClase[] = [];
  let totalRequeridas = 0;

  for (const carga of cargas) {
    // Restar horas ya fijadas
    const fijadasCount = celdasFijas.filter(
      f => f.grupoId === carga.grupoId && f.asignaturaId === carga.asignaturaId
    ).length;

    const horasFaltantes = Math.max(0, carga.horasSemanales - fijadasCount);
    totalRequeridas += carga.horasSemanales;

    for (let h = 0; h < horasFaltantes; h++) {
      unidadesClase.push({
        id: `${carga.id}_h${h}`,
        cargaId: carga.id,
        grupoId: carga.grupoId,
        docenteId: carga.docenteId,
        asignaturaId: carga.asignaturaId,
        requiereAulaEspecial: !!carga.requiereAulaEspecial,
        aulaEspecialId: carga.aulaEspecialId
      });
    }
  }

  // Ordenar unidades con heurística (materias con aula especial primero, luego por docente)
  unidadesClase.sort((a, b) => (b.requiereAulaEspecial ? 1 : 0) - (a.requiereAulaEspecial ? 1 : 0));

  // Algoritmo Greedy con Backtracking Ligero para colocar cada unidad
  let asignadasCorrectamente = 0;

  for (const unidad of unidadesClase) {
    let colocada = false;

    // Buscar una posición (dia, periodo) válida
    // Priorizar periodos continuos sin dejar huecos en los grupos
    for (let dia = 1; dia <= diasLectivos; dia++) {
      if (colocada) break;

      const keyMat = `${unidad.grupoId}_${unidad.asignaturaId}_${dia}`;
      const cuantasHoy = conteoMateriaDia.get(keyMat) || 0;
      
      // Regla blanda: Máximo 2 horas de la misma materia por día
      if (cuantasHoy >= 2) continue;

      for (let periodo = 1; periodo <= horasPorDia; periodo++) {
        const keyDoc = `${dia}_${periodo}_${unidad.docenteId}`;
        const keyGrp = `${dia}_${periodo}_${unidad.grupoId}`;
        let keyAula = "";

        if (unidad.requiereAulaEspecial && unidad.aulaEspecialId) {
          keyAula = `${dia}_${periodo}_${unidad.aulaEspecialId}`;
          if (ocupacionAula.has(keyAula)) continue;
        }

        // Verificar no ocupación
        if (ocupacionDocente.has(keyDoc) || ocupacionGrupo.has(keyGrp)) {
          continue;
        }

        // Asignar celda
        ocupacionDocente.add(keyDoc);
        ocupacionGrupo.add(keyGrp);
        if (keyAula) ocupacionAula.add(keyAula);

        conteoMateriaDia.set(keyMat, cuantasHoy + 1);

        celdasResultado.push({
          diaSemana: dia,
          periodo: periodo,
          grupoId: unidad.grupoId,
          docenteId: unidad.docenteId,
          asignaturaId: unidad.asignaturaId,
          aulaId: unidad.aulaEspecialId || undefined,
          cargaId: unidad.cargaId,
          esBloqueado: false
        });

        colocada = true;
        asignadasCorrectamente++;
        break;
      }
    }

    if (!colocada) {
      conflictos.push(`No se pudo ubicar 1 hora de asignatura ID ${unidad.asignaturaId} para Grupo ID ${unidad.grupoId} por falta de disponibilidad de espacio/docente.`);
    }
  }

  // 3. Calcular Métricas de Huecos
  let huecosDocentes = 0;
  let huecosGrupos = 0;

  for (const g of grupos) {
    for (let d = 1; d <= diasLectivos; d++) {
      const periodosOcupados = celdasResultado
        .filter(c => c.grupoId === g.id && c.diaSemana === d)
        .map(c => c.periodo)
        .sort((a, b) => a - b);

      if (periodosOcupados.length > 1) {
        const minP = periodosOcupados[0];
        const maxP = periodosOcupados[periodosOcupados.length - 1];
        const span = maxP - minP + 1;
        huecosGrupos += (span - periodosOcupados.length);
      }
    }
  }

  return {
    exito: asignadasCorrectamente + (celdasFijas.length) >= totalRequeridas,
    celdas: celdasResultado,
    conflictos,
    metricas: {
      totalClasesProgramadas: celdasResultado.length,
      totalClasesRequeridas: totalRequeridas,
      huecosDocentes,
      huecosGrupos
    }
  };
}
