# Häufig gestellte Fragen

## Transkribiert GPT-Voice Sprache selbst?

Nein. GPT-Voice ist eine Desktop-Anwendung, die eine Aufzeichnung an den von Ihnen ausgewählten Transkriptionsanbieter sendet: ChatGPT Web
über Ihre angemeldete Browsersitzung oder OpenAI API über Ihren eigenen API-Schlüssel. Anbieterverfügbarkeit, Abrechnung,
Kontingente und Bedingungen werden von diesem Anbieter kontrolliert. Siehe [Transkriptionsanbieter auswählen und verwalten](guides/providers.md).

## Was verlässt meinen Computer?

Durch das Stoppen einer Aufnahme werden vorbereitete Audiodaten an den ausgewählten Transkriptionsanbieter gesendet. Die Übersetzung sendet den ausgewählten Text an
Google Translate. Prettify sendet ausgewählten Text und die konfigurierte Eingabeaufforderung an Ihren Ollama- oder vLLM-Endpunkt. Siehe
[Datenschutz und Daten](privacy.md) für den vollständigen Datenfluss und die Details zur lokalen Aufbewahrung.

## Gibt GPT-Voice das Ergebnis in meine Anwendung ein?

Nein. Erfolgreiche Transkriptions-, Übersetzungs- und Prettify-Ergebnisse werden in die Zwischenablage des Systems kopiert. Fügen Sie das Ergebnis ein
wo Sie es brauchen. Siehe [Aufzeichnen und Transkribieren](guides/transcription.md) und
[Ausgewählten Text übersetzen und verschönern](guides/text-actions.md).

## Kann ich GPT-Voice ohne einen OpenAI API-Schlüssel verwenden?

Ja. ChatGPT Web verwendet eine angemeldete ChatGPT-Browsersitzung anstelle eines API-Schlüssels. Es ist vom OpenAI API getrennt.
Anbieter und dessen Kontoanforderungen. Siehe [Anbietereinstellungen](settings/providers.md).

## Kann GPT-Voice vollständig offline arbeiten?

Nicht für Transkription oder Übersetzung: Diese Funktionen nutzen den ausgewählten Remote-Dienst. Prettify kann einen lokalen verwenden
Ollama- oder vLLM-Endpunkt, wenn Sie diesen Dienst auf demselben Computer ausführen, GPT-Voice ihn jedoch nicht installiert oder betreibt
Endpunkt für Sie. Siehe [Einstellungen verschönern](settings/prettify.md).

## Welche Plattformen werden unterstützt?

Aktuelle Versionen unterstützen Windows und Linux über die Windows-Installer-, Deb-, RPM- und AppImage-Pakete. macOS
Veröffentlichungen werden angehalten, während die Unterzeichnung und Beglaubigung vorbereitet wird. Siehe [Installieren, Aktualisieren oder Entfernen](install.md).

## Werden durch ein Update oder eine Deinstallation meine Einstellungen gelöscht?

Nein. Die normalen Deinstallationspfade behalten absichtlich lokale Anwendungsdaten bei, einschließlich Einstellungen und gespeicherter Anbieterdaten.
Verwenden Sie die Anweisungen zum Entfernen in [Datenschutz und Daten](privacy.md), wenn Sie diese Daten absichtlich zurücksetzen möchten.

## Warum wurde meine Verknüpfung oder meine Textauswahlaktion nicht ausgeführt?

Stellen Sie sicher, dass die Aktion aktiviert ist, ihre Verknüpfung gespeichert ist und nicht eine andere Anwendung denselben Schlüssel reserviert hat
Kombination. Übersetzung und Prettify werden nacheinander ausgeführt und warten, bis eine Aufzeichnung beendet ist. Siehe
[Verknüpfungseinstellungen](settings/shortcuts.md) und [Fehlerbehebung](troubleshooting.md).

## Kann ich einen Proxy verwenden?

Ja. GPT-Voice kann einen HTTP-, HTTPS- oder SOCKS5-Proxy an seine Browserkontexte übergeben. SOCKS5-Anmeldeinformationen werden nicht unterstützt.
und Proxy GeoIP kann die Kontrolle über das Gebietsschema und die Zeitzone des Browsers übernehmen. Siehe [Netzwerkeinstellungen](settings/network.md).

## Wie lösche ich ein Transkript, eine Sitzung oder einen Schlüssel?Verwenden Sie **Clear history** im Verlaufsfenster für gespeicherte Transkriptionen. Nutzen Sie die klare Kontrolle des jeweiligen Anbieters für a

ChatGPT-Sitzung, OpenAI API-Schlüssel, vLLM-Schlüssel oder Proxy-Passwort. Den genauen Geltungsbereich finden Sie unter [Datenschutz und Daten](privacy.md).
jedes Zurücksetzens.
