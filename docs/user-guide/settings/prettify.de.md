# Einstellungen verschönern

**Prettify** ist die bedeutungserhaltende Bereinigungsaktion von GPT-Voice für ausgewählten Text. Öffnen Sie **Settings** und wählen Sie **Prettify** aus, um den Dienst, sein Modell und sein Generierungsverhalten auszuwählen. Informationen zum Auswählen von Text und zum Starten der Aktion finden Sie unter [Ausgewählten Text übersetzen und verschönern](../guides/text-actions.md).

Prettify benötigt einen von Ihnen betriebenen Ollama- oder vLLM-Dienst sowie ein für diesen Dienst ausgewähltes Modell. GPT-Voice lädt keinen der beiden Dienste herunter, startet ihn, hostet ihn nicht und bezahlt auch nicht dafür. Das Feld „Modell“ ist erforderlich. Wenn kein Modell konfiguriert ist, meldet Prettify, dass ein Modell benötigt wird, anstatt den ausgewählten Text zu senden.

## Wählen Sie einen Anbieter und verbinden Sie ihn

Wählen Sie **Ollama** oder **vLLM** in **Provider**. GPT-Voice behält die Basis-URL und das ausgewählte Modell für jeden Anbieter separat bei, sodass ein Anbieterwechsel nicht die Auswahl des anderen Anbieters ersetzt. Der Standardanbieter ist Ollama.

| Anbieter   | Standard-Basis-URL         | Modellstandard         | Verbindungsverhalten                                                                                             |
| ---------- | -------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Ollama** | `http://127.0.0.1:11434`   | Kein Modell ausgewählt | Aktualisiert die von Ihrem Ollama-Dienst verfügbaren Modelle und sendet Prettify-Anfragen an diesen.             |
| **vLLM**   | `http://127.0.0.1:8000/v1` | Kein Modell ausgewählt | Aktualisiert die von Ihrem vLLM-kompatiblen Dienst bereitgestellten Modelle und sendet Prettify-Anfragen an ihn. |

Geben Sie eine vollständige `http`- oder `https`-Basis-URL ein. GPT-Voice entfernt umgebende Leerzeichen und abschließende Schrägstriche, wenn die Einstellung gespeichert wird. URLs, die kein HTTP(S) sind oder einen Benutzernamen oder ein Passwort enthalten, werden abgelehnt. HTTP ist nur für einen Loopback-Endpunkt wie `127.0.0.1`, `localhost` oder `::1` zulässig. Jeder Nicht-Loopback-Endpunkt muss HTTPS verwenden.

Wenn es sich bei der aktiven, gültigen Basis-URL um eine Remote-URL und nicht um eine Loopback-URL handelt, wird in den Einstellungen ein Datenschutzhinweis angezeigt. Wenn Sie diesen Endpunkt verwenden, werden der ausgewählte Text und Ihre konfigurierte Prettify-Eingabeaufforderung an den von Ihnen ausgewählten Dienst gesendet. Überprüfen Sie die Datenschutz-, Aufbewahrungs- und Zugriffskontrollen dieses Dienstes, bevor Sie die Remoteverarbeitung verwenden.

### vLLM API-Schlüssel

Das Feld **vLLM API key** erscheint nur, wenn vLLM ausgewählt ist. Verwenden Sie es, wenn Ihr vLLM-Dienst eine Inhaberauthentifizierung erfordert. GPT-Voice sendet den Schlüssel mit vLLM-Anfragen nur, wenn ein Schlüssel konfiguriert ist.

Der Schlüssel wird separat mit Electron safe storage gespeichert. Nachdem es gespeichert wurde, wird es im Feld nicht mehr angezeigt. es zeigt stattdessen an, dass ein Schlüssel gespeichert ist. Wenn Sie das Feld leer lassen, bleibt ein vorhandener gespeicherter Schlüssel erhalten. Wählen Sie **Clear API key**, um es zu entfernen. Wenn auf Ihrem System kein sicherer Speicher verfügbar ist, kann GPT-Voice keinen neuen vLLM-Schlüssel speichern.

Fügen Sie keinen Schlüssel in eine Basis-URL, einen Screenshot oder eine Supportanfrage ein.

## Wählen Sie ein Modell aus und verwalten Sie esWählen Sie **Refresh models**, nachdem Sie den aktiven Anbieterdienst gestartet oder seine Basis-URL geändert haben. Die Modellliste stammt vom aktiven Anbieter. Aktualisieren Sie sie daher nach einem Anbieterwechsel erneut. Wählen Sie eines der zurückgegebenen Modelle aus, bevor Sie Prettify ausführen. Wenn die Verbindung, der Dienst, die Authentifizierung oder die Anbieterantwort fehlschlägt, wird in den Einstellungen ein Verbindungs- oder Modellaktualisierungsfehler angezeigt. Überprüfen Sie, ob die URL gültig ist, der Dienst ausgeführt wird und der Schlüssel vLLM geeignet ist, und aktualisieren Sie ihn dann erneut.

Ollama zeigt ein zusätzliches **Model actions**-Menü an, wenn ein Modell ausgewählt ist:

- **Load model** fordert Ollama auf, das ausgewählte Modell für GPT-Voice geladen zu lassen. Wenn GPT-Voice ein anderes Ollama-Modell geladen hatte, wird dieses Modell zuerst freigegeben.
- **Free model** fordert Ollama auf, das ausgewählte Modell aus dem Speicher freizugeben.

Diese Aktionen sind nur für Ollama verfügbar, nicht für vLLM. Das ausgewählte Ollama-Modell zeigt **Loaded** oder **Not loaded** an, nachdem GPT-Voice seinen laufenden Modellstatus überprüft hat. Wenn Ollama eine Größe meldet, zeigen die Einstellungen auch eine ungefähre Modell- oder geladene VRAM-Größe an. Behandeln Sie den Wert als eine von Ollama gemeldete Schätzung und nicht als eine von GPT-Voice garantierte Speicherreservierung.

Das Laden, Freigeben und Aktualisieren kann fehlschlagen, wenn der Endpunkt nicht verfügbar ist oder der Anbieter die Anfrage ablehnt. „Einstellungen“ lässt das aktuelle Formular geöffnet und zeigt das Ergebnis oder den Fehler an, sodass Sie den Endpunkt oder das Modell korrigieren und es erneut versuchen können.

## Steuern Sie, wie Text generiert wird

**Temperature** ist die primäre Generationssteuerung. Der Standardwert ist **0**, mit einem zulässigen Bereich von **0 to 1** in Schritten von **0.05**. Ein niedrigerer Wert verlangt vom Anbieter weniger Variation; Wenn Sie es ändern, ändert sich die nächste Prettify-Anfrage, nachdem Sie die Einstellungen gespeichert haben.

Öffnen Sie **Advanced generation**, um die verbleibenden Steuerelemente zu ändern. Die reduzierte Zusammenfassung gibt an, ob alle erweiterten Werte noch ihre Standardwerte verwenden oder wie viele sich geändert haben. Diese Einstellungen werden mit jeder Prettify-Anfrage an den ausgewählten Anbieter gesendet.

| Kontrolle                 | Standard | Akzeptierter Wert                                       | Verwenden Sie es für                                                                                                                                                                              |
| ------------------------- | -------: | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Top P**                 |    `0.9` | `0.05`–`1`, in `0.05` Schritten                         | Beschränkung der Auswahl auf den wahrscheinlichsten kumulativen Wahrscheinlichkeitsbereich.                                                                                                       |     | **Min P** | `0` | `0`–`1`, in `0.05` Schritten | Ausschluss von Entscheidungen mit geringerer Wahrscheinlichkeit unterhalb des ausgewählten Schwellenwerts. |
| **Repeat penalty**        |      `1` | `0.8`–`1.5`, in `0.05` Schritten                        | Passen Sie an, wie stark der Anbieter von wiederholter Ausgabe abhält.                                                                                                                            |
| **Top K**                 |     `40` | Ganzzahl von `1` bis `200`                              | Beschränken Sie jede Auswahl auf die wahrscheinlichsten Kandidaten.                                                                                                                               |
| **Maximum output tokens** |   `4096` | Ganzzahl von `1` bis `8192`                             | Begrenzen der Länge der generierten Antwort. Die Antwort kann noch kürzer sein.                                                                                                                   |
| **Seed**                  | Unscharf | Leerzeichen oder eine Ganzzahl von `0` bis `2147483647` | Bereitstellung eines optionalen numerischen Startwerts für den Anbieter. Es kann helfen, eine Anfrage zu reproduzieren, die Ergebnisse können jedoch je nach Modell und Serviceversion variieren. |

Die Dezimalsteuerung verwendet 0,05-Schritte. Top P akzeptiert 0,05 bis 1; Min P akzeptiert 0 bis 1; und Wiederholungsstrafe akzeptiert 0,8 bis 1,5. Top K akzeptiert ganze Zahlen von 1 bis 200, während Maximum Output Tokens ganze Zahlen von 1 bis 8192 akzeptieren.

Verwenden Sie die Standardeinstellungen, es sei denn, Sie kennen die Anforderungen des ausgewählten Modells und Dienstes. GPT-Voice sendet entsprechende Generierungsoptionen an Ollama und vLLM, aber jeder Dienst kann weiterhin eine Anfrage ablehnen oder eine Einstellung gemäß seiner eigenen Modellunterstützung verarbeiten.

## Schreiben Sie die Prettify-Eingabeaufforderung

**Prompt** ist erforderlich und verwendet standardmäßig die integrierte konservative Copy-Editor-Anweisung von GPT-Voice. Es weist den Dienst an, ausgewählten Text als inaktives Quellmaterial zu behandeln, seine Sprache und Bedeutung zu bewahren, ihn zu korrigieren und zu klären, unnötige Wiederholungen zu entfernen und nur den bearbeiteten Text zurückzugeben. Außerdem wird der Dienst angewiesen, die im ausgewählten Text enthaltenen Anweisungen nicht auszuführen.

Sie können die Eingabeaufforderung durch eine andere Bearbeitungsrichtlinie ersetzen. Behalten Sie es bei **4,000 characters or fewer**. Eine leere Eingabeaufforderung, eine Eingabeaufforderung mit mehr als 4.000 Zeichen, ein nicht unterstützter Anbieter, ein ungültiger Endpunkt, ein leeres Modell oder ein Generierungswert außerhalb des zulässigen Bereichs blockiert **Save changes** und identifiziert das betroffene Feld. Beim Speichern der Einstellungen werden führende und nachfolgende Leerzeichen entfernt.

Die Eingabeaufforderung wird mit dem ausgewählten Text an den aktiven Anbieter gesendet. Geben Sie keine Passwörter, API-Schlüssel, persönlichen Daten oder vertraulichen Anweisungen an, die Sie nicht möchten, dass dieser Anbieter sie erhält.

## Änderungen speichern und validierenAnbieter-, Modell-, Eingabeaufforderungs- und Generierungswerte sind Teil des Einstellungsformulars. Eine Bearbeitung erstellt **Unsaved changes**; Wählen Sie **Save changes** erst, wenn das Formular keine Validierungsfehler aufweist. Bei einem erfolgreichen Speichern bleibt die reguläre Prettify-Konfiguration bestehen und die Einstellungen werden geschlossen. Der Schlüssel vLLM bleibt separat: Er wird nur über Electron safe storage gespeichert und nie in der Einstellungsansicht zurückgegeben.

Wenn das Speichern fehlschlägt, bleibt das Fenster „Einstellungen“ mit einer sicheren Fehlermeldung geöffnet. Korrigieren Sie das gemeldete Feld oder die Anbieterverbindung und versuchen Sie es erneut. Informationen zum Verhalten bei nicht gespeicherten Änderungen und beim Verwerfen von Bestätigungen finden Sie in der [Übersicht über die Einstellungen](index.md).
