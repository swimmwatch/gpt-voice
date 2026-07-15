# Datenschutz und Daten

GPT-Voice verwaltet Sprache, ausgewählten Text, Anmeldeinformationen und Browsereinstellungen. Auf dieser Seite werden die aktuellen Datenpfade erläutert
und die verfügbaren Steuerelemente zum Entfernen von Daten. Sie ersetzen nicht die Datenschutzrichtlinien oder Bedingungen der von Ihnen gewählten Dienste
verwenden.

## Datenflüsse

GPT-Voice sendet Daten nur dann außerhalb Ihres Computers, wenn Sie eine Funktion nutzen, die von einem externen Dienst unterstützt wird:

| Funktion                          | Gesendete Daten                                                          | Ziel                                          |
| --------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| Transkription mit **ChatGPT Web** | Die vorbereitete Aufnahme                                                | ChatGPT über Ihre angemeldete Browsersitzung  |
| Transkription mit **OpenAI API**  | Die vorbereiteten Aufnahme- und konfigurierten Transkriptionsoptionen    | OpenAIs Audio-Transkriptions-Endpunkt         |
| **Translate**                     | Der ausgewählte Text                                                     | Google Translate                              |
| **Prettify**                      | Der ausgewählte Text und Ihre konfigurierte Prettify-Eingabeaufforderung | Ihr konfigurierter Ollama- oder vLLM-Endpunkt |

Verwenden Sie vertrauenswürdige Konten und Endpunkte und lesen Sie deren Datenverarbeitungsbedingungen. Ein lokaler Loopback-Endpunkt Ollama oder vLLM.
hält die Anfrage auf dem Computer, auf dem dieser Dienst ausgeführt wird; Ein entfernter Endpunkt empfängt den Text. Verwenden Sie HTTPS für a
Prettify-Endpunkt ohne Loopback. Browserbasierte Dienste können den in den [Netzwerkeinstellungen](settings/network.md) konfigurierten Proxy verwenden.

GPT-Voice schreibt erfolgreiche Transkriptions-, Übersetzungs- und Prettify-Ergebnisse in die Systemzwischenablage. Der Betrieb
System- und andere Anwendungen mit Zugriff auf die Zwischenablage können diesen Wert behalten oder lesen. Löschen Sie es oder ersetzen Sie es nach dem Einfügen
empfindliche Ausgabe.

## Lokale Daten und temporärer Speicher

| Daten                                 | Wo und wie lange wird es aufbewahrt                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Erfolgreiche Transkriptionsgeschichte | Lokale SQLite-Daten unter `gpt-voice.sqlite3`, mit der Anforderungszeit, der Anbieter-ID und dem Namen sowie dem Transkriptionstext. Der aufgenommene Ton wird nicht gespeichert.                                   |
| Wiederholbare Aufnahme                | Nach einer fehlgeschlagenen Transkription bleibt das zuletzt vorbereitete Audio nur im Speicher der laufenden Anwendung erhalten. Wenn Sie eine neue Aufnahme starten oder GPT-Voice neu starten, wird es entfernt. |     | Ergebniscache verschönern | Bis zu 20 Ergebnisse werden bis zu 60 Sekunden lang im Speicher gehalten. Der Cache-Kontext hängt vom ausgewählten Text, der Eingabeaufforderung und den konfigurierten Anbietereinstellungen ab. Es wird entfernt, wenn GPT-Voice beendet wird. |
| Einstellungen und Browseridentität    | Wird in den lokalen Anwendungsdaten von GPT-Voice gespeichert und für spätere Starts verwendet.                                                                                                                     |
| ChatGPT Web Authentifizierung         | Lokale Browsersitzungs- und Authentifizierungsdaten. Verwenden Sie das Provider-Steuerelement, um es zu löschen.                                                                                                    |

Aktionen für ausgewählten Text lesen und ersetzen vorübergehend den Inhalt der Zwischenablage, während sie eine Auswahl sammeln. Wenn Übersetzung bzw
Prettify schlägt fehl oder wird abgebrochen. GPT-Voice stellt den vor der Aktion erfassten Zwischenablagewert wieder her. Auf Erfolg, die
Das Ergebnis verbleibt in der Zwischenablage und kann von Ihnen eingefügt werden.

## Anmeldeinformationen und Verschlüsselungsqualifikationen

OpenAI API-Schlüssel, vLLM API-Schlüssel und HTTP/HTTPS-Proxy-Passwörter werden dabei über Electron safe storage gespeichert
Schutz vorhanden ist. GPT-Voice gibt diese gespeicherten Werte nicht in ihre Einstellungsansichten zurück. Wenn sichere Lagerung ist
nicht verfügbar, GPT-Voice kann über dieses Steuerelement kein neues Geheimnis speichern.

Dabei handelt es sich nicht um einen pauschalen Verschlüsselungsanspruch für jede Datei im Anwendungsdatenverzeichnis. Insbesondere Transkription
Verlauf, normale Einstellungen und ChatGPT Web Sitzungsdaten haben ihr eigenes lokales Speicherverhalten. Geben Sie keine API-Schlüssel weiter.
Proxy-Passwörter, Sitzungsinformationen, diktierter Text oder Screenshots, die diese enthalten.

## Daten entfernen oder zurücksetzen

Wählen Sie die schmalste Steuerung, die Ihren Anforderungen entspricht:

1. Verwenden Sie im Verlaufsfenster **Clear history**, um alle gespeicherten Transkriptionseinträge dauerhaft zu entfernen. Siehe
   [Verlauf und Fach](guides/history-and-tray.md).
2. Verwenden Sie in den Transkriptionsanbieter-Steuerelementen **Clear session** für ChatGPT Web oder **Clear API key** für OpenAI API.
   Siehe [Anbietereinstellungen](settings/providers.md).
3. Verwenden Sie das Steuerelement **Clear API key** in den [Einstellungen verschönern](settings/prettify.md) und das Steuerelement Passwort **Clear**.
   in den [Netzwerkeinstellungen](settings/network.md), sofern zutreffend.
4. Ersetzen oder löschen Sie die Zwischenablage des Systems separat, wenn sie Ausgaben enthält, die Sie nicht mehr einfügen möchten.
5. Für einen vollständigen lokalen Reset beenden Sie GPT-Voice aus der Taskleiste und entfernen Sie das beibehaltene Anwendungsdatenverzeichnis:
   `%APPDATA%\GPT-Voice` unter Windows oder `~/.config/GPT-Voice` unter Linux. Dadurch wird die lokale Anwendungsverwaltung entfernt
   Einstellungen, Verlauf und gespeicherte Anbieterdaten und erfordert eine erneute Einrichtung nach einer Neuinstallation oder einem Neustart.

Das Entfernen lokaler Daten ist unumkehrbar. Allein durch die Deinstallation der Anwendung bleiben diese Verzeichnisse absichtlich erhalten; siehe
[installieren, aktualisieren oder entfernen](install.md) für das plattformspezifische Deinstallationsverhalten.

## Verwandte Anleitungen

- [Aufzeichnen und Transkribieren](guides/transcription.md) erklärt die temporäre wiederholbare Audio- und Anbieterübermittlung.- [Ausgewählten Text übersetzen und verschönern](guides/text-actions.md) erklärt die Wiederherstellung der Zwischenablage und Remote-Textaktionen.
- [Transkriptionsanbieter auswählen und verwalten](guides/providers.md) erklärt Anbieterkonten und -sitzungen.
