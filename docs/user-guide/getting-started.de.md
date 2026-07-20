# Erster Einsatz: Einen Anbieter anschließen und Sprache transkribieren

Verbinden Sie nach der [Installation von GPT-Voice](install.md) einen Transkriptionsanbieter, erlauben Sie den Mikrofonzugriff und erstellen Sie einen
kurze Aufnahme. GPT-Voice kopiert eine erfolgreiche Transkription in die Zwischenablage; Es wird nicht automatisch in das eingegeben
welche Anwendung Sie verwendet haben.

## 1. Wählen Sie einen Transkriptionsanbieter

Öffnen Sie GPT-Voice und wählen Sie **ChatGPT Web** oder **OpenAI API** im **Provider**-Selektor im Command Dock.

| Anbieter        | Was Sie brauchen                                                                 | Erstmalige Aktion                                                                            |
| --------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **ChatGPT Web** | Ein ChatGPT-Konto, bei dem Sie sich anmelden können.                             | Wählen Sie es aus, wählen Sie dann **Connect** und schließen Sie die Browser-Anmeldung ab.   |
| **OpenAI API**  | Ihr eigener OpenAI API-Schlüssel und verfügbare API-Abrechnung oder -Kontingent. | Wählen Sie es aus und wählen Sie dann **Configure**, um die Anbietereinstellungen zu öffnen. |

Die Verfügbarkeit, Limits, Abrechnung und Bedingungen des Anbieters werden durch das von Ihnen verwendete Konto gesteuert. GPT-Voice wird nicht umgangen
diese Grenzen.

### Verbinden ChatGPT Web

1. Wählen Sie **ChatGPT Web**.
2. Wählen Sie **Connect**.
3. Schließen Sie die ChatGPT-Anmeldung im sich öffnenden Browserfenster ab.
4. Nachdem ChatGPT bereit ist, schließen Sie das Anmeldefenster und kehren Sie zu GPT-Voice zurück.

Der Anbieterstatus ändert sich in **Connected**, wenn die Sitzung bereit ist. GPT-Voice speichert die Browsersitzung in Ihrem
lokale App-Daten und startet den Hintergrundbrowser bei späteren Starts automatisch. Wenn die Sitzung abläuft, wählen Sie
**Connect** erneut, um sich erneut anzumelden.

### Konfigurieren Sie OpenAI API

1. Wählen Sie **OpenAI API**.
2. Wählen Sie **Configure**. Sie können neben der Anbieterauswahl auch das Steuerelement „Anbietereinstellungen“ verwenden.
3. Fügen Sie Ihren OpenAI API-Schlüssel ein.
4. Wählen Sie optional eine Transkriptionssprache, Eingabeaufforderung oder Temperatur.
5. Wählen Sie **Save**.

Das Transkriptionsmodell ist auf `whisper-1` festgelegt. Nach erfolgreichem Speichern zeigt GPT-Voice den Anbieter als an
**Connected** und meldet, dass der Anbieter konfiguriert ist. Die Anwendung speichert den API-Schlüssel lokal mithilfe von Electron
sichere Lagerung, sofern verfügbar; Der Schlüssel wird nicht wieder in der Benutzeroberfläche angezeigt. OpenAI API Transkription verwendet kein a
Browser.

## 2. Erlauben Sie den Mikrofonzugriff

Bei der ersten Aufnahme wird Ihr Betriebssystem um die Mikrofonerlaubnis gebeten. Erlauben Sie den Zugriff für GPT-Voice und kehren Sie dann zu zurück
das Command Dock. Wenn der Zugriff verweigert wird oder kein Mikrofon verfügbar ist, wird als Status „**Fehler: Zugriff nicht möglich“ angezeigt
Mikrofon** und es wird kein Ton gesendet. Aktivieren Sie die Berechtigung in den Datenschutzeinstellungen Ihres Betriebssystems, bevor Sie es versuchen
wieder.

## 3. Machen Sie eine erste Aufnahme

1. Wählen Sie einen Anbieter aus, der **Connected** anzeigt.
2. Wählen Sie **Start recording** oder drücken Sie die angezeigte Aufnahmeverknüpfung (die Standardeinstellung ist `F9`).3. Sprechen Sie einen kurzen Satz. Der Status ändert sich zu **Recording**.
3. Wählen Sie **Stop recording** (Standard `F10`). GPT-Voice ändert den Status in **Transcribing**, während es sendet
   aufgenommenes Audio an den ausgewählten Anbieter weiter.
4. Warten Sie auf **Copied to clipboard** und fügen Sie es dann in ein beliebiges Textfeld ein, um das Ergebnis zu bestätigen.

Sie können eine aktive Aufnahme auch über Command Dock anhalten, fortsetzen oder abbrechen. Beim Abbrechen wird das Aktive verworfen
Aufzeichnen, anstatt es zur Transkription zu senden.

## Wenn die erste Transkription nicht funktioniert

– Wenn **Connected** nicht angezeigt wird, öffnen Sie die Anbietersteuerelemente erneut und schließen Sie die Anmeldung ab oder speichern Sie einen gültigen API-Schlüssel. Für
ChatGPT Web, der Status kann stattdessen sagen, dass die Browserinitialisierung fehlgeschlagen ist oder dass die Sitzung abgelaufen ist.

- Wenn der Status einen Mikrofonfehler meldet, erlauben Sie GPT-Voice, Ihr Mikrofon im Betriebssystem zu verwenden, und führen Sie einen Fehler durch
  neue Aufnahme.
- Wenn der Status **Transcription failed** oder **Transcription error** meldet, überprüfen Sie das Konto des ausgewählten Anbieters.
  Überprüfen Sie die Verbindung und die Grenzwerte und versuchen Sie es erneut. Eine fehlgeschlagene Transkription wird nicht in die Zwischenablage kopiert.

Auf den nächsten Anleitungsseiten werden Aufzeichnungssteuerung, Anbieterverhalten, Verknüpfungen und Fehlerbehebung ausführlicher behandelt. Für
Jetzt bestätigen ein **Connected**-Anbieter und ein **Copied to clipboard**-Ergebnis, dass der Basispfad funktioniert.
