# Network settings

Open **Settings** and select **Network** to configure the proxy GPT-Voice passes to CloakBrowser contexts. These settings affect browser-based services such as ChatGPT Web and selected-text translation. For the identity settings affected by proxy GeoIP, see [Browser settings](browser.md).

## Enable a proxy

**Proxy enabled** is off by default. When it is off, GPT-Voice does not pass a proxy to CloakBrowser, and the remaining Network fields are disabled. Turning it off does not erase the values you entered, so you can enable the proxy again later.

When you enable it, **Proxy server** is required. Enter a complete URL using one of these protocols:

- `http://`
- `https://`
- `socks5://`

For example, `http://proxy.example.com:8080` is a valid server format. GPT-Voice removes surrounding whitespace when it saves the value. It rejects a missing or malformed server, unsupported protocols, and URLs that contain a username or password. Put credentials in the separate fields instead.

## Bypass and credentials

| Field        | Default            | Behavior                                                                                   |
| ------------ | ------------------ | ------------------------------------------------------------------------------------------ |
| **Bypass**   | Blank              | Optional. When provided, GPT-Voice passes the bypass value to CloakBrowser with the proxy. |
| **Username** | Blank              | Optional proxy username for HTTP or HTTPS proxy authentication.                            |
| **Password** | No password stored | Optional proxy password for HTTP or HTTPS proxy authentication.                            |

The password is stored separately through Electron safe storage. After saving, its value is not returned to Settings; the field shows that a password is saved instead. Leaving the field blank keeps an existing password. Choose **Clear** to remove it. If secure storage is unavailable, GPT-Voice cannot save a new proxy password.

Do not place a username or password in the Proxy server URL, paste credentials into a support request, or expose them in a screenshot.

### SOCKS5 credentials are not supported

CloakBrowser does not support a username or password for a SOCKS5 proxy. When an enabled SOCKS5 proxy has either credential, Settings displays a warning and blocks saving until you remove the username and clear the password. GPT-Voice does not pass SOCKS5 credentials to CloakBrowser.

## Let proxy GeoIP own browser identity

**GeoIP** is off by default and is available only when the proxy is enabled. Turn it on when the configured proxy should determine the browser locale and timezone. While both proxy and GeoIP are active, GPT-Voice passes the proxy with GeoIP enabled and does not pass its separately saved locale or timezone.

Consequently, the **Locale** and **Timezone** fields in [Browser settings](browser.md) are disabled and show **Proxy GeoIP controls locale and timezone**. Turn GeoIP off to edit and use the saved Browser identity values again.

## Save and troubleshoot

Network values are part of the Settings form. Choose **Save changes** after validation succeeds; the saved proxy configuration is used the next time GPT-Voice creates the applicable browser context. If saving fails, Settings stays open and identifies the invalid field.

For a connection failure, confirm that the server URL includes `http`, `https`, or `socks5`, that the proxy is reachable, and that HTTP/HTTPS credentials are in their dedicated fields. Do not enter SOCKS5 credentials. See the [Settings overview](index.md) for unsaved-change and discard-confirmation behavior.
