/**
 * Utilidades para la estructura de grupos por año/grado y asignaturas del MCCEMS
 */

export interface EscuelaEstructuraGrupos {
  gruposPrimerAno: number;   // 1er Año (1º o 2º Semestre)
  gruposSegundoAno: number;  // 2º Año (3º o 4º Semestre)
  gruposTercerAno: number;   // 3er Año (5º o 6º Semestre)
}

export interface GrupoDefinicion {
  id: string;
  nombre: string;         // Ej: "1° A", "3° A", "5° A"
  semestre: number;       // 1, 2, 3, 4, 5, 6
  gradoAno: number;       // 1, 2, 3
  letra: string;          // "A", "B", "C"...
}

const LETRAS_GRUPO = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

/**
 * Genera la lista de grupos oficiales de una escuela basándose en su estructura (ej: 2-1-1)
 * y el periodo de semestres seleccionado ("SEMESTRE_A" = 1,3,5 o "SEMESTRE_B" = 2,4,6)
 */
export function generarGruposPorEstructura(
  escuela: { gruposPrimerAno?: number; gruposSegundoAno?: number; gruposTercerAno?: number },
  periodoSemestral: "SEMESTRE_A" | "SEMESTRE_B" = "SEMESTRE_A"
): GrupoDefinicion[] {
  const g1 = Math.max(1, escuela.gruposPrimerAno ?? 1);
  const g2 = Math.max(1, escuela.gruposSegundoAno ?? 1);
  const g3 = Math.max(1, escuela.gruposTercerAno ?? 1);

  const grupos: GrupoDefinicion[] = [];

  const semestres = periodoSemestral === "SEMESTRE_A" ? [1, 3, 5] : [2, 4, 6];

  // 1er Año (Semestre 1 o 2)
  for (let i = 0; i < g1; i++) {
    const letra = LETRAS_GRUPO[i] || `${i + 1}`;
    const sem = semestres[0];
    grupos.push({
      id: `g-${sem}-${letra}`,
      nombre: `${sem}° ${letra}`,
      semestre: sem,
      gradoAno: 1,
      letra,
    });
  }

  // 2º Año (Semestre 3 o 4)
  for (let i = 0; i < g2; i++) {
    const letra = LETRAS_GRUPO[i] || `${i + 1}`;
    const sem = semestres[1];
    grupos.push({
      id: `g-${sem}-${letra}`,
      nombre: `${sem}° ${letra}`,
      semestre: sem,
      gradoAno: 2,
      letra,
    });
  }

  // 3er Año (Semestre 5 o 6)
  for (let i = 0; i < g3; i++) {
    const letra = LETRAS_GRUPO[i] || `${i + 1}`;
    const sem = semestres[2];
    grupos.push({
      id: `g-${sem}-${letra}`,
      nombre: `${sem}° ${letra}`,
      semestre: sem,
      gradoAno: 3,
      letra,
    });
  }

  return grupos;
}

/**
 * Asignaturas Oficiales del MCCEMS por Semestre (Bachillerato General Estatal Puebla)
 */
export const ASIGNATURAS_MCCEMS_POR_SEMESTRE: Record<number, { nombre: string; tipo: "FUNDAMENTAL" | "LABORAL" | "EXTENDIDO" | "SOCIOEMOCIONAL"; horas: number }[]> = {
  1: [
    { nombre: "La Materia y sus Interacciones", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Pensamiento Matemático I", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Humanidades I", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Lenguaje y Comunicación I", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Inglés I", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Cultura Digital I", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Laboratorio de Investigación", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Ciencias Sociales I", tipo: "FUNDAMENTAL", horas: 2 },
    { nombre: "Actividades Artísticas y Culturales I", tipo: "SOCIOEMOCIONAL", horas: 2 },
    { nombre: "Actividades Físicas y Deportivas I", tipo: "SOCIOEMOCIONAL", horas: 2 },
  ],
  2: [
    { nombre: "Conservación de la Materia y sus Interacciones con la Energía", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Pensamiento Matemático II", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Humanidades II", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Lenguaje y Comunicación II", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Inglés II", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Cultura Digital II", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Ciencias Sociales II", tipo: "FUNDAMENTAL", horas: 2 },
    { nombre: "Actividades Artísticas y Culturales II", tipo: "SOCIOEMOCIONAL", horas: 2 },
    { nombre: "Actividades Físicas y Deportivas II", tipo: "SOCIOEMOCIONAL", horas: 2 },
  ],
  3: [
    { nombre: "Ecosistemas: Interacciones, Energía y Dinámica", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Pensamiento Matemático III", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Humanidades III", tipo: "FUNDAMENTAL", horas: 5 },
    { nombre: "Taller de Ciencias II", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Lengua y Comunicación III", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Inglés III", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Educación para la Salud III (2025)", tipo: "SOCIOEMOCIONAL", horas: 2 },
    { nombre: "Formación Laboral A (Submódulo 1)", tipo: "LABORAL", horas: 3 },
    { nombre: "Formación Laboral B (Submódulo 2)", tipo: "LABORAL", horas: 3 },
  ],
  4: [
    { nombre: "Reacciones Químicas y Procesos Biológicos", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Pensamiento Matemático IV", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Lengua y Comunicación IV", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Inglés IV", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Ciencias Sociales III", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Formación Laboral A (Submódulo 3)", tipo: "LABORAL", horas: 3 },
    { nombre: "Formación Laboral B (Submódulo 4)", tipo: "LABORAL", horas: 3 },
  ],
  5: [
    { nombre: "Física I", tipo: "EXTENDIDO", horas: 4 },
    { nombre: "Cálculo I", tipo: "EXTENDIDO", horas: 4 },
    { nombre: "Historia de México", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Literatura I", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Filosofía", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Inglés V", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Formación Laboral A", tipo: "LABORAL", horas: 3 },
    { nombre: "Formación Laboral B", tipo: "LABORAL", horas: 3 },
    { nombre: "Optativa FFE", tipo: "EXTENDIDO", horas: 3 },
  ],
  6: [
    { nombre: "Física II", tipo: "EXTENDIDO", horas: 4 },
    { nombre: "Cálculo II", tipo: "EXTENDIDO", horas: 4 },
    { nombre: "Historia Universal Contemporánea", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Literatura II", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Ética", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Inglés VI", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Formación Laboral A", tipo: "LABORAL", horas: 3 },
    { nombre: "Formación Laboral B", tipo: "LABORAL", horas: 3 },
    { nombre: "Optativa FFE", tipo: "EXTENDIDO", horas: 3 },
  ]
};
