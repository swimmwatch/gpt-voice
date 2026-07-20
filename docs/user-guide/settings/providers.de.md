# Anbietereinstellungen

Wählen Sie den Transkriptionsanbieter im GPT-Voice Command Dock aus. Um den aktuell ausgewählten Anbieter zu konfigurieren, öffnen Sie dessen Steuerelement **Connect** oder **Configure** in der Kopfzeile. Im Anbieterdialog werden nur die Steuerelemente angezeigt, die für diesen Anbieter gelten.

## ChatGPT Web

ChatGPT Web verwendet eine Browsersitzung anstelle eines API-Schlüssels. Im Provider-Dialog wird angezeigt, ob eine Sitzung gespeichert ist.

1. Wählen Sie **ChatGPT Web** im Feld Command Dock.
2. Öffnen Sie das Provider-Dialogfeld und wählen Sie **Log in**, wenn keine Sitzung gespeichert ist, oder **Log in again**, um eine gespeicherte Sitzung zu ersetzen.
3. Schließen Sie die Anmeldung im GPT-Voice-Browserfenster ab und kehren Sie dann zum Command Dock zurück, wenn der Anbieter **Connected** anzeigt.

Verwenden Sie **Clear session**, wenn Sie möchten, dass GPT-Voice die gespeicherte ChatGPT Web-Authentifizierung vergisst. GPT-Voice fordert vor dem Löschen eine Bestätigung an. Durch das Löschen der Sitzung wird die Verbindung zu diesem Anbieter getrennt. Melden Sie sich erneut an, bevor Sie es zur Transkription verwenden.

Einzelheiten zum Kontobesitz, zur Browsersitzung und zum Anbieterlimit finden Sie unter [Anbieter](../guides/providers.md).

## OpenAI API

Wählen Sie **OpenAI API** und öffnen Sie den Anbieterdialog, um diese Felder zu konfigurieren. Verwenden Sie Ihren eigenen OpenAI API-Schlüssel und Ihr eigenes Konto. GPT-Voice stellt keinen Schlüssel, kein Guthaben oder Zugriff auf OpenAI-Dienste bereit.

| Feld            | Aktuelles Verhalten                                                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API key**     | Geben Sie einen neuen Schlüssel ein, um ihn zu speichern. Das Feld ist beim erneuten Öffnen leer, auch wenn ein Schlüssel gespeichert ist, und ein leeres Speichern ersetzt diesen gespeicherten Schlüssel nicht. |
| **Model**       | `whisper-1` ist das einzige verfügbare Transkriptionsmodell. Es wird als schreibgeschütztes Feld angezeigt.                                                                                                       |
| **Language**    | Wählen Sie die automatische Erkennung (Standardeinstellung), Englisch, Russisch, Ukrainisch oder Weißrussisch.                                                                                                    |
| **Prompt**      | Optionale Transkriptionsanleitung. Der Standardwert ist leer; Führende und nachfolgende Leerzeichen werden beim Speichern entfernt.                                                                               |
| **Temperature** | Steuert die Transkriptionsvariation von 0 bis 1. Der Standardwert ist 0; Die Steuerung ändert sich in 0,05-Schritten.                                                                                             |

Wählen Sie **Save**, um die Änderungen zu validieren und zu speichern. Bei erfolgreicher Speicherung wird der Dialog geschlossen. Ungültige Modell-, Sprach- oder Temperaturwerte werden abgelehnt; Wenn das Speichern fehlschlägt, zeigt das Dialogfeld eine sichere Fehlermeldung an und bleibt geöffnet.

## Gespeicherte Anmeldeinformationen und Löschen der Authentifizierung

GPT-Voice speichert einen OpenAI API-Schlüssel nur über Electron safe storage. Der Schlüssel selbst wird im Dialog nicht wieder angezeigt; Der Dialog zeigt stattdessen an, dass ein API-Schlüssel gespeichert ist. Wenn kein sicherer Speicher verfügbar ist, kann GPT-Voice keinen neuen Schlüssel speichern.Verwenden Sie **Clear API key** und bestätigen Sie den Dialog, um den gespeicherten Schlüssel zu entfernen und gleichzeitig die anderen OpenAI API-Einstellungen beizubehalten. Die Schaltfläche ist nur verfügbar, wenn ein Schlüssel gespeichert ist. Sie müssen einen neuen Schlüssel eingeben und speichern, bevor OpenAI API erneut transkribieren kann.

Die Anbieteranmeldeinformationen und die Dienstnutzung unterliegen weiterhin den Bedingungen, der Abrechnung, den Kontingenten und der Datenschutzrichtlinie des Anbieterkontos. Fügen Sie keine Schlüssel in Supportanfragen, Screenshots oder Dokumentationen ein.
