# Aufzeichnen und transkribieren

Schließen Sie vor der Aufnahme einen Anbieter an, der **Connected** anzeigt, und erlauben Sie GPT-Voice, Ihr Mikrofon zu verwenden. Siehe
[Verwenden Sie es zum ersten Mal](../getting-started.md), wenn Sie die Einrichtung noch nicht abgeschlossen haben, oder lesen Sie das [Anbieterhandbuch](providers.md)
für Verbindungs- und Kontodaten.

## Lebenszyklus der Aufzeichnung

Starten Sie eine Aufnahme über Command Dock oder mit der konfigurierten Aufnahmeverknüpfung (Standard ist `F9`). Der Status
ändert sich von **Ready** zu **Recording**, sobald die Mikrofonaufnahme gestartet wurde. Während der Aufnahme ist die Hauptaktion
**Stop recording** (Standard `F10`).

| Aktion              | Wenn es verfügbar ist                             | Was passiert                                                                                                                                                                  |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Start recording** | GPT-Voice ist inaktiv.                            | Fordert Mikrofonzugriff an und beginnt mit einer neuen Aufnahme. Wenn Sie eine neue Aufnahme starten, werden alle wiederholbaren Audiodaten der vorherigen Aufnahme gelöscht. |
| **Pause**           | Eine Aufnahme ist eine Aufnahme.                  | Hält die aktuelle Aufnahme an, ohne sie zu senden.                                                                                                                            |
| **Resume**          | Eine Aufnahme wird angehalten.                    | Setzt die gleiche Aufnahme fort.                                                                                                                                              |
| **Stop recording**  | Eine Aufnahme wird aufgezeichnet oder angehalten. | Beendet die Aufnahme, bereitet das Audio vor und sendet es an den ausgewählten Anbieter.                                                                                      |
| **Cancel**          | GPT-Voice startet, nimmt auf oder ist pausiert.   | Stoppt und verwirft die aktive Erfassung; Es wird nicht zur Transkription gesendet.                                                                                           |

Während GPT-Voice stoppt, Audio vorbereitet, transkribiert oder es erneut versucht, warten Sie, bis der aktuelle Vorgang abgeschlossen ist
bevor Sie eine weitere Aufnahme starten. Das Command Dock zeigt einen Bearbeitungsstatus während dieser Zeit an.

## Was passiert, nachdem Sie aufgehört haben?

Nach **Stop recording** bereitet GPT-Voice das aufgenommene Audio vor und zeigt **Transcribing** an. Es sendet das vorbereitete
Audio an den im Command Dock ausgewählten Anbieter:

- **ChatGPT Web** sendet das Audio über die angemeldete Browsersitzung ChatGPT.
- **OpenAI API** sendet das Audio mithilfe des von Ihnen konfigurierten API-Schlüssels an den Transkriptionsendpunkt von OpenAI.

Anbieterverfügbarkeit, Kontozugriff, Abrechnung, Kontingente und Servicebedingungen werden von diesem Anbieterkonto gesteuert.
GPT-Voice umgeht diese Kontrollen nicht.

Bei Erfolg kopiert GPT-Voice den zurückgegebenen Text in die Zwischenablage Ihres Systems und ändert den Status in **Kopiert nach
Zwischenablage** und fordert eine Erfolgsbenachrichtigung an. Fügen Sie den Text in die von Ihnen verwendete Anwendung ein. GPT-Voice auchspeichert den Text, den Anbieternamen und die Anfragezeit in seinem lokalen Transkriptionsverlauf; Die Verlaufskontrollen sind
gesondert dokumentiert.

## Versuchen Sie eine fehlgeschlagene Transkription erneut

Nachdem GPT-Voice eine nicht leere Aufnahme vorbereitet hat, bleibt diese vorbereitete Audiodatei als letzte wiederholbare Aufnahme im Speicher
Aufnahme. Wenn die Transkriptionsanfrage fehlschlägt, verwenden Sie die konfigurierte Transkriptionswiederholungsaktion, wenn GPT-Voice inaktiv ist
Senden Sie das gleiche vorbereitete Audio erneut. Bei einem erneuten Versuch wird das Mikrofon nicht erneut aufgezeichnet.

Diese Wiederholungskopie ist absichtlich temporär:

- Es wird gelöscht, bevor Sie eine neue Aufnahme beginnen.
- Während der Aufzeichnung, Verarbeitung oder Wiederholung ist es nicht verfügbar.
- Es wird nur im Speicher der laufenden Anwendung gespeichert; Durch einen Neustart von GPT-Voice wird es entfernt.

Mit einem erneuten Versuch können Sie eine fehlgeschlagene Übermittlung wiederholen, nachdem Sie ein Verbindungs-, Sitzungs- oder Anbieterproblem behoben haben. Das ist nicht der Fall
Anbieterlimits ändern, eine abgelaufene Kontositzung wiederherstellen oder garantieren, dass ein Anbieter die Anfrage akzeptiert.

## Wenn die Aufnahme oder Transkription fehlschlägt

- **Could not access microphone** bedeutet, dass GPT-Voice keinen Audiostream abrufen konnte. Überprüfen Sie das Betriebssystem
  Geben Sie die Datenschutzerlaubnis für das Mikrofon ein, bestätigen Sie, dass ein Mikrofon angeschlossen ist, und starten Sie dann eine neue Aufnahme.
- **Transcription failed** bedeutet, dass der Anbieter ein erfolgloses Ergebnis zurückgegeben hat. Überprüfen Sie das Anbieterkonto, das Netzwerk usw.
  Informieren Sie sich vor einem erneuten Versuch über die Verfügbarkeit des Dienstes und die geltenden Grenzwerte.
- **Transcription error** bedeutet, dass GPT-Voice die Vorbereitung oder die Anfrage nicht abschließen konnte. Die Fehlerbenachrichtigung und
  Der Status Command Dock stellt die sichere, für den Benutzer sichtbare Fehlermeldung bereit. Der fehlerhafte Text wird nicht in die Zwischenablage kopiert.
- Wenn eine ChatGPT Web-Sitzung abgelaufen ist, verbinden Sie sie erneut, bevor Sie es erneut versuchen. Wenn ein OpenAI API-Schlüssel fehlt oder abgelehnt wird,
  Korrigieren Sie es in den Anbietereinstellungen, bevor Sie es erneut versuchen.

Das Abbrechen einer aktiven Aufzeichnung unterscheidet sich von einer fehlgeschlagenen Übermittlung: Durch das Abbrechen wird die Aufnahme verworfen, bevor sie erfolgt
vorbereitet oder gesendet, daher gibt es für diese Aufnahme keine wiederholbare Transkription.
