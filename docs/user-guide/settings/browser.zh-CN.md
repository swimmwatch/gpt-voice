# 浏览器设置

GPT-Voice 使用 CloakBrowser 进行基于浏览器的服务，例如 ChatGPT Web 和选定文本翻译。打开 **Settings** 并选择 **Browser** 以设置 GPT-Voice 创建这些浏览器上下文时使用的行为和标识值。在[网络设置](network.md)中配置代理。

## 浏览器行为

| 设置                   | 默认        | 可用值                     | 效果                                            |
| ---------------------- | ----------- | -------------------------- | ----------------------------------------------- |
| **Humanize input**     | 已启用      | 启用或禁用                 | 将人性化输入设置传递给 CloakBrowser。           |
| **Human preset**       | **Careful** | **Default** 或 **Careful** | 选择 CloakBrowser 人性化预设。                  |
| **Background browser** | **Hidden**  | **Hidden** 或 **Visible**  | 控制 GPT-Voice 的持久后台浏览器是无头还是显示。 |

**Background browser** 设置适用于持久后台浏览器。 ChatGPT Web 登录窗口始终可见，以便您可以完成身份验证。当需要观察后台浏览器时，选择**Visible**；否则保留选择默认的 **Hidden** 模式。

## 浏览器身份

打开 **Identity** 以查看或更改 GPT-Voice 传递到浏览器上下文的值。

| 设置                 | 默认                               | 要求与行动                                                                                                                                                                         |
| -------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fingerprint seed** | GPT-Voice 生成的数字种子           | 仅需要的数字。选择 **Reset** 生成新的五位数字种子。                                                                                                                                |
| **Locale**           | `en-US`                            | 选择受支持的浏览器区域设置之一：`en-US`、`en-GB`、`ru-RU`、`uk-UA`、`be-BY`、`de-DE`、`fr-FR`、 `es-ES`、`it-IT`、`pt-BR`、`pl-PL`、`tr-TR`、`ja-JP`、`ko-KR`、`zh-CN` 或`zh-TW`。 |
| **Timezone**         | 您的系统时区，或 `UTC`（不可用时） | 选择受支持的 IANA 时区。                                                                                                                                                           | 需要指纹种子、区域设置和时区。设置拒绝包含除数字以外的任何内容的种子、不是有效 BCP 47 区域设置的区域设置或不是有效 IANA 时区的时区。 GPT-Voice 保存这些值时会删除周围的空格。 |

### Proxy GeoIP 控制区域设置和时区

当通过[网络设置](network.md)中的**GeoIP**启用代理时，代理将确定浏览器的区域设置和时区。 GPT-Voice 禁用 **Identity** 中的这两个字段并显示消息 **Proxy GeoIP controls locale and timezone**。如果您稍后关闭 GeoIP，保存的区域设置和时区仍然可用，但它们不会发送到浏览器上下文，而活动代理 GeoIP 拥有它们。

## 保存更改

浏览器设置是“设置”表单的一部分。更改值会创建 **Unsaved changes**；验证成功后选择**Save changes**。常规浏览器配置存储在 GPT-Voice 的本地设置中，并在下次 GPT-Voice 创建适用的浏览器上下文时使用。有关保存错误和放弃确认行为，请参阅[设置概述](index.md)。
