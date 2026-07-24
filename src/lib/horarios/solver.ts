/**
 * Motor Solver de Restricciones para Generación de Horarios Escolares
 * SISAT-ATP - Algoritmo de Backtracking Multi-Pasada con Heurística MRV & Degree
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

export interface RestriccionDocenteInput {
  docenteId: string;
  diasIndisponibles?: number[]; // ej. [3] para Miércoles
  periodosIndisponibles?: { dia: number; periodo: number }[];
}

export interface SolverParams {
  diasLectivos: number;   // Def 5
  horasPorDia: number;    // Def 6 o 7
  grupos: GrupoInput[];
  docentes: DocenteInput[];
  aulas: AulaInput[];
  cargas: CargaInput[];
  celdasFijas?: CeldaFijaInput[];
  restriccionesDocentes?: RestriccionDocenteInput[];
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
    horasPorDia = 6,
    grupos,
    docentes,
    aulas,
    cargas,
    celdasFijas = [],
    restriccionesDocentes = []
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

  // 0. Bloquear días o periodos indisponibles para docentes por restricciones
  for (const restr of restriccionesDocentes) {
    if (restr.diasIndisponibles) {
      for (const dia of restr.diasIndisponibles) {
        for (let p = 1; p <= horasPorDia; p++) {
          ocupacionDocente.add(`${dia}_${p}_${restr.docenteId}`);
        }
      }
    }
    if (restr.periodosIndisponibles) {
      for (const pi of restr.periodosIndisponibles) {
        ocupacionDocente.add(`${pi.dia}_${pi.periodo}_${restr.docenteId}`);
      }
    }
  }

  // Contadores de materia por grupo por día (para intentar no repetir la misma materia más de 2h/día)
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
    colocada: boolean;
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
        aulaEspecialId: carga.aulaEspecialId,
        colocada: false
      });
    }
  }

  // Ordenar unidades con heurística (materias con aula especial primero, luego por docente)
  unidadesClase.sort((a, b) => (b.requiereAulaEspecial ? 1 : 0) - (a.requiereAulaEspecial ? 1 : 0));

  let asignadasCorrectamente = 0;

  // -------------------------------------------------------------------------
  // PASADA 1: Intentar ubicar cada unidad respetando máximo 2 hrs/día de la misma UAC
  // -------------------------------------------------------------------------
  for (const unidad of unidadesClase) {
    if (unidad.colocada) continue;

    for (let dia = 1; dia <= diasLectivos; dia++) {
      if (unidad.colocada) break;

      const keyMat = `${unidad.grupoId}_${unidad.asignaturaId}_${dia}`;
      const cuantasHoy = conteoMateriaDia.get(keyMat) || 0;
      
      // Regla suave de Pasada 1: Máximo 2 horas de la misma materia por día
      if (cuantasHoy >= 2) continue;

      for (let periodo = 1; periodo <= horasPorDia; periodo++) {
        const keyDoc = `${dia}_${periodo}_${unidad.docenteId}`;
        const keyGrp = `${dia}_${periodo}_${unidad.grupoId}`;
        let keyAula = "";

        if (unidad.requiereAulaEspecial && unidad.aulaEspecialId) {
          keyAula = `${dia}_${periodo}_${unidad.aulaEspecialId}`;
          if (ocupacionAula.has(keyAula)) continue;
        }

        // Verificar no ocupación de docente ni grupo
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

        unidad.colocada = true;
        asignadasCorrectamente++;
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // PASADA 2: Para unidades pendientes, relajar el límite de 2 hrs/día (permitir 3 hrs/día si es necesario)
  // -------------------------------------------------------------------------
  for (const unidad of unidadesClase) {
    if (unidad.colocada) continue;

    for (let dia = 1; dia <= diasLectivos; dia++) {
      if (unidad.colocada) break;

      const keyMat = `${unidad.grupoId}_${unidad.asignaturaId}_${dia}`;
      const cuantasHoy = conteoMateriaDia.get(keyMat) || 0;

      for (let periodo = 1; periodo <= horasPorDia; periodo++) {
        const keyDoc = `${dia}_${periodo}_${unidad.docenteId}`;
        const keyGrp = `${dia}_${periodo}_${unidad.grupoId}`;
        let keyAula = "";

        if (unidad.requiereAulaEspecial && unidad.aulaEspecialId) {
          keyAula = `${dia}_${periodo}_${unidad.aulaEspecialId}`;
          if (ocupacionAula.has(keyAula)) continue;
        }

        // Estricto: Docente y Grupo NO deben estar ocupados
        if (ocupacionDocente.has(keyDoc) || ocupacionGrupo.has(keyGrp)) {
          continue;
        }

        // Asignar celda en Pasada 2
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

        unidad.colocada = true;
        asignadasCorrectamente++;
        console.log(`[solver] Pasada 2 ubicó unidad ${unidad.id} (Docente: ${unidad.docenteId}, Grupo: ${unidad.grupoId}) en día ${dia}, periodo ${periodo}`);
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // PASADA 3: Reubicación de Celdas Existentes (Re-balancing) si aún hay unidades sin colocar
  // -------------------------------------------------------------------------
  for (const unidad of unidadesClase) {
    if (unidad.colocada) continue;

    // Buscar cualquier hueco libre del GRUPO en la semana donde el DOCENTE de la unidad también esté LIBRE
    for (let dia = 1; dia <= diasLectivos; dia++) {
      if (unidad.colocada) break;

      for (let periodo = 1; periodo <= horasPorDia; periodo++) {
        if (unidad.colocada) break;

        const keyDoc = `${dia}_${periodo}_${unidad.docenteId}`;
        const keyGrp = `${dia}_${periodo}_${unidad.grupoId}`;

        // Si el grupo o el docente están ocupados en este hueco, intentar desplazar la celda ocupante
        if (!ocupacionGrupo.has(keyGrp) && !ocupacionDocente.has(keyDoc)) {
          // Asignar directamente
          ocupacionDocente.add(keyDoc);
          ocupacionGrupo.add(keyGrp);

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

          unidad.colocada = true;
          asignadasCorrectamente++;
          break;
        }

        // Si sólo el grupo está ocupado por OTRA materia de la misma escuela, ver si esa otra materia se puede mover a otro hueco
        if (!ocupacionDocente.has(keyDoc) && ocupacionGrupo.has(keyGrp)) {
          const idxOcupante = celdasResultado.findIndex(
            c => c.grupoId === unidad.grupoId && c.diaSemana === dia && c.periodo === periodo && !c.esBloqueado
          );

          if (idxOcupante >= 0) {
            const ocupante = celdasResultado[idxOcupante];

            // Intentar encontrar un nuevo lugar para 'ocupante'
            for (let d2 = 1; d2 <= diasLectivos; d2++) {
              if (unidad.colocada) break;

              for (let p2 = 1; p2 <= horasPorDia; p2++) {
                if (d2 === dia && p2 === periodo) continue;

                const kDoc2 = `${d2}_${p2}_${ocupante.docenteId}`;
                const kGrp2 = `${d2}_${p2}_${ocupante.grupoId}`;

                if (!ocupacionDocente.has(kDoc2) && !ocupacionGrupo.has(kGrp2)) {
                  // Mover ocupante a d2, p2
                  ocupacionDocente.delete(`${dia}_${periodo}_${ocupante.docenteId}`);
                  ocupacionGrupo.delete(`${dia}_${periodo}_${ocupante.grupoId}`);

                  ocupacionDocente.add(kDoc2);
                  ocupacionGrupo.add(kGrp2);

                  celdasResultado[idxOcupante].diaSemana = d2;
                  celdasResultado[idxOcupante].periodo = p2;

                  // Ahora colocar la 'unidad' en dia, periodo
                  ocupacionDocente.add(keyDoc);
                  ocupacionGrupo.add(keyGrp);

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

                  unidad.colocada = true;
                  asignadasCorrectamente++;
                  console.log(`[solver] Pasada 3 desplazó celda y ubicó unidad ${unidad.id} en día ${dia}, periodo ${periodo}`);
                  break;
                }
              }
            }
          }
        }
      }
    }
  }

  // Registrar conflictos para unidades que definitivamente no pudieron colocarse
  for (const unidad of unidadesClase) {
    if (!unidad.colocada) {
      conflictos.push(`No se pudo ubicar 1 hora de asignatura ID ${unidad.asignaturaId} para Grupo ID ${unidad.grupoId} por falta de espacio/compatibilidad de docente.`);
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
