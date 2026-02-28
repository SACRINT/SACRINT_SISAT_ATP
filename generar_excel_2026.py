import os
import win32com.client
import xlsxwriter

def create_excel():
    excel_path = os.path.abspath("Registro_Zona_2026_Temp.xlsx")
    final_path = os.path.abspath("Registro_Zona_2026_Inteligente.xlsm")
    
    escuelas = [
        ("21EBH0088T", "ALFONSO DE LA MADRID VIDAURRETA", "VENUSTIANO CARRANZA"),
        ("21EBH0186U", "AQUILES SERDÁN", "PANTEPEC"),
        ("21EBH0903N", "BENITO JUÁREZ GARCÍA", "SAN BARTOLO"),
        ("21EBH0464F", "DAVID ALFARO SIQUEIROS", "HUITZILAC"),
        ("21EBH0789L", "DAVID ALFARO SIQUEIROS", "JALTOCAN"),
        ("21EBH0708K", "DIEGO RIVERA", "EJIDO CAÑADA COLOTLA"),
        ("21EBH0608L", "EMILIANO ZAPATA", "SAN DIEGO"),
        ("21EBH0200X", "HÉROES DE LA PATRIA", "CORONEL TITO HDEZ."),
        ("21EBH0620G", "JAIME SABINES", "AGUA LINDA"),
        ("21EBH0681U", "JOSÉ IGNACIO GREGORIO COMONFORT", "PALMA REAL"),
        ("21EBH0201W", "JOSÉ VASCONCELOS", "LAZARO CARDENAS"),
        ("21EBH0799S", "JUAN ALDAMA", "NUEVO ZOQUIAPAN"),
        ("21EBH07040", "LUIS DONALDO COLOSIO MURRIETA", "LA CEIBA CHICA"),
        ("21EBH0214Z", "MECAPALAPA", "MECAPALAPA"),
        ("21EBH0465E", "MOISÉS SÁENZ GARZA", "TECOMATE"),
        ("21EBH0130S", "REYES GARCÍA OLIVARES", "FCO. Z. MENA"),
        ("21ECT0017T", "TECNOLÓGICO FCO. Z. MENA", "FCO. Z. MENA"),
        ("21EBH0682T", "VICENTE SUÁREZ FERRER", "COYOLITO")
    ]

    # Definition of disciplines
    categories = {
        "Arte y Cultura": [
            {"name": "Baile Trad. (8-16)", "has_participants": False, "pair": None, "single_link": "Baile_Num"},
            {"name": "Baile - Nº Part.", "has_participants": True, "min": 8, "max": 16, "pair": "Baile_Num", "single_link": None},
            
            {"name": "Danza Trad. (4-16)", "has_participants": False, "pair": None, "single_link": "Danza_Num"},
            {"name": "Danza - Nº Part.", "has_participants": True, "min": 4, "max": 16, "pair": "Danza_Num", "single_link": None},
            
            {"name": "Canto - Solista", "has_participants": False, "min": 1, "max": 1, "pair": "Canto", "is_indiv": True},
            {"name": "Canto - Dueto", "has_participants": False, "min": 2, "max": 2, "pair": "Canto", "is_indiv": False},
            {"name": "Canto - Nº Part.", "has_participants": True, "min": 1, "max": 2, "pair": "Canto_Num"},
            
            {"name": "Cómic - Indiv.", "has_participants": False, "min": 1, "max": 1, "pair": "Cómic", "is_indiv": True},
            {"name": "Cómic - Equipo", "has_participants": False, "min": 2, "max": 3, "pair": "Cómic", "is_indiv": False},
            {"name": "Cómic - Nº Part.", "has_participants": True, "min": 1, "max": 3, "pair": "Cómic_Num"},
            
            {"name": "Foto - Indiv.", "has_participants": False, "min": 1, "max": 1, "pair": "Fotografía", "is_indiv": True},
            {"name": "Foto - Equipo", "has_participants": False, "min": 2, "max": 3, "pair": "Fotografía", "is_indiv": False},
            {"name": "Foto - Nº Part.", "has_participants": True, "min": 1, "max": 3, "pair": "Fotografía_Num"},

            {"name": "TikTok - Indiv.", "has_participants": False, "min": 1, "max": 1, "pair": "TikTok", "is_indiv": True},
            {"name": "TikTok - Equipo", "has_participants": False, "min": 2, "max": 3, "pair": "TikTok", "is_indiv": False},
            {"name": "TikTok - Nº Part.", "has_participants": True, "min": 1, "max": 3, "pair": "TikTok_Num"},

            {"name": "Teatro (1-10)", "has_participants": False, "pair": None, "single_link": "Teatro_Num"},
            {"name": "Teatro - Nº Part.", "has_participants": True, "min": 1, "max": 10, "pair": "Teatro_Num", "single_link": None}
        ],
        "Humanidades y Com.": [
            {"name": "Declamación (1)", "has_participants": False, "pair": None, "single_link": None},
            {"name": "Filosofía (1)", "has_participants": False, "pair": None, "single_link": None},
            {"name": "Oratoria Ensayo (1)", "has_participants": False, "pair": None, "single_link": None},
            {"name": "Spelling Bee - A1", "has_participants": False, "pair": None, "single_link": None},
            {"name": "Spelling Bee - A2", "has_participants": False, "pair": None, "single_link": None},
            {"name": "Spelling Bee - B1", "has_participants": False, "pair": None, "single_link": None}
        ],
        "Ciencia y Tecnología": [
            {"name": "Enc. Ciencias (2-4)", "has_participants": False, "pair": None, "single_link": "Ciencias_Num"},
            {"name": "Ciencias - Nº Part.", "has_participants": True, "min": 2, "max": 4, "pair": "Ciencias_Num", "single_link": None},
            
            {"name": "Enc. Matemáticas (2-4)", "has_participants": False, "pair": None, "single_link": "Mats_Num"},
            {"name": "Matemáticas - Nº Part.", "has_participants": True, "min": 2, "max": 4, "pair": "Mats_Num", "single_link": None},
            
            {"name": "Enc. Física (2-4)", "has_participants": False, "pair": None, "single_link": "Fisica_Num"},
            {"name": "Física - Nº Part.", "has_participants": True, "min": 2, "max": 4, "pair": "Fisica_Num", "single_link": None},
            
            {"name": "Enc. Química (2-4)", "has_participants": False, "pair": None, "single_link": "Quimica_Num"},
            {"name": "Química - Nº Part.", "has_participants": True, "min": 2, "max": 4, "pair": "Quimica_Num", "single_link": None},
            
            {"name": "Sabores Com. (2-4)", "has_participants": False, "pair": None, "single_link": "Sabores_Num"},
            {"name": "Sabores - Nº Part.", "has_participants": True, "min": 2, "max": 4, "pair": "Sabores_Num", "single_link": None}
        ],
        "Tech-Desafíos": [
            {"name": "Fotomontaje - Ind", "has_participants": False, "min": 1, "max": 1, "pair": "Fotomontaje", "is_indiv": True},
            {"name": "Fotomontaje - Eq", "has_participants": False, "min": 2, "max": 3, "pair": "Fotomontaje", "is_indiv": False},
            {"name": "Fotomontaje - Nº Part.", "has_participants": True, "min": 1, "max": 3, "pair": "Fotomontaje_Num"},
            
            {"name": "Humor - Ind", "has_participants": False, "min": 1, "max": 1, "pair": "Humor", "is_indiv": True},
            {"name": "Humor - Eq", "has_participants": False, "min": 2, "max": 3, "pair": "Humor", "is_indiv": False},
            {"name": "Humor - Nº Part.", "has_participants": True, "min": 1, "max": 3, "pair": "Humor_Num"},
            
            {"name": "Música IA - Ind", "has_participants": False, "min": 1, "max": 1, "pair": "Música", "is_indiv": True},
            {"name": "Música IA - Eq", "has_participants": False, "min": 2, "max": 3, "pair": "Música", "is_indiv": False},
            {"name": "Música IA - Nº Part.", "has_participants": True, "min": 1, "max": 3, "pair": "Música_Num"},
            
            {"name": "Ritmo - Ind", "has_participants": False, "min": 1, "max": 1, "pair": "Ritmo", "is_indiv": True},
            {"name": "Ritmo - Eq", "has_participants": False, "min": 2, "max": 3, "pair": "Ritmo", "is_indiv": False},
            {"name": "Ritmo - Nº Part.", "has_participants": True, "min": 1, "max": 3, "pair": "Ritmo_Num"}
        ],
        "Eventos Externos": [
            {"name": "Olimpiada Mats. (1)", "has_participants": False, "pair": None, "single_link": None},
            {"name": "Encuentro PAEC (2-20)", "has_participants": False, "pair": None, "single_link": "PAEC_Num"},
            {"name": "PAEC - Nº Part.", "has_participants": True, "min": 2, "max": 20, "pair": "PAEC_Num", "single_link": None}
        ]
    }

    if os.path.exists(excel_path):
        try:
            os.remove(excel_path)
        except Exception:
            pass
        
    workbook = xlsxwriter.Workbook(excel_path)
    ws = workbook.add_worksheet("Registro General")
    ws_resumen = workbook.add_worksheet("Resumen")
    ws_listas = workbook.add_worksheet("Listas")
    ws_listas.hide()

    fmt_header_main = workbook.add_format({'bold': True, 'align': 'center', 'valign': 'vcenter', 'bg_color': '#1f4e78', 'font_color': 'white', 'border': 1})
    fmt_header_cat = workbook.add_format({'bold': True, 'align': 'center', 'valign': 'vcenter', 'bg_color': '#2e75b6', 'font_color': 'white', 'border': 1})
    fmt_header_disc = workbook.add_format({'bold': True, 'align': 'center', 'valign': 'vcenter', 'bg_color': '#ddebf7', 'border': 1, 'text_wrap': True})
    fmt_header_sub = workbook.add_format({'bold': True, 'align': 'center', 'valign': 'vcenter', 'bg_color': '#f2f2f2', 'border': 1, 'font_size': 9})
    
    fmt_cell = workbook.add_format({'border': 1, 'align': 'center', 'valign': 'vcenter'})
    fmt_cell_locked = workbook.add_format({'border': 1, 'align': 'center', 'valign': 'vcenter', 'bg_color': '#e2efda'})
    fmt_num = workbook.add_format({'border': 1, 'align': 'center', 'valign': 'vcenter', 'bg_color': '#fff2cc'})
    
    ws_listas.write(0, 0, "Participa")
    ws_listas.write(1, 0, "No")
    ws_listas.write(2, 0, "Sí")
    
    ws.freeze_panes(4, 3)
    ws.set_column(0, 0, 15)
    ws.set_column(1, 1, 35)
    ws.set_column(2, 2, 22)

    ws.merge_range(0, 0, 0, 2, "DATOS DEL PLANTEL", fmt_header_main)
    ws.write(1, 0, "", fmt_header_main)
    ws.write(1, 1, "", fmt_header_main)
    ws.write(1, 2, "", fmt_header_main)
    ws.write(2, 0, "", fmt_header_main)
    ws.write(2, 1, "", fmt_header_main)
    ws.write(2, 2, "", fmt_header_main)
    
    ws.write(3, 0, "CCT", fmt_header_sub)
    ws.write(3, 1, "Nombre del Plantel", fmt_header_sub)
    ws.write(3, 2, "Localidad", fmt_header_sub)

    col_idx = 3
    all_disciplines = []
    
    pair_mapping = {}
    single_mapping = {}

    for cat_name, desc_list in categories.items():
        num_cols = len(desc_list)
        ws.merge_range(0, col_idx, 0, col_idx + num_cols - 1, cat_name, fmt_header_cat)
        
        for desc in desc_list:
            if "Nº Part." in desc["name"]:
                ws.merge_range(1, col_idx, 2, col_idx, desc["name"], fmt_num)
                ws.write(3, col_idx, "#", fmt_header_sub)
                desc["col"] = col_idx + 1
                desc["is_num_col"] = True
                ws.set_column(col_idx, col_idx, 8)
                all_disciplines.append(desc)
                col_idx += 1
                continue
            
            ws.merge_range(1, col_idx, 2, col_idx, desc["name"], fmt_header_disc)
            if desc["has_participants"]:
                ws.write(3, col_idx, "Nº Part.", fmt_header_sub)
                ws.set_column(col_idx, col_idx, 8)
            else:
                ws.write(3, col_idx, "Participa?", fmt_header_sub)
                ws.set_column(col_idx, col_idx, 10)
            
            desc["col"] = col_idx + 1 # 1-based index
            desc["is_num_col"] = False
            all_disciplines.append(desc)
            col_idx += 1

    groups = list(set([d["pair"] for d in all_disciplines if d.get("pair") and not d["pair"].endswith("_Num")]))
    for g in groups:
        indiv = next((d for d in all_disciplines if d.get("pair") == g and d.get("is_indiv") == True), None)
        equipo = next((d for d in all_disciplines if d.get("pair") == g and d.get("is_indiv") == False), None)
        num_col = next((d for d in all_disciplines if d.get("pair") == f"{g}_Num"), None)
        if indiv and equipo and num_col:
            pair_mapping[g] = {
                "indiv_col": indiv["col"],
                "equipo_col": equipo["col"],
                "num_col": num_col["col"],
                "indiv_val": indiv.get("min", 1),
                "equipo_min": equipo.get("min", 2),
                "equipo_max": equipo.get("max", 3)
            }

    for d in all_disciplines:
        if d.get("single_link"):
            num_d = next((x for x in all_disciplines if x.get("pair") == d["single_link"]), None)
            if num_d:
                single_mapping[d["name"]] = {
                    "participa_col": d["col"],
                    "num_col": num_d["col"],
                    "min": num_d.get("min"),
                    "max": num_d.get("max")
                }

    start_row = 4
    for i, escuela in enumerate(escuelas):
        row = start_row + i
        ws.write(row, 0, escuela[0], fmt_cell_locked)
        ws.write(row, 1, escuela[1], fmt_cell_locked)
        ws.write(row, 2, escuela[2], fmt_cell_locked)
        
        c_idx = 3
        for desc in all_disciplines:
            if desc["is_num_col"] or desc["has_participants"]:
                ws.write(row, c_idx, "", fmt_num)
            else:
                ws.write(row, c_idx, "No", fmt_cell)
                ws.data_validation(row, c_idx, row, c_idx, {'validate': 'list', 'source': '=Listas!$A$2:$A$3'})
            c_idx += 1

    ws_resumen.write(0, 0, "RESUMEN DE PARTICIPACIÓN POR DISCIPLINA", fmt_header_main)
    ws_resumen.set_column(0, 0, 40)
    ws_resumen.set_column(1, 1, 15)
    row = 2
    for desc in all_disciplines:
        if not desc["is_num_col"] and not desc["has_participants"]:
            ws_resumen.write(row, 0, desc["name"], fmt_cell_locked)
            col_letter = xlsxwriter.utility.xl_col_to_name(desc["col"] - 1)
            ws_resumen.write_formula(row, 1, f'=COUNTIF(\'Registro General\'!{col_letter}5:{col_letter}22, "Sí")', fmt_cell)
            row += 1

    workbook.close()

    vba_sheet_code = """
Private Sub Worksheet_Change(ByVal Target As Range)
    If Target.Count > 1 Then Exit Sub
    If Target.Row < 5 Or Target.Row > 22 Then Exit Sub
    
    Dim col As Integer
    col = Target.Column
"""
    for g, info in pair_mapping.items():
        vba_sheet_code += f'''
    If col = {info["indiv_col"]} Then
        Application.EnableEvents = False
        If Target.Value = "Sí" Then
            Cells(Target.Row, {info["equipo_col"]}).Value = "No"
            Cells(Target.Row, {info["num_col"]}).Value = {info["indiv_val"]}
        Else
            If Cells(Target.Row, {info["equipo_col"]}).Value = "No" Then
                Cells(Target.Row, {info["num_col"]}).Value = ""
            End If
        End If
        Application.EnableEvents = True
        Exit Sub
    End If
    
    If col = {info["equipo_col"]} Then
        Application.EnableEvents = False
        If Target.Value = "Sí" Then
            Cells(Target.Row, {info["indiv_col"]}).Value = "No"
            Cells(Target.Row, {info["num_col"]}).Value = ""
            Cells(Target.Row, {info["num_col"]}).Select
        Else
            If Cells(Target.Row, {info["indiv_col"]}).Value = "No" Then
                Cells(Target.Row, {info["num_col"]}).Value = ""
            End If
        End If
        Application.EnableEvents = True
        Exit Sub
    End If
'''

    for name, info in single_mapping.items():
        vba_sheet_code += f'''
    If col = {info["participa_col"]} Then
        Application.EnableEvents = False
        If Target.Value = "Sí" Then
            Cells(Target.Row, {info["num_col"]}).Select
        Else
            Cells(Target.Row, {info["num_col"]}).Value = ""
        End If
        Application.EnableEvents = True
        Exit Sub
    End If
'''

    vba_sheet_code += "\nEnd Sub\n"

    vba_workbook_code = """
Private Sub Workbook_BeforeSave(ByVal SaveAsUI As Boolean, Cancel As Boolean)
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Registro General")
    Dim r As Integer, num As Variant
    Dim err_msg As String
    Dim ind_val As String, eq_val As String, num_val As Variant
    Dim part_val As String
"""
    
    for g, info in pair_mapping.items():
        vba_workbook_code += f'''
    For r = 5 To 22
        ind_val = ws.Cells(r, {info["indiv_col"]}).Value
        eq_val = ws.Cells(r, {info["equipo_col"]}).Value
        num_val = ws.Cells(r, {info["num_col"]}).Value
        
        If ind_val = "Sí" Then
            If num_val <> {info["indiv_val"]} Then
                err_msg = "Error en Fila " & r & " - Escuela: " & ws.Cells(r, 2).Value & vbCrLf & _
                          "[{g} - Indiv.] exige exactamente {info['indiv_val']} participante."
                MsgBox err_msg, vbCritical
                ws.Select
                ws.Cells(r, {info["num_col"]}).Value = {info["indiv_val"]}
                Cancel = True
                Exit Sub
            End If
        ElseIf eq_val = "Sí" Then
            If IsEmpty(num_val) Or num_val = "" Then
                err_msg = "Error en Fila " & r & " - Escuela: " & ws.Cells(r, 2).Value & vbCrLf & _
                          "Falta el número de participantes en [{g} - Equipo]"
                MsgBox err_msg, vbCritical
                ws.Select
                ws.Cells(r, {info["num_col"]}).Select
                Cancel = True
                Exit Sub
            ElseIf Not IsNumeric(num_val) Or num_val < {info["equipo_min"]} Or num_val > {info["equipo_max"]} Then
                err_msg = "Error en Fila " & r & " - Escuela: " & ws.Cells(r, 2).Value & vbCrLf & _
                          "[{g} - Equipo] exige entre {info['equipo_min']} y {info['equipo_max']} participantes."
                MsgBox err_msg, vbCritical
                ws.Select
                ws.Cells(r, {info["num_col"]}).Select
                Cancel = True
                Exit Sub
            End If
        Else
            If Not IsEmpty(num_val) And num_val <> "" Then
                err_msg = "Error en Fila " & r & " - Escuela: " & ws.Cells(r, 2).Value & vbCrLf & _
                          "Si NO participa en [{g}], el número de participantes debe estar vacío."
                MsgBox err_msg, vbCritical
                ws.Select
                ws.Cells(r, {info["num_col"]}).Value = ""
                Cancel = True
                Exit Sub
            End If
        End If
    Next r
'''

    for name, info in single_mapping.items():
        vba_workbook_code += f'''
    For r = 5 To 22
        part_val = ws.Cells(r, {info["participa_col"]}).Value
        num_val = ws.Cells(r, {info["num_col"]}).Value
        
        If part_val = "Sí" Then
            If IsEmpty(num_val) Or num_val = "" Or Not IsNumeric(num_val) Or num_val < {info["min"]} Or num_val > {info["max"]} Then
                err_msg = "Error en Fila " & r & " - Escuela: " & ws.Cells(r, 2).Value & vbCrLf & _
                          "[{name}] exige entre {info['min']} y {info['max']} participantes."
                MsgBox err_msg, vbCritical
                ws.Select
                ws.Cells(r, {info["num_col"]}).Select
                Cancel = True
                Exit Sub
            End If
        Else
            If Not IsEmpty(num_val) And num_val <> "" Then
                err_msg = "Error en Fila " & r & " - Escuela: " & ws.Cells(r, 2).Value & vbCrLf & _
                          "Si NO participa en [{name}], el número debe estar vacío."
                MsgBox err_msg, vbCritical
                ws.Select
                ws.Cells(r, {info["num_col"]}).Value = ""
                Cancel = True
                Exit Sub
            End If
        End If
    Next r
'''

    vba_workbook_code += "\nEnd Sub\n"

    if os.path.exists(final_path):
        try:
            os.remove(final_path)
        except Exception:
            pass

    excel = win32com.client.Dispatch("Excel.Application")
    excel.DisplayAlerts = False
    
    excel_path_win = excel_path.replace('/', '\\')
    final_path_win = final_path.replace('/', '\\')
    
    wb = excel.Workbooks.Open(excel_path_win)
    
    try:
        ws_rg = wb.VBProject.VBComponents("Hoja1")
        ws_rg.CodeModule.AddFromString(vba_sheet_code)
        
        wb_comp = wb.VBProject.VBComponents("ThisWorkbook")
        wb_comp.CodeModule.AddFromString(vba_workbook_code)
        
        xlOpenXMLWorkbookMacroEnabled = 52
        wb.SaveAs(final_path_win, FileFormat=xlOpenXMLWorkbookMacroEnabled)
    except Exception as e:
        print(f"Failed to inject VBA: {e}")
        wb.Close(SaveChanges=False)
        excel.Quit()
        return

    wb.Close(SaveChanges=False)
    excel.Quit()
    try:
        os.remove(excel_path)
    except:
        pass
    print("Sucessfully created", final_path)

if __name__ == '__main__':
    create_excel()
