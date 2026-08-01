export interface CeldaHorario {
  id?: string;
  diaSemana: number; // 1..5
  periodo: number;   // 1..numHorasPorDia
  grupoId: string;
  docenteId: string;
  asignaturaId?: string;
  aulaId?: string;
  esBloqueado?: boolean;
  grupo?: any;
  docente?: any;
  asignatura?: any;
  aula?: any;
  [key: string]: any;
}

/**
 * Algoritmo de Reordenamiento Inteligente Ripple para Horarios.
 * Intenta mover `celdaAMover` al slot `(targetDia, targetPeriodo)`.
 * Si el movimiento genera colisiones, realiza un reacomodo en cascada (ripple)
 * de las demás clases no bloqueadas (sin candado 🔒).
 * Si es imposible reacomodar sin generar empalmes, no altera el horario y retorna success = false.
 */
export function reacomodarHorarioConRipple(
  celdasOriginales: CeldaHorario[],
  celdaAMover: CeldaHorario,
  targetDia: number,
  targetPeriodo: number,
  numHorasPorDia: number = 6,
  slotsLibresBloqueados: Set<string> = new Set()
): { success: boolean; celdasActualizadas?: CeldaHorario[]; numMovidas?: number; error?: string } {
  if (!celdaAMover) {
    return { success: false, error: "No se especificó la celda a mover." };
  }

  if (celdaAMover.esBloqueado) {
    return { success: false, error: "🔒 Esta celda está fijada con candado. Desbloquéela antes de moverla." };
  }

  if (celdaAMover.diaSemana === targetDia && celdaAMover.periodo === targetPeriodo) {
    return { success: true, celdasActualizadas: celdasOriginales, numMovidas: 0 };
  }

  // Verificar si la casilla destino para el grupo está en las horas libres bloqueadas por el usuario
  const keySlotLibreGrupo = `${targetDia}_${targetPeriodo}_${celdaAMover.grupoId}`;
  if (slotsLibresBloqueados.has(keySlotLibreGrupo)) {
    return { success: false, error: "🔒 La casilla destino está fijada como hora libre." };
  }

  // Clonar las celdas para trabajar sin mutar el arreglo original
  const celdasCopy: CeldaHorario[] = celdasOriginales.map((c) => ({ ...c }));

  // Encontrar el índice de la celda a mover en el clon
  const targetIndex = celdasCopy.findIndex(
    (c) =>
      (c.id && c.id === celdaAMover.id) ||
      (c.diaSemana === celdaAMover.diaSemana &&
        c.periodo === celdaAMover.periodo &&
        c.grupoId === celdaAMover.grupoId &&
        c.docenteId === celdaAMover.docenteId)
  );

  if (targetIndex === -1) {
    return { success: false, error: "No se encontró la celda seleccionada en la matriz." };
  }

  // Fijar la celda seleccionada en las coordenadas destino
  celdasCopy[targetIndex].diaSemana = targetDia;
  celdasCopy[targetIndex].periodo = targetPeriodo;

  // Identificar celdas FIJAS (todas las que tienen esBloqueado === true MÁS la celda recién movida)
  const isFixed = (idx: number) => idx === targetIndex || Boolean(celdasCopy[idx].esBloqueado);

  // Verificar que las celdas FIJAS no tengan choques entre sí en el destino
  for (let i = 0; i < celdasCopy.length; i++) {
    if (!isFixed(i)) continue;
    const c1 = celdasCopy[i];

    // Verificar si alguna celda fija coincide con slots libres bloqueados
    if (slotsLibresBloqueados.has(`${c1.diaSemana}_${c1.periodo}_${c1.grupoId}`)) {
      return { success: false, error: "🔒 El movimiento colisiona con una hora libre bloqueada." };
    }

    for (let j = i + 1; j < celdasCopy.length; j++) {
      if (!isFixed(j)) continue;
      const c2 = celdasCopy[j];

      if (c1.diaSemana === c2.diaSemana && c1.periodo === c2.periodo) {
        // Mismo grupo en la misma hora
        if (c1.grupoId === c2.grupoId) {
          return { success: false, error: "🔒 Casilla ocupada por una clase fijada con candado." };
        }
        // Mismo docente en el mismo periodo
        if (c1.docenteId === c2.docenteId) {
          const docNombre = c1.docente?.nombre || "el docente";
          return { success: false, error: `🔒 El docente ${docNombre} tiene otra clase fijada con candado en esta hora.` };
        }
      }
    }
  }

  // Extraer los índices de las celdas que se pueden REUBICAR (no fijas)
  const unfixedIndices: number[] = [];
  for (let i = 0; i < celdasCopy.length; i++) {
    if (!isFixed(i)) {
      unfixedIndices.push(i);
    }
  }

  // Si no hay otras celdas desprotegidas, verificar si las fijas están libres de conflicto
  if (unfixedIndices.length === 0) {
    return { success: true, celdasActualizadas: celdasCopy, numMovidas: 1 };
  }

  // Para optimizar el backtracking, ordenamos los elementos no fijos priorizando las celdas
  // que estaban en el slot destino o que pertenecen al grupo/docente de la celda movida
  unfixedIndices.sort((a, b) => {
    const ca = celdasCopy[a];
    const cb = celdasCopy[b];

    const scoreA =
      (ca.grupoId === celdaAMover.grupoId ? 10 : 0) +
      (ca.docenteId === celdaAMover.docenteId ? 10 : 0) +
      (ca.diaSemana === targetDia && ca.periodo === targetPeriodo ? 20 : 0);

    const scoreB =
      (cb.grupoId === celdaAMover.grupoId ? 10 : 0) +
      (cb.docenteId === celdaAMover.docenteId ? 10 : 0) +
      (cb.diaSemana === targetDia && cb.periodo === targetPeriodo ? 20 : 0);

    return scoreB - scoreA;
  });

  // Generar lista de todas las coordenadas de tiempo válidas (5 días x numHorasPorDia)
  const todosLosSlots: { dia: number; periodo: number }[] = [];
  for (let d = 1; d <= 5; d++) {
    for (let p = 1; p <= numHorasPorDia; p++) {
      todosLosSlots.push({ dia: d, periodo: p });
    }
  }

  // Pre-ordenar candidatos por cercanía a la posición original del elemento
  const obtenerSlotsOrdenados = (celda: CeldaHorario) => {
    return [...todosLosSlots].sort((s1, s2) => {
      // Priorizar la posición donde estaba originalmente la celda
      if (s1.dia === celda.diaSemana && s1.periodo === celda.periodo) return -1;
      if (s2.dia === celda.diaSemana && s2.periodo === celda.periodo) return 1;

      // Priorizar el slot que dejó libre la celda arrastrada (diaOrigen, periodoOrigen)
      if (s1.dia === celdaAMover.diaSemana && s1.periodo === celdaAMover.periodo) return -1;
      if (s2.dia === celdaAMover.diaSemana && s2.periodo === celdaAMover.periodo) return 1;

      return 0;
    });
  };

  // Matriz de ocupación por grupo y por docente para validaciones en O(1)
  const ocupadoGrupo = new Set<string>(); // "dia_periodo_grupoId"
  const ocupadoDocente = new Set<string>(); // "dia_periodo_docenteId"
  const ocupadoAula = new Set<string>(); // "dia_periodo_aulaId"

  // Registrar celdas fijas en la matriz de ocupación
  for (let i = 0; i < celdasCopy.length; i++) {
    if (isFixed(i)) {
      const c = celdasCopy[i];
      ocupadoGrupo.add(`${c.diaSemana}_${c.periodo}_${c.grupoId}`);
      ocupadoDocente.add(`${c.diaSemana}_${c.periodo}_${c.docenteId}`);
      if (c.aulaId) ocupadoAula.add(`${c.diaSemana}_${c.periodo}_${c.aulaId}`);
    }
  }

  // Función de Backtracking Recursivo
  let maxNodos = 50000;
  let nodosVisitados = 0;

  function resolverBacktracking(uIdx: number): boolean {
    if (uIdx >= unfixedIndices.length) {
      return true; // ¡Todas las celdas se asignaron sin empalmes!
    }

    nodosVisitados++;
    if (nodosVisitados > maxNodos) {
      return false; // Límite de búsqueda alcanzado
    }

    const celdaIndex = unfixedIndices[uIdx];
    const celda = celdasCopy[celdaIndex];
    const candidateSlots = obtenerSlotsOrdenados(celda);

    for (const slot of candidateSlots) {
      const d = slot.dia;
      const p = slot.periodo;

      const keyGrp = `${d}_${p}_${celda.grupoId}`;
      const keyDoc = `${d}_${p}_${celda.docenteId}`;
      const keyAula = celda.aulaId ? `${d}_${p}_${celda.aulaId}` : null;

      // Validar si el slot está libre para el grupo
      if (ocupadoGrupo.has(keyGrp)) continue;

      // Validar si la casilla destino está en slots libres bloqueados
      if (slotsLibresBloqueados.has(keyGrp)) continue;

      // Validar si el docente ya está dando clase a otro grupo en este periodo
      if (ocupadoDocente.has(keyDoc)) continue;

      // Validar si el aula está ocupada
      if (keyAula && ocupadoAula.has(keyAula)) continue;

      // Asignar temporalmente
      celdasCopy[celdaIndex].diaSemana = d;
      celdasCopy[celdaIndex].periodo = p;
      ocupadoGrupo.add(keyGrp);
      ocupadoDocente.add(keyDoc);
      if (keyAula) ocupadoAula.add(keyAula);

      if (resolverBacktracking(uIdx + 1)) {
        return true;
      }

      // Revertir asignación
      ocupadoGrupo.delete(keyGrp);
      ocupadoDocente.delete(keyDoc);
      if (keyAula) ocupadoAula.delete(keyAula);
    }

    return false;
  }

  const exito = resolverBacktracking(0);

  if (!exito) {
    return {
      success: false,
      error: "⚠️ No es posible realizar este movimiento porque generaría una colisión de horarios imposible de resolver sin afectar clases fijadas con candado."
    };
  }

  // Contar cuántas celdas cambiaron de posición
  let numMovidas = 0;
  for (let i = 0; i < celdasOriginales.length; i++) {
    const orig = celdasOriginales[i];
    const act = celdasCopy.find(
      (c) =>
        (c.id && c.id === orig.id) ||
        (c.grupoId === orig.grupoId && c.docenteId === orig.docenteId && c.asignaturaId === orig.asignaturaId)
    );

    if (act && (act.diaSemana !== orig.diaSemana || act.periodo !== orig.periodo)) {
      numMovidas++;
    }
  }

  return {
    success: true,
    celdasActualizadas: celdasCopy,
    numMovidas: Math.max(numMovidas, 1)
  };
}
