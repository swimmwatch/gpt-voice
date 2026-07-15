# Übersicht über die Einstellungen

Öffnen Sie **Settings** im Taskleistenmenü GPT-Voice. Das Fenster „Einstellungen“ wird am **Shortcuts** geöffnet und besteht aus vier Abschnitten:

| Abschnitt                   | Verwenden Sie es, um                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Shortcuts**               | Wählen Sie die globalen Verknüpfungen zum Aufzeichnen, Stoppen, Abbrechen, Übersetzen, Verschönern und Wiederholen einer Transkription. |
| **[Prettify](prettify.md)** | Wählen Sie den Textverarbeitungsanbieter Ollama oder vLLM und konfigurieren Sie dessen Modell und Generierungsverhalten.                |
| **[Browser](browser.md)**   | Konfigurieren Sie die Browseridentität und das Hintergrundverhalten, die GPT-Voice für seine browserbasierten Dienste verwendet.        |
| **[Network](network.md)**   | Konfigurieren Sie den Proxy, der von diesen browserbasierten Diensten verwendet wird.                                                   |

Die Abschnittsschaltflächen bleiben in schmalen Fenstern als Symbole mit zugänglichen Beschriftungen verfügbar. Wählen Sie einen Abschnitt aus, um seine Einstellungen zu ändern; Jede Seite beschreibt ihre eigenen Felder und Voraussetzungen.

## Änderungen speichern

Beim Öffnen des Fensters werden die Einstellungen aus der gespeicherten Anwendungskonfiguration geladen. Das Ändern eines Werts markiert das Formular mit **Unsaved changes**. Die Schaltfläche **Save changes** ist erst verfügbar, nachdem mindestens eine Änderung vorgenommen wurde und alle aktuellen Feldwerte gültig sind. Es bleibt deaktiviert, während GPT-Voice speichert.

Wenn ein Wert seine Anforderungen nicht erfüllt, wird im betroffenen Feld eine Validierungsmeldung angezeigt und das Speichern wird blockiert, bis Sie ihn korrigieren. Wenn ein Speichervorgang selbst fehlschlägt, bleiben die Einstellungen geöffnet und zeigen eine Fehlermeldung an, damit Sie das Problem beheben oder es erneut versuchen können. Bei einem erfolgreichen Speichern wird die gespeicherte Konfiguration aktualisiert und das Fenster „Einstellungen“ geschlossen.

## Schließen, ohne versehentlich Arbeit zu verlieren

Wenn Sie die Einstellungen ohne nicht gespeicherte Änderungen schließen, wird es sofort geschlossen. Wenn nicht gespeicherte Änderungen vorhanden sind, werden Sie von GPT-Voice gefragt, ob Sie diese verwerfen möchten. Wählen Sie **Keep editing**, um zum Formular zurückzukehren, oder **Discard changes**, um die Einstellungen zu schließen, ohne die ausstehenden Änderungen zu speichern. Während ein Speichervorgang läuft, ist das Schließen der Einstellungen blockiert, bis der Vorgang beendet ist.

Diese Bestätigung gilt für das Einstellungsformular. Das Erfassen einer neuen globalen Verknüpfung ist eine separate Aktion: GPT-Voice hält globale Verknüpfungen vorübergehend an, während es auf die Tastenkombination wartet, und setzt sie dann fort, wenn die Erfassung abgeschlossen oder abgebrochen ist.
