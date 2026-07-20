# Transkriptionsverlauf und Fach

GPT-Voice speichert einen lokalen Verlauf erfolgreicher Transkriptionen, sodass Sie ein Ergebnis wiederverwenden können, nachdem es die Zwischenablage verlassen hat.
Die Taskleiste ermöglicht den Zugriff auf die Anwendung, wenn das Hauptfenster ausgeblendet ist.

## Transkriptionsverlauf wiederverwenden

Öffnen Sie das Taskleistenmenü und wählen Sie **History**. Jede erfolgreiche Transkription wird lokal mit ihrem Anforderungszeitpunkt gespeichert.
Anbietername und Text. Der Verlauf wird in den lokalen SQLite-Daten der Anwendung gespeichert; Die aufgezeichneten Daten werden nicht gespeichert
Audio. Da Einträge vertraulichen diktierten Text enthalten können, behandeln Sie den Verlauf wie jedes andere lokale Dokument.

Die neuesten Einträge erscheinen zuerst. Der Verlauf wird beim Scrollen nach und nach geladen, sodass kein langer Verlauf geladen werden muss
eine Bitte. Das Fenster zeigt Lade-, Wiederholungs- und Sicherheitsfehlermeldungen an, wenn die nächste Seite nicht abgerufen werden kann.

Um einen Eintrag wiederzuverwenden, wählen Sie dessen Textkarte aus. GPT-Voice kopiert den gespeicherten Text dieses Eintrags kurzzeitig in die Zwischenablage des Systems
zeigt **Copied**. Der Text wird nicht erneut zur Transkription eingereicht. Wenn das Kopieren fehlschlägt oder bereits ein Eintrag vorhanden ist
Wenn das Protokoll entfernt wurde, meldet das Verlaufsfenster den Fehler, anstatt die Zwischenablage zu ändern.

## Lokalen Verlauf löschen

Verwenden Sie **Clear history** im Verlaufsfenster und bestätigen Sie den Dialog, um alle gespeicherten Transkriptionseinträge zu löschen. Dies
Aktion klärt die lokale Geschichte; Es kann nicht von GPT-Voice rückgängig gemacht werden. Neue erfolgreiche Transkriptionen erzeugen neue Einträge
danach.

Wenn Sie im Rahmen der Deinstallation von GPT-Voice alle gespeicherten Anwendungsdaten entfernen möchten, befolgen Sie die plattformspezifischen Anweisungen
Anweisungen in [Installieren, Aktualisieren oder Entfernen](../install.md).

## Benutzen Sie das Tablett

Wenn Sie das Hauptfenster GPT-Voice schließen, wird es ausgeblendet, anstatt die Anwendung zu beenden. Die Anwendung läuft weiterhin im
in der Taskleiste, sodass die konfigurierten globalen Verknüpfungen weiterhin verfügbar bleiben. Wählen Sie das Taskleistensymbol aus, um das sichtbare Hauptfenster zu fokussieren
oder zeigen Sie es an, wenn es ausgeblendet ist.

Das Taskleistenmenü bietet folgende Aktionen:

| Menüaktion         | Ergebnis                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Show GPT-Voice** | Zeigt und fokussiert das Hauptfenster oder erstellt es bei Bedarf.                                                   |
| **Settings**       | Öffnet das Fenster „Einstellungen“.                                                                                  |
| **History**        | Öffnet den lokalen Transkriptionsverlauf.                                                                            |
| **About**          | Öffnet das Info-Fenster.                                                                                             |
| **Quit**           | Beendet GPT-Voice. Verwenden Sie dies, wenn Sie die Anwendung stoppen möchten, anstatt nur das Fenster auszublenden. |

Das Taskleistensymbol spiegelt die aktuelle Aktivität wider: inaktiv, Aufnahme, angehalten, Transkriptverarbeitung oder Verschönern. Es ist einAnzeige- und Navigationspunkt; Die Aufnahmesteuerung bleibt über Command Dock verfügbar und kann konfiguriert werden
Abkürzungen.
