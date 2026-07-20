# Fehlerbehebung

Beginnen Sie mit der sichtbaren Statusmeldung und der von Ihnen verwendeten Funktion. Fügen Sie keine API-Schlüssel, Proxy-Passwörter usw. ein.
ChatGPT Sitzungsdaten, diktierter Text, ausgewählter Text oder Screenshots, die diese enthalten, in eine Supportanfrage. Ein nützliches
Der sichere Bericht enthält die Version GPT-Voice, das Betriebssystem, den Pakettyp, die Funktion, die genaue nicht vertrauliche Nachricht usw
Schritte, die das Problem reproduzieren.

## Mikrofon kann nicht gestartet werden

Wenn Command Dock **Could not access microphone** anzeigt:

1. Stellen Sie sicher, dass ein Mikrofon angeschlossen und für andere Anwendungen verfügbar ist.
2. Erlauben Sie GPT-Voice in den Datenschutzeinstellungen Ihres Betriebssystems, das Mikrofon zu verwenden.
3. Schließen Sie andere Software, die die ausschließliche Kontrolle über das Gerät hat, und starten Sie dann eine neue Aufnahme.
4. Wenn sich das Gerät geändert hat, während GPT-Voice geöffnet war, schließen Sie es erneut an und starten Sie GPT-Voice neu, bevor Sie es erneut versuchen.

Es wird kein Audio gesendet, bis GPT-Voice eine Aufnahme gestartet hat und Sie sie stoppen. Für die Aufnahmesteuerung und das Wiederholungslimit:
siehe [Aufzeichnen und Transkribieren](guides/transcription.md).

## ChatGPT Web Sitzung ist getrennt

Wenn **ChatGPT Web** nicht **Connected** ist, wird ein Browser-Anmeldefenster nicht beendet oder die Sitzung ist abgelaufen:

1. Überprüfen Sie, ob der Computer ChatGPT erreichen kann und ob das Konto den Dienst nutzen darf.
2. Wählen Sie **Connect** und schließen Sie die Anmeldung im Browserfenster GPT-Voice ab.
3. Wenn die gespeicherte Sitzung nicht mehr gültig ist, verwenden Sie **Clear session**, bestätigen Sie sie und melden Sie sich erneut an.
4. Wenn die Browser-Initialisierung oder die Verbindung immer noch fehlschlägt, testen Sie vorübergehend ohne Proxy und überprüfen Sie dann den Browser
   und Netzwerkeinstellungen unten.

Durch das Löschen einer Sitzung wird die gespeicherte lokale Sitzung von GPT-Voice entfernt. Das Konto oder die Sitzungen werden dadurch nicht geändert
Browser. Siehe [Anbietereinstellungen](settings/providers.md).

## OpenAI API Transkription schlägt fehl

Überprüfen Sie für **OpenAI API**, ob der Anbieter ausgewählt und mit Ihrem eigenen gültigen API-Schlüssel konfiguriert ist. Bestätigen Sie das
Überprüfen Sie die Abrechnung, das Kontingent, die Nutzungsbeschränkungen und den Dienststatus des Anbieterkontos, speichern Sie dann alle Korrekturen und versuchen Sie es erneut
Aufnahme, sofern diese noch verfügbar ist. GPT-Voice verwendet das feste Transkriptionsmodell `whisper-1`; es gibt kein Modell
Auswahl zur Reparatur für diesen Anbieter.

Lassen Sie einen vorhandenen gespeicherten Schlüssel aus Berichten und Screenshots weg. Wenn Sie es ersetzen müssen, geben Sie den neuen Schlüssel ein und speichern Sie; verwenden
**Clear API key**, wenn Sie möchten, dass GPT-Voice es vergisst. Siehe [Anbietereinstellungen](settings/providers.md) und
[Anbieter](guides/providers.md).

## Prettify kann ein Modell nicht erreichen

Bevor Prettify ausgewählten Text verarbeiten kann, müssen sein Anbieter, Endpunkt und Modell gültig sein:

1. Wählen Sie unter **Settings** > **Prettify** den gewünschten Anbieter aus: Ollama oder vLLM.
2. Stellen Sie sicher, dass der lokale oder Remote-Dienst ausgeführt wird und von diesem Computer aus erreichbar ist.
3. Überprüfen Sie die Anbieteradresse und den Modellnamen und verwenden Sie dann **Load model**, wenn das ausgewählte Modell nicht bereit ist.
4. Geben Sie für vLLM nur dann einen API-Schlüssel an, wenn dieser Endpunkt einen erfordert. Verwenden Sie für einen Remote-Endpunkt HTTPS und bestätigen Siedass Sie den ausgewählten Text dorthin senden dürfen.
5. Speichern Sie gültige Einstellungen, bevor Sie die Verknüpfung erneut ausführen.

GPT-Voice installiert oder betreibt weder Ollama noch vLLM. Siehe [Einstellungen verschönern](settings/prettify.md) für das Feld
Anforderungen und [Textaktionen](guides/text-actions.md) für ausgewählte Textbeschränkungen und Stornierung.

## Proxy- oder Browserdienst kann keine Verbindung herstellen

ChatGPT Web und Übersetzung verwenden GPT-Voice Browserkontexte. Wenn einer der Dienste ohne den Proxy funktioniert, aber nicht mit ihm:

1. Schalten Sie **Proxy enabled** vorübergehend aus und speichern Sie die Einstellung, um den Proxy vom Dienst zu isolieren.
2. Wenn Sie es erneut aktivieren, verwenden Sie eine erreichbare Server-URL `http://`, `https://` oder `socks5://` und geben Sie HTTP/HTTPS ein
   Referenzen in ihren jeweiligen Fachgebieten.
3. Entfernen Sie SOCKS5-Anmeldeinformationen: CloakBrowser unterstützt sie nicht.
4. Wenn **GeoIP** aktiviert ist, denken Sie daran, dass es das Gebietsschema und die Zeitzone des Browsers steuert. Schalten Sie GeoIP aus, um die Speicherung zu testen
   Browser-Identitätswerte direkt.

Versuchen Sie es bei einem Browser-Laufzeitfehler zunächst erneut, nachdem das Netzwerk stabil ist, und testen Sie dann den Proxy wie oben beschrieben. Legen Sie **Hintergrund fest
Browser** to **Vorübergehend sichtbar**, wenn Sie den Browserkontext beobachten müssen, während Sie das Problem reproduzieren; wiederherstellen
danach die übliche **Hidden**-Einstellung. Siehe [Browsereinstellungen](settings/browser.md) und
[Netzwerkeinstellungen](settings/network.md).

## Eine Verknüpfung wird nicht ausgeführt

Öffnen Sie **Settings** > **Shortcuts** und bestätigen Sie, dass die Aktion aktiviert ist. Die angezeigte Verknüpfung ist diejenige, die Sie drücken.
und die Änderung wurde gespeichert. GPT-Voice lehnt Konflikte zwischen seinen eigenen Verknüpfungen, aber einer anderen Anwendung oder dem ab
Das Betriebssystem kann immer noch die gleiche Kombination reservieren.

Wählen Sie eine andere Verknüpfung, speichern Sie sie und versuchen Sie es erneut, während GPT-Voice inaktiv ist. Aktionen mit ausgewähltem Text warten ebenfalls, bis ein
Die aktive Aufzeichnung endet und Übersetzung und Prettify können nicht gleichzeitig ausgeführt werden. Siehe
[Verknüpfungseinstellungen](settings/shortcuts.md).

## Zwischenablage oder ausgewählter Text wurden nicht angezeigt

Warten Sie bei einer Transkription mit dem Einfügen **Copied to clipboard** ab. Eine fehlgeschlagene Transkription wird nicht kopiert. Für
Übersetzen oder Verschönern: Wählen Sie Text in der Quellanwendung aus, bevor Sie die Aktionsverknüpfung drücken. Prettify akzeptiert
bis zu 16.000 Zeichen.

Bei einem Fehler oder Abbruch stellt GPT-Voice den Zwischenablagewert wieder her, den es vor der Aktion „Ausgewählter Text“ erfasst hat. A
Erfolgreiches Ergebnis ersetzt die Zwischenablage. Stellen Sie sicher, dass die Quellanwendung normale Kopiervorgänge zulässt. unter Linux,
GPT-Voice kann auch die Auswahlzwischenablage verwenden, wenn die normale Kopierautomatisierung fehlschlägt. Siehe
[Ausgewählten Text übersetzen und verschönern](guides/text-actions.md).

## Installations-, Update- oder Startproblem

Laden Sie nur das Paket aus der offiziellen GitHub-Version herunter, das zu Ihrer Plattform passt, und vergleichen Sie den SHA-256-Wert
mit der beiliegenden Prüfsummendatei. Führen Sie das Windows-Installationsprogramm erneut aus, um eine vorhandene Installation zu aktualisieren. Unter Linux verwenden Sie
Verwenden Sie den dokumentierten Paketmanager-Befehl für Deb- oder RPM-Pakete oder machen Sie das AppImage ausführbar, bevor Sie es ausführen.Es gibt kein unterstütztes macOS-Paket, während die Unterzeichnung und die Beglaubigung angehalten sind. Wenn GPT-Voice nach einem nicht startet
Starten Sie die Installation oder das Update, starten Sie den Computer neu, versuchen Sie es erneut mit dem verifizierten Paket und überprüfen Sie, ob die normale Desktop-Laufzeit funktioniert
Abhängigkeiten sind vorhanden. Löschen Sie gespeicherte Bewerbungsdaten nicht als ersten Schritt; Es enthält Einstellungen und gespeicherte Daten
Anbieterdaten. Befolgen Sie [Installieren, Aktualisieren oder Entfernen](install.md) für das genaue Paket- und Entfernungsverfahren.

## Wenn das Problem weiterhin besteht

Versuchen Sie es mit der kleinsten sicheren Reproduktion: einer kurzen, nicht sensiblen Aufnahme, einem nicht sensiblen ausgewählten Textbeispiel oder einem
temporäre Proxy-Off-Prüfung. Notieren Sie Version, Plattform, Paket, Konfigurationsbereich und sichtbare Fehler, ohne sie zu kopieren
Anmeldeinformationen oder private Inhalte. Die oben genannten zugehörigen Leitfäden beschreiben das unterstützte Verhalten und die verfügbare Wiederherstellung
Kontrollen.
