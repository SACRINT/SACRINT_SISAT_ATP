/**
 * Catálogo de Categorías y Disciplinas para Eventos Culturales PAEC 2026
 * Extraído de generar_excel_2026.py
 * 
 * Tipos de disciplina:
 *   - "simple":     Solo Sí/No, 1 participante fijo (ej. Declamación)
 *   - "grupo":      Sí/No + input numérico con min/max (ej. Baile Trad.)
 *   - "individual": Parte de un par exclusivo, fija participantes al min (ej. Canto Solista)
 *   - "equipo":     Parte de un par exclusivo, habilita input numérico (ej. Canto Dueto)
 * 
 * grupoExclusion: Las disciplinas con el mismo valor son mutuamente excluyentes.
 */

export interface DisciplinaSeed {
    nombre: string;
    tipo: "simple" | "individual" | "equipo" | "grupo";
    minParticipantes: number;
    maxParticipantes: number;
    grupoExclusion?: string;
    orden: number;
}

export interface CategoriaSeed {
    nombre: string;
    color: string;
    orden: number;
    disciplinas: DisciplinaSeed[];
}

export const CATEGORIAS_EVENTOS_2026: CategoriaSeed[] = [
    {
        nombre: "Arte y Cultura",
        color: "#2e75b6",
        orden: 1,
        disciplinas: [
            // Baile Tradicional: grupo con rango 8-16
            { nombre: "Baile Tradicional", tipo: "grupo", minParticipantes: 8, maxParticipantes: 16, orden: 1 },
            // Danza Tradicional: grupo con rango 4-16
            { nombre: "Danza Tradicional", tipo: "grupo", minParticipantes: 4, maxParticipantes: 16, orden: 2 },
            // Canto: individual/equipo (solista=1, dueto=2)
            { nombre: "Canto - Solista", tipo: "individual", minParticipantes: 1, maxParticipantes: 1, grupoExclusion: "canto", orden: 3 },
            { nombre: "Canto - Dueto", tipo: "equipo", minParticipantes: 2, maxParticipantes: 2, grupoExclusion: "canto", orden: 4 },
            // Cómic: individual/equipo (1 ó 2-3)
            { nombre: "Cómic - Individual", tipo: "individual", minParticipantes: 1, maxParticipantes: 1, grupoExclusion: "comic", orden: 5 },
            { nombre: "Cómic - Equipo", tipo: "equipo", minParticipantes: 2, maxParticipantes: 3, grupoExclusion: "comic", orden: 6 },
            // Fotografía: individual/equipo (1 ó 2-3)
            { nombre: "Fotografía - Individual", tipo: "individual", minParticipantes: 1, maxParticipantes: 1, grupoExclusion: "fotografia", orden: 7 },
            { nombre: "Fotografía - Equipo", tipo: "equipo", minParticipantes: 2, maxParticipantes: 3, grupoExclusion: "fotografia", orden: 8 },
            // TikTok: individual/equipo (1 ó 2-3)
            { nombre: "TikTok - Individual", tipo: "individual", minParticipantes: 1, maxParticipantes: 1, grupoExclusion: "tiktok", orden: 9 },
            { nombre: "TikTok - Equipo", tipo: "equipo", minParticipantes: 2, maxParticipantes: 3, grupoExclusion: "tiktok", orden: 10 },
            // Teatro: grupo con rango 1-10
            { nombre: "Teatro", tipo: "grupo", minParticipantes: 1, maxParticipantes: 10, orden: 11 },
        ],
    },
    {
        nombre: "Humanidades y Comunicación",
        color: "#548235",
        orden: 2,
        disciplinas: [
            { nombre: "Declamación", tipo: "simple", minParticipantes: 1, maxParticipantes: 1, orden: 1 },
            { nombre: "Filosofía", tipo: "simple", minParticipantes: 1, maxParticipantes: 1, orden: 2 },
            { nombre: "Oratoria / Ensayo", tipo: "simple", minParticipantes: 1, maxParticipantes: 1, orden: 3 },
            { nombre: "Spelling Bee - A1", tipo: "simple", minParticipantes: 1, maxParticipantes: 1, orden: 4 },
            { nombre: "Spelling Bee - A2", tipo: "simple", minParticipantes: 1, maxParticipantes: 1, orden: 5 },
            { nombre: "Spelling Bee - B1", tipo: "simple", minParticipantes: 1, maxParticipantes: 1, orden: 6 },
        ],
    },
    {
        nombre: "Ciencia y Tecnología",
        color: "#bf8f00",
        orden: 3,
        disciplinas: [
            { nombre: "Encuentro de Ciencias", tipo: "grupo", minParticipantes: 2, maxParticipantes: 4, orden: 1 },
            { nombre: "Encuentro de Matemáticas", tipo: "grupo", minParticipantes: 2, maxParticipantes: 4, orden: 2 },
            { nombre: "Encuentro de Física", tipo: "grupo", minParticipantes: 2, maxParticipantes: 4, orden: 3 },
            { nombre: "Encuentro de Química", tipo: "grupo", minParticipantes: 2, maxParticipantes: 4, orden: 4 },
            { nombre: "Sabores Comunitarios", tipo: "grupo", minParticipantes: 2, maxParticipantes: 4, orden: 5 },
        ],
    },
    {
        nombre: "Tech-Desafíos",
        color: "#c00000",
        orden: 4,
        disciplinas: [
            { nombre: "Fotomontaje - Individual", tipo: "individual", minParticipantes: 1, maxParticipantes: 1, grupoExclusion: "fotomontaje", orden: 1 },
            { nombre: "Fotomontaje - Equipo", tipo: "equipo", minParticipantes: 2, maxParticipantes: 3, grupoExclusion: "fotomontaje", orden: 2 },
            { nombre: "Humor - Individual", tipo: "individual", minParticipantes: 1, maxParticipantes: 1, grupoExclusion: "humor", orden: 3 },
            { nombre: "Humor - Equipo", tipo: "equipo", minParticipantes: 2, maxParticipantes: 3, grupoExclusion: "humor", orden: 4 },
            { nombre: "Música IA - Individual", tipo: "individual", minParticipantes: 1, maxParticipantes: 1, grupoExclusion: "musica_ia", orden: 5 },
            { nombre: "Música IA - Equipo", tipo: "equipo", minParticipantes: 2, maxParticipantes: 3, grupoExclusion: "musica_ia", orden: 6 },
            { nombre: "Ritmo - Individual", tipo: "individual", minParticipantes: 1, maxParticipantes: 1, grupoExclusion: "ritmo", orden: 7 },
            { nombre: "Ritmo - Equipo", tipo: "equipo", minParticipantes: 2, maxParticipantes: 3, grupoExclusion: "ritmo", orden: 8 },
        ],
    },
    {
        nombre: "Eventos Externos",
        color: "#7030a0",
        orden: 5,
        disciplinas: [
            { nombre: "Olimpiada de Matemáticas", tipo: "simple", minParticipantes: 1, maxParticipantes: 1, orden: 1 },
            { nombre: "Encuentro PAEC", tipo: "grupo", minParticipantes: 2, maxParticipantes: 20, orden: 2 },
        ],
    },
];
