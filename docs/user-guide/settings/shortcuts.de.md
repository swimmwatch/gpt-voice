# Verknüpfungseinstellungen

GPT-Voice verwendet globale Verknüpfungen, sodass diese funktionieren, während Sie sich in einer anderen Anwendung befinden. Öffnen Sie **Settings** und wählen Sie **Shortcuts**, um sie anzuzeigen oder zu ändern.

| Aktion                                | Standardverknüpfung | Wenn es funktioniert                                                                                                                           |
| ------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Start, pause, or resume recording** | `F9`                | Startet die Aufnahme im Leerlauf, pausiert eine aktive Aufnahme oder setzt eine angehaltene Aufnahme fort.                                     |
| **Stop recording**                    | `F10`               | Stoppt eine Aufnahme oder pausierte Aufnahme und beginnt mit der Transkription.                                                                |
| **Cancel**                            | `Escape`            | Bricht eine aktive Aufnahme ab. Wenn keine Aufzeichnung aktiv ist, wird eine laufende Prettify-Anfrage abgebrochen.                            |
| **Translate selected text**           | `F11`               | Übersetzt ausgewählten Text, wenn die Übersetzung aktiviert ist und keine Aufzeichnung oder andere Aktion für den ausgewählten Text aktiv ist. |
| **Prettify selected text**            | `F12`               | Verschönert ausgewählten Text, wenn Prettify aktiviert ist und keine Aufzeichnung oder andere ausgewählte Textaktion aktiv ist.                |
| **Retry transcription**               | `Ctrl+F8`           | Wiederholt die letzte wiederholbare Transkription nur, wenn GPT-Voice inaktiv ist.                                                             |

Die Wiederholungsverknüpfung ist erst verfügbar, wenn eine wiederholbare Transkription vorliegt. Siehe [Aufzeichnen und Transkribieren](../guides/transcription.md) für den Zeitpunkt, an dem ein erneuter Versuch verfügbar wird, und [Ausgewählten Text übersetzen und verschönern](../guides/text-actions.md) für die Workflows für ausgewählten Text.

## Eine Verknüpfung ändern

1. Wählen Sie **Change** in der Zeile der Aktion aus.
2. Drücken Sie im Aufnahmedialog die vollständige Tastenkombination, die Sie verwenden möchten.
3. Überprüfen Sie die im Dialogfeld angezeigte Kombination und wählen Sie dann **Apply**. Wählen Sie **Cancel**, um die aktuelle Verknüpfung unverändert zu lassen.

GPT-Voice setzt alle globalen Verknüpfungen vorübergehend außer Kraft, während der Aufnahmedialog geöffnet ist, und registriert sie dann erneut, wenn Sie sie anwenden oder abbrechen. Drücken Sie als Teil der Kombination eine nicht modifizierbare Taste. Wenn Sie nur `Ctrl`, `Alt`, `Shift` oder die Befehlstaste der Plattform drücken, wird keine Verknüpfung erstellt.

## Vermeiden Sie Konflikte

Verwenden Sie für jede GPT-Voice-Aktion eine andere Verknüpfung und wählen Sie Kombinationen, die nicht mit Ihrem Betriebssystem oder anderer Software kollidieren. GPT-Voice lehnt widersprüchliche GPT-Voice Zuweisungen ab. Eine unveränderte Taste steht in Konflikt mit derselben Basistaste, selbst wenn die andere Zuweisung Modifikatoren enthält. Kombinieren Sie daher beispielsweise F9 nicht mit Strg+F9.

Wenn eine neue Zuweisung nicht registriert werden kann, behält GPT-Voice die aktuelle Verknüpfung bei und zeigt den Grund an. Unter macOS wird eine erfasste Befehlstaste als `Command` dargestellt. Auf anderen unterstützten Plattformen wird das Plattformäquivalent verwendet.## Aktionen für ausgewählten Text aktivieren oder deaktivieren

Die Zeilen **Translate** und **Prettify** verfügen jeweils über einen Aktivierungsschalter. Beide sind standardmäßig aktiviert. Schalten Sie einen Schalter aus, um zu verhindern, dass diese Aktion ausgeführt wird, selbst wenn die Verknüpfung gedrückt wird. Aktivieren Sie diese Option, um die konfigurierte Verknüpfung wieder verfügbar zu machen, wenn die normalen Bedingungen der Aktion erfüllt sind.

Diese Schalter sind Teil des Einstellungsformulars. Wählen Sie also **Save changes** aus, nachdem Sie sie geändert haben. Wenn Sie eine Verknüpfung über das Aufnahmedialogfeld ändern, wird diese Verknüpfung unabhängig angewendet. Verwenden Sie den Indikator für nicht gespeicherte Änderungen in der Einstellungsübersicht, um ausstehende Formularbearbeitungen von einer bereits angewendeten Verknüpfung zu unterscheiden.
