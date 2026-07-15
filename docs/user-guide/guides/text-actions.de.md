# Ausgewählten Text übersetzen und verschönern

GPT-Voice kann auf Text reagieren, der in einer anderen Anwendung ausgewählt wurde. **Translate** sendet die Auswahl an Google Translate im
Zielsprache, die Sie wählen. **Prettify** sendet es an Ihren konfigurierten Textverarbeitungsanbieter, um den Text zu verbessern
entsprechend seiner Aufforderung. Keine Aktion wird in die andere Anwendung eingefügt: Bei Erfolg kopieren Sie das Ergebnis aus dem System
Zwischenablage und fügen Sie es dort ein, wo Sie es benötigen.

## Aktivieren Sie eine Aktion und wählen Sie ihre Verknüpfung

Öffnen Sie **Settings** und wählen Sie **Shortcuts**. Die Zeilen **Translate** und **Prettify** verfügen jeweils über einen Aktivierungsschalter und einen
**Change**-Steuerung für ihre globale Verknüpfung. Beide Aktionen sind standardmäßig aktiviert; Ihre Standardverknüpfungen sind `F11`
für Translate und `F12` für Prettify. Speichern Sie die Einstellungen, nachdem Sie eine Änderung vorgenommen haben.

Wählen Sie eine Verknüpfung, die nicht mit einer anderen GPT-Voice-Verknüpfung oder mit der von Ihnen verwendeten Software in Konflikt steht. Eine deaktivierte Aktion
wird nicht ausgeführt, wenn die entsprechende Verknüpfung gedrückt wird. Eine Aktion wartet auch, bis eine aktive Aufzeichnung beendet ist und GPT-Voice ausgeführt wird
jeweils nur eine ausgewählte Textaktion.

## Eine Auswahl übersetzen

1. Wählen Sie in der Anwendung, die den Text enthält, den Text aus, den Sie übersetzen möchten.
2. Wählen Sie unter GPT-Voice Command Dock **Target language**: Englisch, Russisch, Ukrainisch oder Weißrussisch.
3. Drücken Sie die aktivierte Verknüpfung „Übersetzen“ (standardmäßig `F11`).
4. Warten Sie auf die Erfolgsmeldung und fügen Sie dann den übersetzten Text aus Ihrer Zwischenablage ein.

GPT-Voice kopiert den ausgewählten Text mithilfe der normalen Kopieraktion des Betriebssystems und übermittelt ihn dann an Google
Übersetzen. Die Übersetzung ist ein externer Dienst: Der ausgewählte Text wird an Google Translate gesendet. Verwenden Sie diese Aktion daher nicht
für Text, den Sie nicht mit diesem Dienst teilen dürfen.

Wenn kein ausgewählter Text vorhanden ist, kann das Kopieren nicht automatisiert werden oder der Dienst kann kein Ergebnis zurückgeben, meldet GPT-Voice a
sichere Fehlermeldung und stellt den Zwischenablagewert wieder her, der vor der Aktion vorhanden war. Unter Linux kann es auch verwendet werden
Auswahlzwischenablage, wenn der normale Kopiervorgang fehlschlägt. Bei einer erfolgreichen Übersetzung wird die Systemzwischenablage durch ersetzt
übersetztes Ergebnis.

## Eine Auswahl verschönern

Bevor Sie Prettify verwenden, öffnen Sie **Settings** und wählen Sie **Prettify**. Wählen Sie entweder **Ollama** oder **vLLM** und legen Sie den Anbieter fest
Geben Sie Adresse und Modell ein und speichern Sie eine gültige Konfiguration. vLLM kann auch einen API-Schlüssel erfordern.

1. Wählen Sie in der Anwendung, die Sie bearbeiten, bis zu 16.000 Zeichen aus.
2. Drücken Sie die aktivierte Prettify-Verknüpfung (standardmäßig `F12`).
3. Warten Sie auf die Benachrichtigung **Text prettified** und fügen Sie dann das Ergebnis aus Ihrer Zwischenablage ein.

Ollama und vLLM sind benutzergesteuerte Abhängigkeiten: GPT-Voice installiert, hostet oder verwaltet keinen der Dienste. Ein Einheimischer
Der Loopback-Endpunkt hält die Anfrage auf dem Computer, auf dem dieser Dienst ausgeführt wird. Ein entfernter Endpunkt empfängt den ausgewählten Text;
Verwenden Sie einen vertrauenswürdigen Anbieter, befolgen Sie dessen Datenverarbeitungsrichtlinien und verwenden Sie HTTPS für einen nicht lokalen Endpunkt.Wenn kein Text ausgewählt ist, überschreitet die Auswahl 16.000 Zeichen, der konfigurierte Anbieter ist nicht erreichbar oder er
gibt kein brauchbares Ergebnis zurück, GPT-Voice meldet den Fehler und stellt den vorherigen Inhalt der Zwischenablage wieder her. Während ein Prettify
Wenn die Anforderung ausgeführt wird, bricht die konfigurierte Abbruchverknüpfung (Standard `Escape`) sie ab und stellt den Wert in der Zwischenablage wieder her.

## Zwischenablage und gleichzeitige Aktionen

Übersetzung und Prettify schließen sich bewusst gegenseitig aus. Wenn man das eine startet, während das andere bereits arbeitet, überspringt es
Warten Sie also auf den Status oder die Benachrichtigung, bevor Sie es erneut versuchen. Bei Erfolg ersetzt das Ergebnis das
Zwischenablage; Bei einer fehlgeschlagenen oder abgebrochenen Anfrage stellt GPT-Voice den Zwischenablagewert wieder her, den es vor dem Lesen erfasst hat
Auswahl. Überprüfen Sie immer das eingefügte Ergebnis, insbesondere wenn der Quelltext Namen, Code oder andere genaue Werte enthält.
