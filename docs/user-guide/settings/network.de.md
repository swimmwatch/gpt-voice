# Netzwerkeinstellungen

Öffnen Sie **Settings** und wählen Sie **Network** aus, um die Proxy-Übergaben von GPT-Voice an CloakBrowser-Kontexte zu konfigurieren. Diese Einstellungen wirken sich auf browserbasierte Dienste wie ChatGPT Web und die Übersetzung ausgewählter Texte aus. Informationen zu den vom Proxy GeoIP betroffenen Identitätseinstellungen finden Sie unter [Browsereinstellungen](browser.md).

## Aktivieren Sie einen Proxy

**Proxy enabled** ist standardmäßig deaktiviert. Wenn es deaktiviert ist, übergibt GPT-Voice keinen Proxy an CloakBrowser und die übrigen Netzwerkfelder sind deaktiviert. Durch das Ausschalten werden die von Ihnen eingegebenen Werte nicht gelöscht, sodass Sie den Proxy später wieder aktivieren können.

Wenn Sie es aktivieren, ist **Proxy server** erforderlich. Geben Sie eine vollständige URL mit einem dieser Protokolle ein:

- `http://`
- `https://`
- `socks5://`

Beispielsweise ist `http://proxy.example.com:8080` ein gültiges Serverformat. GPT-Voice entfernt umgebende Leerzeichen, wenn der Wert gespeichert wird. Es lehnt einen fehlenden oder fehlerhaften Server, nicht unterstützte Protokolle und URLs ab, die einen Benutzernamen oder ein Passwort enthalten. Geben Sie Ihre Anmeldeinformationen stattdessen in die separaten Felder ein.

## Bypass und Anmeldeinformationen

| Feld         | Standard                  | Verhalten                                                                                     |
| ------------ | ------------------------- | --------------------------------------------------------------------------------------------- |
| **Bypass**   | Leer                      | Optional. Sofern angegeben, übergibt GPT-Voice den Bypass-Wert mit dem Proxy an CloakBrowser. |
| **Username** | Leer                      | Optionaler Proxy-Benutzername für die HTTP- oder HTTPS-Proxy-Authentifizierung.               |
| **Password** | Kein Passwort gespeichert | Optionales Proxy-Passwort für die HTTP- oder HTTPS-Proxy-Authentifizierung.                   |

Das Passwort wird separat über Electron safe storage gespeichert. Nach dem Speichern wird der Wert nicht an die Einstellungen zurückgegeben; Das Feld zeigt an, dass stattdessen ein Passwort gespeichert ist. Wenn Sie das Feld leer lassen, bleibt ein vorhandenes Passwort erhalten. Wählen Sie **Clear**, um es zu entfernen. Wenn kein sicherer Speicher verfügbar ist, kann GPT-Voice kein neues Proxy-Passwort speichern.

Geben Sie keinen Benutzernamen oder kein Passwort in die Proxy-Server-URL ein, fügen Sie keine Anmeldeinformationen in eine Supportanfrage ein und machen Sie sie nicht in einem Screenshot sichtbar.

### SOCKS5 Anmeldeinformationen werden nicht unterstützt

CloakBrowser unterstützt keinen Benutzernamen oder kein Passwort für einen SOCKS5-Proxy. Wenn ein aktivierter SOCKS5-Proxy über eine der Anmeldeinformationen verfügt, zeigt „Einstellungen“ eine Warnung an und blockiert das Speichern, bis Sie den Benutzernamen entfernen und das Passwort löschen. GPT-Voice übergibt keine Anmeldeinformationen von SOCKS5 an CloakBrowser.

## Lassen Sie Proxy GeoIP die eigene Browseridentität besitzen

**GeoIP** ist standardmäßig deaktiviert und nur verfügbar, wenn der Proxy aktiviert ist. Aktivieren Sie diese Option, wenn der konfigurierte Proxy das Gebietsschema und die Zeitzone des Browsers ermitteln soll. Während sowohl Proxy als auch GeoIP aktiv sind, übergibt GPT-Voice den Proxy mit aktiviertem GeoIP und übergibt nicht sein separat gespeichertes Gebietsschema oder seine Zeitzone.Folglich sind die Felder **Locale** und **Timezone** in den [Browsereinstellungen](browser.md) deaktiviert und zeigen **Proxy GeoIP controls locale and timezone**. Schalten Sie GeoIP aus, um die gespeicherten Browser-Identitätswerte erneut zu bearbeiten und zu verwenden.

## Speichern und Fehler beheben

Netzwerkwerte sind Teil des Einstellungsformulars. Wählen Sie **Save changes**, nachdem die Validierung erfolgreich war; Die gespeicherte Proxy-Konfiguration wird verwendet, wenn GPT-Voice das nächste Mal den entsprechenden Browserkontext erstellt. Wenn das Speichern fehlschlägt, bleiben die Einstellungen geöffnet und identifizieren das ungültige Feld.

Stellen Sie bei einem Verbindungsfehler sicher, dass die Server-URL `http`, `https` oder `socks5` enthält, dass der Proxy erreichbar ist und dass HTTP/HTTPS-Anmeldeinformationen in den entsprechenden Feldern enthalten sind. Geben Sie keine SOCKS5-Anmeldeinformationen ein. Informationen zum Verhalten bei nicht gespeicherten Änderungen und bei der Verwerfen-Bestätigung finden Sie in der [Übersicht über die Einstellungen](index.md).
