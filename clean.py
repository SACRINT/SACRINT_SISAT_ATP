import re

with open('src/app/admin/_componentes/GestionEscuelas.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove tabEscuelas === 'programas_modulos' block
content = re.sub(r'\{tabEscuelas === "programas_modulos" \? \(.*?\)\s*:\s*null\}', '', content, flags=re.DOTALL)

# 2. Remove the tab button for programas_modulos
content = re.sub(r'<button\s+className=\{`tab-item \$\{tabEscuelas === "programas_modulos" \? "active" : ""\}`\}\s+onClick=\{.*?>\s*<Settings2 size=\{18\} /> ⚙️ Programas y Módulos por Escuela\s*</button>', '', content, flags=re.DOTALL)

# 3. Remove 'programas_modulos' from the type definition of tabEscuelas
content = re.sub(r'"escuelas" \| "programas_modulos" \| "supervision"', '"escuelas" | "supervision"', content)

# 4. Remove `horarioStats` state
content = re.sub(r'\s*// Stats de uso de Horarios IA por escuela \(cargadas desde la API\)\s*const \[horarioStats, setHorarioStats\] = useState<Record<string, \{ totalMensajesChat: number; totalUsos: number; ultimoUso: string \| null \}\>>\(\{\}\);', '', content, flags=re.DOTALL)

# 5. Remove handlers
# handleToggleHorariosEscuela
content = re.sub(r'\s*// Handlers para toggle individual y global de Horarios IA y Programas por Escuela\s*const handleToggleHorariosEscuela = async.*?};', '', content, flags=re.DOTALL)

# cargarHorarioStats
content = re.sub(r'\s*// Cargar stats de uso de Horarios IA al entrar a la pestaña de programas/módulos\s*const cargarHorarioStats = async \(\) => \{.*?catch \{ /\* silencioso \*/ \}\s*\};\s*', '', content, flags=re.DOTALL)

# handleResetStats
content = re.sub(r'\s*// Reiniciar contador de una escuela \(solo admin\)\s*const handleResetStats = async \(escuelaId: string, nombre: string\) => \{.*?catch \{\s*toast\.error\("Error de conexión al reiniciar contador"\);\s*\}\s*\};\s*', '', content, flags=re.DOTALL)

# handleToggleGlobalHorarios
content = re.sub(r'\s*const handleToggleGlobalHorarios = async \(desactivado: boolean\) => \{.*?\};\s*', '', content, flags=re.DOTALL)

# handleToggleProgramaEscuela
content = re.sub(r'\s*const handleToggleProgramaEscuela = async \(escuelaId: string, programaId: string, activar: boolean\) => \{.*?\};\s*', '', content, flags=re.DOTALL)

# handleAccionMasivaPermisos
content = re.sub(r'\s*const handleAccionMasivaPermisos = async \(tipo: "HORARIOS_IA" \| "PLANEACIONES_IA" \| "PROGRAMA", accion: "ACTIVAR_TODOS" \| "DESACTIVAR_TODOS", programaNombre\?: string\) => \{.*?\};\s*', '', content, flags=re.DOTALL)

# handleTogglePlaneacionesEscuela
content = re.sub(r'\s*const handleTogglePlaneacionesEscuela = async \(escuelaId: string, actualmenteDesactivado: boolean\) => \{.*?\};\s*', '', content, flags=re.DOTALL)

with open('src/app/admin/_componentes/GestionEscuelas.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
