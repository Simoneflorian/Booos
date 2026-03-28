Attribute VB_Name = "QuittungSucheModul"
' ============================================================
'  Quittungsscanner — Suchfunktion
'  Importieren: VBA-Editor (Alt+F11) > Datei > Datei importieren
' ============================================================

' Öffnet ein Eingabefeld und sucht sofort in allen Quittungsdaten.
' Zuweisung empfohlen: Alt+F8 > QuittungSuchen > Optionen > Tastenkombination
Sub QuittungSuchen()
    Dim suchbegriff As String
    Dim ws As Worksheet
    Dim sucheSheet As Worksheet

    ' Suche-Sheet finden
    On Error Resume Next
    Set sucheSheet = ThisWorkbook.Sheets("Suche")
    On Error GoTo 0

    If sucheSheet Is Nothing Then
        MsgBox "Das Blatt 'Suche' wurde nicht gefunden." & vbCrLf & _
               "Bitte stelle sicher, dass diese Datei mit der Quittungsscanner-App erstellt wurde.", _
               vbExclamation, "Quittungssuche"
        Exit Sub
    End If

    ' Eingabefeld anzeigen
    suchbegriff = InputBox( _
        "Suchbegriff eingeben:" & vbCrLf & _
        "(Händler, Datum, Artikel, Quittungs-Nr., Zahlungsart …)" & vbCrLf & vbCrLf & _
        "Leer lassen = alle Einträge anzeigen", _
        "Quittungssuche", _
        sucheSheet.Range("B3").Value)

    ' Abbrechen gedrückt
    If suchbegriff = "" And StrPtr(suchbegriff) = 0 Then Exit Sub

    ' Suchbegriff in die Formelzelle schreiben und Sheet aktivieren
    Application.ScreenUpdating = False
    sucheSheet.Activate
    sucheSheet.Range("B3").Value = suchbegriff
    sucheSheet.Range("B3").Select
    Application.ScreenUpdating = True

    ' Rückmeldung wenn Suchbegriff gesetzt
    If suchbegriff <> "" Then
        Application.StatusBar = "Suche nach: """ & suchbegriff & """ — Ergebnisse werden oben angezeigt."
    Else
        Application.StatusBar = "Alle Einträge werden angezeigt."
    End If
End Sub

' Suche zurücksetzen / alle Einträge anzeigen
Sub SucheSuruecksetzen()
    Dim sucheSheet As Worksheet
    On Error Resume Next
    Set sucheSheet = ThisWorkbook.Sheets("Suche")
    On Error GoTo 0

    If Not sucheSheet Is Nothing Then
        sucheSheet.Activate
        sucheSheet.Range("B3").Value = ""
        sucheSheet.Range("B3").Select
        Application.StatusBar = "Suche zurückgesetzt — alle Einträge werden angezeigt."
    End If
End Sub
