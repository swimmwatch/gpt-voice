# Browser settings

GPT-Voice uses CloakBrowser for browser-based services such as ChatGPT Web and selected-text translation. Open **Settings** and select **Browser** to set the behavior and identity values used when GPT-Voice creates those browser contexts. Configure a proxy in [Network settings](network.md).

## Browser behavior

| Setting                | Default     | Available values           | Effect                                                                           |
| ---------------------- | ----------- | -------------------------- | -------------------------------------------------------------------------------- |
| **Humanize input**     | Enabled     | Enabled or disabled        | Passes the Humanize input setting to CloakBrowser.                               |
| **Human preset**       | **Careful** | **Default** or **Careful** | Chooses the CloakBrowser humanization preset.                                    |
| **Background browser** | **Hidden**  | **Hidden** or **Visible**  | Controls whether GPT-Voice's persistent background browser is headless or shown. |

The **Background browser** setting applies to the persistent background browser. A ChatGPT Web sign-in window is always visible so you can complete authentication. Choose **Visible** when you need to observe the background browser; otherwise leave the default **Hidden** mode selected.

## Browser identity

Open **Identity** to view or change the values GPT-Voice passes to a browser context.

| Setting              | Default                                         | Requirement and action                                                                                                                                                                          |
| -------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fingerprint seed** | GPT-Voice's generated numeric seed              | Required digits only. Choose **Reset** to generate a new five-digit numeric seed.                                                                                                               |
| **Locale**           | `en-US`                                         | Select one of the supported browser locales: `en-US`, `en-GB`, `ru-RU`, `uk-UA`, `be-BY`, `de-DE`, `fr-FR`, `es-ES`, `it-IT`, `pt-BR`, `pl-PL`, `tr-TR`, `ja-JP`, `ko-KR`, `zh-CN`, or `zh-TW`. |
| **Timezone**         | Your system timezone, or `UTC` when unavailable | Select a supported IANA timezone.                                                                                                                                                               |

Fingerprint seed, locale, and timezone are required. Settings rejects a seed containing anything other than digits, a locale that is not a valid BCP 47 locale, or a timezone that is not a valid IANA timezone. GPT-Voice removes surrounding whitespace when it saves these values.

### Proxy GeoIP controls locale and timezone

When the proxy is enabled with **GeoIP** in [Network settings](network.md), the proxy determines the browser's locale and timezone. GPT-Voice disables those two fields in **Identity** and shows the message **Proxy GeoIP controls locale and timezone**. The saved locale and timezone remain available if you later turn GeoIP off, but they are not sent to a browser context while active proxy GeoIP owns them.

## Save changes

Browser settings are part of the Settings form. Changing a value creates **Unsaved changes**; choose **Save changes** after validation succeeds. The regular Browser configuration is stored in GPT-Voice's local settings, and it is used the next time GPT-Voice creates the applicable browser context. See the [Settings overview](index.md) for save errors and discard-confirmation behavior.
