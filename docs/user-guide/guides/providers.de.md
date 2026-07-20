# Wählen und verwalten Sie einen Transkriptionsanbieter

GPT-Voice verwendet jeweils einen aktiven Transkriptionsanbieter. Wählen Sie es aus dem **Provider**-Selektor im Command Dock aus. Durch Umschalten des Selektors wird geändert, welcher Anbieter die nächste Aufnahme erhält; Es werden keine Sitzungen, API-Schlüssel, Abrechnungen oder Kontozugriffe zwischen Anbietern übertragen.

| Anbieter        | Authentifizierung                                    | Wohin Audio gesendet wird              |
| --------------- | ---------------------------------------------------- | -------------------------------------- |
| **ChatGPT Web** | Eine angemeldete ChatGPT Browsersitzung.             | Über die angemeldete ChatGPT-Sitzung.  |
| **OpenAI API**  | Ein von Ihnen bereitgestellter OpenAI API-Schlüssel. | OpenAIs Audio-Transkriptions-Endpunkt. |

Verwenden Sie nur ein Konto, zu dessen Nutzung Sie berechtigt sind. Verfügbarkeit, Abrechnung, Kontingente, Nutzungsbeschränkungen und Servicebedingungen werden durch das Anbieterkonto und den Service festgelegt. GPT-Voice umgeht sie nicht.

## ChatGPT Web

Wählen Sie **ChatGPT Web** und dann **Connect**. GPT-Voice öffnet ein Browser-Anmeldefenster unter ChatGPT. Schließen Sie dort die Anmeldung ab und schließen Sie dann die Anmeldeseite. GPT-Voice speichert die resultierende Browsersitzung lokal und startet seinen Hintergrundbrowser bei späteren Starts, wenn die Sitzung noch verwendbar ist.

Wenn die Sitzung bereit ist, zeigt der Anbieter **Connected** an. Wenn die Sitzung abläuft, entfernt GPT-Voice die nicht verwendbare gespeicherte Sitzung und Sie müssen **Connect** erneut auswählen. Eine Transkriptionsanfrage kann ihr kurzlebiges Zugriffstoken auch einmal aktualisieren; Dies ersetzt nicht eine neue Anmeldung, wenn die zugrunde liegende Sitzung nicht mehr gültig ist.

Um sich von GPT-Voice abzumelden, öffnen Sie die Anbietereinstellungen und verwenden Sie **Clear authentication**. Dadurch werden die gespeicherten ChatGPT Browser-Sitzungsdaten und das zwischengespeicherte Zugriffstoken von GPT-Voice entfernt. Ihr Konto, Ihr Abonnement oder die von anderen Browsern oder Geräten gehaltenen Sitzungen werden nicht verwaltet.

## OpenAI API

Wählen Sie **OpenAI API** und wählen Sie **Configure** oder öffnen Sie die Anbietereinstellungssteuerung neben der Auswahl. Fügen Sie Ihren eigenen API-Schlüssel ein und speichern Sie das Formular. GPT-Voice verwendet das feste Transkriptionsmodell `whisper-1`; Dieser Anbieter kann kein anderes Transkriptionsmodell auswählen.

In den Anbietereinstellungen können Sie außerdem Folgendes auswählen:

- **Language**: automatische Erkennung (Standardeinstellung), Englisch, Russisch, Ukrainisch oder Weißrussisch.
- **Prompt**: optionale Anleitung, die mit der Transkriptionsanfrage gesendet wird.
- **Temperature**: ein Wert von `0` bis `1`; Der Standardwert ist `0`.

GPT-Voice speichert den API-Schlüssel lokal mit Electron safe storage, wenn dieser Schutz verfügbar ist, und zeigt den gespeicherten Schlüssel niemals in der Schnittstelle an. Wenn kein sicherer Speicher verfügbar ist, schlägt das Speichern eines neuen Schlüssels fehl, anstatt ihn ohne diesen Schutz zu speichern. Der Anbieter OpenAI API verwendet nicht das Browser-Anmeldefenster.Verwenden Sie **Clear authentication** in den Anbietereinstellungen, um den gespeicherten API-Schlüssel zu entfernen. Die nicht geheimen Transkriptionsoptionen bleiben für den nächsten von Ihnen konfigurierten Schlüssel verfügbar, die Verbindung zum Anbieter wird jedoch erst hergestellt, wenn wieder ein gültiger Schlüssel gespeichert wird.

## Anbieter wechseln oder wiederherstellen

Sie können vor Beginn einer Aufnahme den Anbieter wechseln. Vergewissern Sie sich vor der Aufnahme, dass der neu ausgewählte Anbieter **Connected** ist. Eine konfigurierte ChatGPT Web-Sitzung und ein konfigurierter OpenAI API-Schlüssel sind unabhängig.

Wenn die Transkription fehlschlägt:

1. Überprüfen Sie, ob der ausgewählte Anbieter noch verbunden ist und sein Konto die Transkription nutzen kann.
2. Stellen Sie für **ChatGPT Web** die Verbindung wieder her, wenn die Sitzung abgelaufen ist oder der Browser nicht initialisiert werden konnte.
3. Bestätigen Sie für **OpenAI API** den API-Schlüssel, die Abrechnung oder das Kontingent sowie den Servicestatus des Anbieters und speichern Sie dann alle erforderlichen Korrekturen.
4. Kehren Sie zu [Aufzeichnung und Transkription](transcription.md) zurück, um die zuletzt vorbereitete Aufnahme erneut zu versuchen oder eine neue Aufnahme zu starten.

Anbietereinstellungen wirken sich auf zukünftige Anfragen aus. Sie können eine abgebrochene Aufzeichnung nicht wiederherstellen oder anbieterseitige Zugriffs-, Kontingent-, Richtlinien- oder Dienstfehler außer Kraft setzen.
