import os
from docx import Document

input_path = "C:/NotebookLM/documentos_referencia/4 Constancia de NO Adeudo DIRECTOR 2025-2026 (004).docx"
output_path = "C:/NotebookLM/documentos_referencia/4 Constancia de NO Adeudo DIRECTOR 2025-2026 (004) CON ETIQUETAS.docx"

if not os.path.exists(input_path):
    # Try alternate name from the user message
    input_path = "C:/NotebookLM/documentos_referencia/4 Constancia de NO Adeudo DIRECTOR 2025-2026(Zona 004).docx"
    output_path = "C:/NotebookLM/documentos_referencia/4 Constancia de NO Adeudo DIRECTOR 2025-2026(Zona 004) CON ETIQUETAS.docx"

doc = Document(input_path)

replacements = {
    "El (La) que suscribe C:": "El (La) que suscribe C: {SUPERVISOR}",
    "Con cabecera en el Municipio de:": "Con cabecera en el Municipio de: {MUNICIPIO_ESCUELA}",
    "El (La) Director(a):": "El (La) Director(a): {NOMBRE_DIRECTOR}",
    "R.F.C.": "R.F.C.: {RFC_DIRECTOR}",
    "Fecha de Ingreso a SEP:": "Fecha de Ingreso a SEP: {FECHA_INGRESO_DIRECTOR}",
    "Clave Presupuestal:": "Clave Presupuestal: {CLAVE_PRESUPUESTAL_DIRECTOR}",
    "Nombre del Centro de Trabajo:": "Nombre del Centro de Trabajo: {NOMBRE_ESCUELA}",
    "Clave del C.T.": "Clave del C.T.: {CCT_ESCUELA}",
    "ALEJANDRO ESCAMILLA MARTÍNEZ": "{SUPERVISOR}"
}

for paragraph in doc.paragraphs:
    for run in paragraph.runs:
        for key, value in replacements.items():
            if key in run.text:
                run.text = run.text.replace(key, value)

doc.save(output_path)
print(f"Saved modified document to {output_path}")
