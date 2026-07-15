# 网络设置

打开 **Settings** 并选择 **Network** 以配置代理 GPT-Voice 传递到 CloakBrowser 上下文。这些设置会影响基于浏览器的服务，例如 ChatGPT Web 和选定文本翻译。有关受代理 GeoIP 影响的身份设置，请参阅[浏览器设置 ](browser.md)。

## 启用代理

**Proxy enabled** 默认关闭。当它关闭时，GPT-Voice 不会将代理传递给 CloakBrowser，并且其余网络字段被禁用。关闭它不会删除您输入的值，因此您可以稍后再次启用代理。

启用它时，需要**Proxy server**。使用以下协议之一输入完整的 URL：

- `http://`
- `https://`
- `socks5://`

例如，`http://proxy.example.com:8080` 是有效的服务器格式。 GPT-Voice 保存值时会删除周围的空格。它拒绝丢失或格式错误的服务器、不受支持的协议以及包含用户名或密码的 URL。将凭据放在单独的字段中。

## 绕过和凭据

| 领域         | 默认       | 行为                                                              |
| ------------ | ---------- | ----------------------------------------------------------------- |
| **Bypass**   | 空白       | 选修的。如果提供，GPT-Voice 通过代理将旁路值传递给 CloakBrowser。 |
| **Username** | 空白       | 用于 HTTP 或 HTTPS 代理身份验证的可选代理用户名。                 |
| **Password** | 未存储密码 | 用于 HTTP 或 HTTPS 代理身份验证的可选代理密码。                   |

密码通过Electron safe storage单独存储。保存后，其值不返回Settings；该字段显示已保存密码。将该字段留空会保留现有密码。选择 **Clear** 将其删除。如果安全存储不可用，GPT-Voice 无法保存新的代理密码。

请勿将用户名或密码放在代理服务器 URL 中、将凭据粘贴到支持请求中或在屏幕截图中公开它们。

### 不支持 SOCKS5 凭据

CloakBrowser 不支持 SOCKS5 代理的用户名或密码。当启用的 SOCKS5 代理具有任一凭据时，“设置”会显示警告并阻止保存，直到您删除用户名并清除密码。 GPT-Voice 不会将 SOCKS5 凭据传递给 CloakBrowser。

## 让代理GeoIP拥有浏览器身份

**GeoIP** 默认关闭，仅在启用代理时可用。当配置的代理应确定浏览器区域设置和时区时将其打开。当代理和 GeoIP 都处于活动状态时，GPT-Voice 会传递启用了 GeoIP 的代理，但不会传递其单独保存的区域设置或时区。因此，[浏览器设置](browser.md)中的**Locale**和**Timezone**字段被禁用并显示**Proxy GeoIP controls locale and timezone**。关闭 GeoIP 以再次编辑和使用保存的浏览器标识值。

## 保存并排除故障

网络值是“设置”表单的一部分。验证成功后选择**Save changes**；下次 GPT-Voice 创建适用的浏览器上下文时，将使用保存的代理配置。如果保存失败，“设置”将保持打开状态并识别无效字段。

对于连接失败，请确认服务器 URL 包含 `http`、`https` 或 `socks5`，代理可访问，并且 HTTP/HTTPS 凭据位于其专用字段中。请勿输入 SOCKS5 凭据。有关未保存更改和放弃确认行为，请参阅[设置概述](index.md)。
