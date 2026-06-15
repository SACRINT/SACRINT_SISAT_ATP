import sys, subprocess
sys.stdout.reconfigure(encoding='utf-8')

# Helper to insert lines at index (0-based)
def insert_at(lines, idx, new_lines):
    return lines[:idx] + new_lines + lines[idx:]

# Helper to replace from start_idx to end_idx inclusive (0-based)
def replace_range(lines, start, end, new_lines):
    return lines[:start] + new_lines + lines[end+1:]

# All new line blocks are defined as raw strings below
# No f-strings. No {{ }} tricks. Just plain Python strings with \n endings.

EYE_CAPEMS = [
    '                                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>\n',
    '                                                                            <button\n',
    '                                                                                onClick={() => setViewingPdf({\n',
    '                                                                                    url: reg.archivoDriveUrl!,\n',
    "                                                                                    title: `${reg.capem?.nombre ?? ''} \u2014 ${reg.archivoNombre || 'Archivo'}`,\n",
    '                                                                                    downloadUrl: getDownloadUrl(reg.archivoDriveUrl, reg.archivoNombre || "archivo", reg.archivoDriveId) || undefined,\n',
    '                                                                                })}\n',
    '                                                                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "2px", display: "inline-flex", alignItems: "center" }}\n',
    '                                                                                title="Ver documento"\n',
    '                                                                            >\n',
    '                                                                                <Eye size={15} />\n',
    '                                                                            </button>\n',
]

# The closing </div> wrapper that goes AFTER the existing <a>...</a> block
EYE_CAPEMS_CLOSE = '                                                                        </div>\n'

MODAL_BLOCK = [
    '\n',
    '        {/* Visor de documentos */}\n',
    '        {viewingPdf && (\n',
    '            <PdfViewerModal\n',
    '                isOpen={true}\n',
    '                onClose={() => setViewingPdf(null)}\n',
    '                url={viewingPdf.url}\n',
    '                title={viewingPdf.title}\n',
    '                downloadUrl={viewingPdf.downloadUrl}\n',
    '            />\n',
    '        )}\n',
]

# ================================================================
# GestionCapems.tsx
# ================================================================
fp1 = r'c:\NotebookLM\sisat-atp\src\app\admin\_componentes\GestionCapems.tsx'
with open(fp1, 'r', encoding='utf-8') as f:
    L = f.readlines()

print(f"GestionCapems: {len(L)} lines")

# -- Step 1: Add Eye to lucide import --
for i, line in enumerate(L):
    if '    Download,' in line and i < 30:
        L = insert_at(L, i+1, ['    Eye,\n'])
        print(f"  ✓ Eye import added at {i+2}")
        break

# -- Step 2: Add PdfViewerModal import --
for i, line in enumerate(L):
    if 'import { getDownloadUrl }' in line:
        L = insert_at(L, i, ['import PdfViewerModal from "@/app/_componentes/PdfViewerModal";\n'])
        print(f"  ✓ PdfViewerModal import added at {i+1}")
        break

# -- Step 3: Add viewingPdf state --
for i, line in enumerate(L):
    if 'const [busy, setBusy] = useState(false);' in line:
        new_state = '    const [viewingPdf, setViewingPdf] = useState<{ url: string; title: string; downloadUrl?: string } | null>(null);\n'
        L = insert_at(L, i+1, [new_state])
        print(f"  ✓ viewingPdf state added at {i+2}")
        break

# -- Step 4: Wrap download <a> with Eye button + <div> wrapper --
# Find '{reg.archivoDriveUrl ? (' line
for i, line in enumerate(L):
    if '{reg.archivoDriveUrl ? (' in line:
        # Next non-empty line should be <a
        j = i + 1
        while j < len(L) and L[j].strip() == '':
            j += 1
        if '<a' in L[j]:
            # Find </a> close
            k = j
            while k < len(L) and '</a>' not in L[k]:
                k += 1
            # k is </a> line (0-based)
            # Insert Eye button block before <a> (at position j)
            # First change <a> style to text-muted
            for idx in range(j, k+1):
                L[idx] = L[idx].replace('"var(--primary)"', '"var(--text-muted)"')
            # Insert wrapper open + eye button before j
            L = insert_at(L, j, EYE_CAPEMS)
            # Insert wrapper close after old </a> (now at k + len(EYE_CAPEMS))
            new_k = k + len(EYE_CAPEMS)
            L = insert_at(L, new_k+1, [EYE_CAPEMS_CLOSE])
            print(f"  ✓ Eye button added at row level (lines {j+1}-{new_k+1})")
            break

# -- Step 5: Add modal before final </div> + ); + } --
for i in range(len(L)-1, -1, -1):
    if L[i].rstrip() == '}' and i >= 2:
        if '    );' in L[i-1] and '        </div>' in L[i-2]:
            L = L[:i-2] + MODAL_BLOCK + [L[i-2]] + L[i-1:]
            print(f"  ✓ PdfViewerModal block inserted before final </div>")
            break

with open(fp1, 'w', encoding='utf-8') as f:
    f.writelines(L)

content1 = ''.join(L)
o1, c1 = content1.count('<div'), content1.count('</div>')
print(f"  GestionCapems saved: {len(L)} lines | divs: {o1}/{c1} diff={o1-c1}")

# ================================================================
# CapemsPanel.tsx
# ================================================================
fp3 = r'c:\NotebookLM\sisat-atp\src\app\director\_componentes\CapemsPanel.tsx'
with open(fp3, 'r', encoding='utf-8') as f:
    L3 = f.readlines()

print(f"\nCapemsPanel: {len(L3)} lines")

# Step 1: Eye import
for i, line in enumerate(L3):
    if '    Download,' in line and i < 20:
        L3 = insert_at(L3, i+1, ['    Eye,\n'])
        print(f"  ✓ Eye import added")
        break

# Step 2: PdfViewerModal import
for i, line in enumerate(L3):
    if 'import { getDownloadUrl }' in line:
        L3 = insert_at(L3, i, ['import PdfViewerModal from "@/app/_componentes/PdfViewerModal";\n'])
        print(f"  ✓ PdfViewerModal import added")
        break

# Step 3: viewingPdf state (after slots state)
for i, line in enumerate(L3):
    if 'const [slots, setSlots]' in line:
        new_state3 = '    const [viewingPdf, setViewingPdf] = useState<{ url: string; title: string; downloadUrl?: string } | null>(null);\n'
        L3 = insert_at(L3, i+1, [new_state3])
        print(f"  ✓ viewingPdf state added")
        break

# Step 4: Eye button in slot view
# Find 'slot.archivoDriveUrl && (' then find <a href=getDownloadUrl inside it
for i, line in enumerate(L3):
    if 'slot.archivoDriveUrl &&' in line:
        # Find FileText icon line (it's in the div that shows the file)
        j = i + 1
        while j < len(L3) and '<a' not in L3[j]:
            j += 1
        # j is the <a> line
        # Find </a>
        k = j
        while k < len(L3) and '</a>' not in L3[k]:
            k += 1
        
        # Get indent of <a>
        a_line = L3[j]
        indent = len(a_line) - len(a_line.lstrip())
        ind = ' ' * indent

        eye_slot = [
            f'{ind}{{/* Ver */}}\n',
            f'{ind}<button\n',
            f'{ind}    onClick={{() => setViewingPdf({{\n',
            f'{ind}        url: slot.archivoDriveUrl!,\n',
            f"{ind}        title: `${{capem.nombre}} \u2014 ${{slot.archivoNombre || 'Archivo'}}`,\n",
            f'{ind}        downloadUrl: getDownloadUrl(slot.archivoDriveUrl, slot.archivoNombre || "archivo", slot.archivoDriveId) || undefined,\n',
            f'{ind}    }}))}}\n',
            f'{ind}    style={{{{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "2px", flexShrink: 0, display: "inline-flex", alignItems: "center" }}}}\n',
            f'{ind}    title="Ver"\n',
            f'{ind}>\n',
            f'{ind}    <Eye size={{15}} />\n',
            f'{ind}</button>\n',
        ]
        # These f-strings are the problem! The {{ }} in f-strings for CapemsPanel.
        # Let me use a different approach - build without f-strings using concatenation
        eye_slot_safe = [
            ind + '{/* Ver */}\n',
            ind + '<button\n',
            ind + '    onClick={() => setViewingPdf({\n',
            ind + '        url: slot.archivoDriveUrl!,\n',
            ind + "        title: `${capem.nombre} \u2014 ${slot.archivoNombre || 'Archivo'}`,\n",
            ind + '        downloadUrl: getDownloadUrl(slot.archivoDriveUrl, slot.archivoNombre || "archivo", slot.archivoDriveId) || undefined,\n',
            ind + '    })}\n',
            ind + '    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "2px", flexShrink: 0, display: "inline-flex", alignItems: "center" }}\n',
            ind + '    title="Ver"\n',
            ind + '>\n',
            ind + '    <Eye size={15} />\n',
            ind + '</button>\n',
        ]
        L3 = insert_at(L3, j, eye_slot_safe)
        print(f"  ✓ Eye button added in slot")
        break

# Step 5: Modal at end
for i in range(len(L3)-1, -1, -1):
    if L3[i].rstrip() == '}' and i >= 2:
        if '    );' in L3[i-1] and '        </div>' in L3[i-2]:
            L3 = L3[:i-2] + MODAL_BLOCK + [L3[i-2]] + L3[i-1:]
            print(f"  ✓ PdfViewerModal added at end")
            break

with open(fp3, 'w', encoding='utf-8') as f:
    f.writelines(L3)

content3 = ''.join(L3)
o3, c3 = content3.count('<div'), content3.count('</div>')
print(f"  CapemsPanel saved: {len(L3)} lines | divs: {o3}/{c3} diff={o3-c3}")

# ================================================================
# GestionExpedientes - just add Eye import (already done in prev session)
# ================================================================
fp2 = r'c:\NotebookLM\sisat-atp\src\app\admin\_componentes\GestionExpedientes.tsx'
with open(fp2, 'r', encoding='utf-8') as f:
    L2 = f.readlines()
has_eye = any('Eye,' in l or '<Eye' in l for l in L2)
print(f"\nGestionExpedientes has Eye: {has_eye}")
if not has_eye:
    for i, line in enumerate(L2):
        if '    AlertCircle,' in line and i < 30:
            L2 = insert_at(L2, i, ['    Eye,\n'])
            with open(fp2, 'w', encoding='utf-8') as f:
                f.writelines(L2)
            print(f"  ✓ Eye import added to GestionExpedientes")
            break

# ================================================================
# Run TS check
# ================================================================
print("\n=== Running TypeScript check ===")
result = subprocess.run(
    'cmd /c npx tsc --noEmit 2>&1',
    cwd=r'c:\NotebookLM\sisat-atp',
    shell=True, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=90
)
output = (result.stdout + result.stderr)
errors = [l for l in output.split('\n') if 'error TS' in l]
if errors:
    print(f"ERRORS ({len(errors)}):")
    for e in errors[:20]:
        print(f"  {e}")
else:
    print("✅ NO TS ERRORS - Clean!")
