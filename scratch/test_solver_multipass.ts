import "dotenv/config";
import { resolverHorario } from "../src/lib/horarios/solver";

function testSolver() {
  const grupos = [
    { id: "g1", nombre: "1° A", semestre: 1 },
    { id: "g3", nombre: "3° A", semestre: 3 },
    { id: "g5", nombre: "5° A", semestre: 5 }
  ];

  const docentes = [
    { id: "d_arminda", nombreCompleto: "MARIA ARMINDA CARDENAS" },
    { id: "d_fabian", nombreCompleto: "FABIAN HERNANDEZ" },
    { id: "d_idalia", nombreCompleto: "IDALIA SANCHEZ" },
    { id: "d_oscar", nombreCompleto: "OSCAR ESTEFES" },
    { id: "d_areli", nombreCompleto: "ARELI ESTRADA" },
    { id: "d_angelina", nombreCompleto: "ANGELINA LAZCANO" },
    { id: "d_ulises", nombreCompleto: "ULISES MONTAÑO" },
    { id: "d_omar", nombreCompleto: "OMAR MONTIEL" },
    { id: "d_manuel", nombreCompleto: "MANUEL RUIZ" }
  ];

  const cargas = [
    // 1° A (30 hrs)
    { id: "c1_1", grupoId: "g1", docenteId: "d_arminda", asignaturaId: "mat_int", horasSemanales: 4 },
    { id: "c1_2", grupoId: "g1", docenteId: "d_oscar", asignaturaId: "pens_mat_1", horasSemanales: 4 },
    { id: "c1_3", grupoId: "g1", docenteId: "d_areli", asignaturaId: "hum_1", horasSemanales: 4 },
    { id: "c1_4", grupoId: "g1", docenteId: "d_fabian", asignaturaId: "leng_com_1", horasSemanales: 3 },
    { id: "c1_5", grupoId: "g1", docenteId: "d_angelina", asignaturaId: "ing_1", horasSemanales: 3 },
    { id: "c1_6", grupoId: "g1", docenteId: "d_ulises", asignaturaId: "cult_dig_1", horasSemanales: 3 },
    { id: "c1_7", grupoId: "g1", docenteId: "d_omar", asignaturaId: "lab_inv_1", horasSemanales: 3 },
    { id: "c1_8", grupoId: "g1", docenteId: "d_manuel", asignaturaId: "cs_soc_1", horasSemanales: 2 },
    { id: "c1_9", grupoId: "g1", docenteId: "d_idalia", asignaturaId: "art_cult_1", horasSemanales: 2 },
    { id: "c1_10", grupoId: "g1", docenteId: "d_idalia", asignaturaId: "act_fis_1", horasSemanales: 2 },

    // 3° A (30 hrs)
    { id: "c3_1", grupoId: "g3", docenteId: "d_arminda", asignaturaId: "ecosist", horasSemanales: 4 },
    { id: "c3_2", grupoId: "g3", docenteId: "d_oscar", asignaturaId: "pens_mat_3", horasSemanales: 4 },
    { id: "c3_3", grupoId: "g3", docenteId: "d_areli", asignaturaId: "hum_3", horasSemanales: 5 },
    { id: "c3_4", grupoId: "g3", docenteId: "d_fabian", asignaturaId: "tall_cien_2", horasSemanales: 3 },
    { id: "c3_5", grupoId: "g3", docenteId: "d_angelina", asignaturaId: "salud_3", horasSemanales: 2 },
    { id: "c3_6", grupoId: "g3", docenteId: "d_ulises", asignaturaId: "leng_com_3", horasSemanales: 3 },
    { id: "c3_7", grupoId: "g3", docenteId: "d_omar", asignaturaId: "ing_3", horasSemanales: 3 },
    { id: "c3_8", grupoId: "g3", docenteId: "d_manuel", asignaturaId: "lab_3a", horasSemanales: 3 },
    { id: "c3_9", grupoId: "g3", docenteId: "d_idalia", asignaturaId: "lab_3b", horasSemanales: 3 },

    // 5° A (30 hrs)
    { id: "c5_1", grupoId: "g5", docenteId: "d_arminda", asignaturaId: "energ_vida", horasSemanales: 4 },
    { id: "c5_2", grupoId: "g5", docenteId: "d_oscar", asignaturaId: "conc_hist_2", horasSemanales: 3 },
    { id: "c5_3", grupoId: "g5", docenteId: "d_areli", asignaturaId: "tall_hab_pens", horasSemanales: 3 },
    { id: "c5_4", grupoId: "g5", docenteId: "d_angelina", asignaturaId: "ffe_rec_a", horasSemanales: 3 },
    { id: "c5_5", grupoId: "g5", docenteId: "d_ulises", asignaturaId: "ffe_rec_b", horasSemanales: 3 },
    { id: "c5_6", grupoId: "g5", docenteId: "d_omar", asignaturaId: "ffe_area_a", horasSemanales: 3 },
    { id: "c5_7", grupoId: "g5", docenteId: "d_manuel", asignaturaId: "ffe_area_b", horasSemanales: 3 },
    { id: "c5_8", grupoId: "g5", docenteId: "d_manuel", asignaturaId: "curr_amp_5", horasSemanales: 2 },
    { id: "c5_9", grupoId: "g5", docenteId: "d_idalia", asignaturaId: "lab_5a", horasSemanales: 3 },
    { id: "c5_10", grupoId: "g5", docenteId: "d_idalia", asignaturaId: "lab_5b", horasSemanales: 3 }
  ];

  const resultado = resolverHorario({
    diasLectivos: 5,
    horasPorDia: 6,
    grupos,
    docentes,
    aulas: [{ id: "a1", nombre: "Aula General", tipo: "REGULAR" }],
    cargas
  });

  console.log("=== RESULTADO DEL SOLVER MULTI-PASADA ===");
  console.log("Éxito:", resultado.exito);
  console.log("Total Clases Programadas:", resultado.metricas.totalClasesProgramadas, "/", resultado.metricas.totalClasesRequeridas);
  console.log("Conflictos:", resultado.conflictos);

  const horasPorDocente: Record<string, number> = {};
  resultado.celdas.forEach(c => {
    horasPorDocente[c.docenteId] = (horasPorDocente[c.docenteId] || 0) + 1;
  });

  console.log("=== RESUMEN DE HORAS ASIGNADAS POR DOCENTE ===");
  docentes.forEach(d => {
    const asignadas = horasPorDocente[d.id] || 0;
    const requeridas = cargas.filter(c => c.docenteId === d.id).reduce((sum, c) => sum + c.horasSemanales, 0);
    console.log(`${d.nombreCompleto}: Asignadas ${asignadas}h / Requeridas ${requeridas}h ${asignadas === requeridas ? '✅' : '❌ FALTAN HORAS'}`);
  });

  const horasPorGrupo: Record<string, number> = {};
  resultado.celdas.forEach(c => {
    horasPorGrupo[c.grupoId] = (horasPorGrupo[c.grupoId] || 0) + 1;
  });

  console.log("=== RESUMEN DE HORAS ASIGNADAS POR GRUPO ===");
  grupos.forEach(g => {
    const asignadas = horasPorGrupo[g.id] || 0;
    console.log(`Grupo ${g.nombre}: Asignadas ${asignadas}h / 30h ${asignadas === 30 ? '✅' : '❌ FALTAN HORAS'}`);
  });
}

testSolver();
