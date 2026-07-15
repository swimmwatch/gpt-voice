# Browsereinstellungen

GPT-Voice verwendet CloakBrowser für browserbasierte Dienste wie ChatGPT Web und die Übersetzung ausgewählter Texte. Öffnen Sie **Settings** und wählen Sie **Browser** aus, um das Verhalten und die Identitätswerte festzulegen, die verwendet werden, wenn GPT-Voice diese Browserkontexte erstellt. Konfigurieren Sie einen Proxy in den [Netzwerkeinstellungen](network.md).

## Browserverhalten

| Einstellung            | Standard    | Verfügbare Werte             | Wirkung                                                                                      |
| ---------------------- | ----------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| **Humanize input**     | Aktiviert   | Aktiviert oder deaktiviert   | Übergibt die Humanize-Eingabeeinstellung an CloakBrowser.                                    |
| **Human preset**       | **Careful** | **Default** oder **Careful** | Wählt die Humanisierungsvoreinstellung CloakBrowser aus.                                     |
| **Background browser** | **Hidden**  | **Hidden** oder **Visible**  | Steuert, ob der permanente Hintergrundbrowser von GPT-Voice kopflos ist oder angezeigt wird. |

Die Einstellung **Background browser** gilt für den dauerhaften Hintergrundbrowser. Ein ChatGPT Web-Anmeldefenster ist immer sichtbar, sodass Sie die Authentifizierung abschließen können. Wählen Sie **Visible**, wenn Sie den Hintergrundbrowser beobachten müssen; Andernfalls lassen Sie den Standardmodus **Hidden** ausgewählt.

## Browseridentität

Öffnen Sie **Identity**, um die Werte anzuzeigen oder zu ändern, die GPT-Voice an einen Browserkontext übergibt.

| Einstellung          | Standard                                             | Anforderung und Aktion                                                                                                                                                                                             |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fingerprint seed** | GPT-Voices generierter numerischer Startwert         | Nur erforderliche Ziffern. Wählen Sie **Reset**, um einen neuen fünfstelligen numerischen Startwert zu generieren.                                                                                                 |
| **Locale**           | `en-US`                                              | Wählen Sie eines der unterstützten Browser-Gebietsschemas aus: `en-US`, `en-GB`, `ru-RU`, `uk-UA`, `be-BY`, `de-DE`, `fr-FR`, `es-ES`, `it-IT`, `pt-BR`, `pl-PL`, `tr-TR`, `ja-JP`, `ko-KR`, `zh-CN` oder `zh-TW`. |
| **Timezone**         | Ihre Systemzeitzone oder `UTC`, wenn nicht verfügbar | Wählen Sie eine unterstützte IANA-Zeitzone aus.                                                                                                                                                                    | Fingerabdruck-Seed, Gebietsschema und Zeitzone sind erforderlich. Die Einstellungen lehnen einen Startwert ab, der etwas anderes als Ziffern enthält, ein Gebietsschema, das kein gültiges BCP 47-Gebietsschema ist, oder eine Zeitzone, die keine gültige IANA-Zeitzone ist. GPT-Voice entfernt umgebende Leerzeichen, wenn diese Werte gespeichert werden. |

### Proxy GeoIP steuert Gebietsschema und Zeitzone

Wenn der Proxy mit **GeoIP** in den [Netzwerkeinstellungen](network.md) aktiviert ist, bestimmt der Proxy das Gebietsschema und die Zeitzone des Browsers. GPT-Voice deaktiviert diese beiden Felder in **Identity** und zeigt die Meldung **Proxy GeoIP controls locale and timezone** an. Das gespeicherte Gebietsschema und die gespeicherte Zeitzone bleiben verfügbar, wenn Sie GeoIP später deaktivieren, sie werden jedoch nicht an einen Browserkontext gesendet, während der aktive Proxy GeoIP sie besitzt.

## Änderungen speichern

Browsereinstellungen sind Teil des Einstellungsformulars. Das Ändern eines Werts erzeugt **Unsaved changes**; Wählen Sie **Save changes**, nachdem die Validierung erfolgreich war. Die reguläre Browserkonfiguration wird in den lokalen Einstellungen von GPT-Voice gespeichert und wird verwendet, wenn GPT-Voice das nächste Mal den entsprechenden Browserkontext erstellt. Informationen zu Speicherfehlern und zum Verhalten bei der Verwerfungsbestätigung finden Sie in der [Übersicht über die Einstellungen](index.md).
