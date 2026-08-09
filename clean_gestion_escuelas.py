import re

file_path = "C:/NotebookLM/sisat-atp/src/app/admin/_componentes/GestionEscuelas.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove from lucide-react imports
content = re.sub(r',\s*RefreshCw', '', content)
content = re.sub(r',\s*Settings2', '', content)

# 2. Change tabEscuelas definition
content = re.sub(
    r'const \[tabEscuelas, setTabEscuelas\] = useState<"escuelas" \| "programas_modulos" \| "supervision">',
    r'const [tabEscuelas, setTabEscuelas] = useState<"escuelas" | "supervision">',
    content
)

# 3. Remove horarioStats state
content = re.sub(
    r'\s*// Stats de uso de Horarios IA por escuela.*?const \[horarioStats, setHorarioStats\] = useState<Record<string, { totalMensajesChat: number; totalUsos: number; ultimoUso: string \| null }>>\({}\);\n',
    '\n',
    content,
    flags=re.DOTALL
)

# 4. Remove all matrix handlers
# handleToggleHorariosEscuela
content = re.sub(
    r'\s*// Handlers para toggle individual y global de Horarios IA y Programas por Escuela\n\s*const handleToggleHorariosEscuela = async \([\s\S]*?\}\s*catch \(e\) \{\s*toast.error\("Error de red al actualizar"\);\s*\}\s*\};\n',
    '\n',
    content,
    flags=re.DOTALL
)

# cargarHorarioStats
content = re.sub(
    r'\s*// Cargar stats de uso de Horarios IA al entrar a la pestaña de programas/módulos\n\s*const cargarHorarioStats = async \(\) => \{[\s\S]*?catch \{ /\* silencioso \*/ \}\n\s*\};\n',
    '\n',
    content,
    flags=re.DOTALL
)

# handleResetStats
content = re.sub(
    r'\s*// Reiniciar contador de una escuela \(solo admin\)\n\s*const handleResetStats = async \([\s\S]*?catch \{\s*toast.error\("Error de conexión al reiniciar contador"\);\s*\}\s*\};\n',
    '\n',
    content,
    flags=re.DOTALL
)

# handleToggleGlobalHorarios
content = re.sub(
    r'\s*const handleToggleGlobalHorarios = async \([\s\S]*?finally \{\s*setSaving\(false\);\s*\}\s*\};\n',
    '\n',
    content,
    flags=re.DOTALL
)

# handleToggleProgramaEscuela
content = re.sub(
    r'\s*const handleToggleProgramaEscuela = async \([\s\S]*?catch \(e\) \{\s*toast.error\("Error al guardar permiso de programa"\);\s*\}\s*\};\n',
    '\n',
    content,
    flags=re.DOTALL
)

# handleTogglePlaneacionesEscuela
content = re.sub(
    r'\s*const handleTogglePlaneacionesEscuela = async \([\s\S]*?catch \{\s*toast.error\("Error de red al actualizar Planeaciones IA"\);\s*\}\s*\};\n',
    '\n',
    content,
    flags=re.DOTALL
)

# handleAccionMasivaPermisos
content = re.sub(
    r'\s*const handleAccionMasivaPermisos = async \([\s\S]*?finally \{\s*setSaving\(false\);\s*\}\s*\};\n',
    '\n',
    content,
    flags=re.DOTALL
)

# 5. Remove the button for tab "programas_modulos"
content = re.sub(
    r'\s*<button \n\s*className=\{\`tab-item \$\{tabEscuelas === "programas_modulos" \? "active" : ""\}\`\}\n\s*onClick=\{[^}]*\}\n\s*>\n\s*<Settings2 size=\{16\} />\n\s*Programas y Módulos\n\s*</button>',
    '',
    content,
    flags=re.DOTALL
)

# 6. Remove the tabEscuelas === "programas_modulos" section
content = re.sub(
    r'\s*\) : tabEscuelas === "programas_modulos" \? \([\s\S]*?\) : tabEscuelas === "supervision" y escuelas.filter',
    r'\n                    ) : tabEscuelas === "supervision" && escuelas.filter',
    content,
    flags=re.DOTALL
)
# Note: In the codebase, it might be `) : tabEscuelas === "supervision" && escuelas.filter`
# I should be careful about the exact string match for section 6.
# Let's fix section 6 regex to be more robust.
content = re.sub(
    r'\) : tabEscuelas === "programas_modulos" \? \([\s\S]*?\) : tabEscuelas === "supervision"',
    r') : tabEscuelas === "supervision"',
    content,
    flags=re.DOTALL
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
