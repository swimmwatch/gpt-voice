# 常见问题

## GPT-Voice 自己转录语音吗？

不。 GPT-Voice 是一个桌面应用程序，它将录音发送到您选择的转录提供商：ChatGPT Web
通过您登录的浏览器会话，或 OpenAI API 通过您自己的 API 密钥。提供商可用性、计费、
配额和条款由该提供商控制。请参阅[选择和管理转录提供商](guides/providers.md)。

## 我的电脑留下了什么？

停止录音会将准备好的音频发送到选定的转录提供商。翻译将选定的文本发送至
Google Translate。 Prettify 将选定的文本及其配置的提示发送到您的 Ollama 或 vLLM 端点。参见
[隐私和数据](privacy.md)了解完整的数据流和本地保留详细信息。

## GPT-Voice 是否将结果输入到我的应用程序中？

不会。成功的转录、翻译和美化结果将复制到系统剪贴板。粘贴结果
在您需要的地方。请参阅[记录和转录](guides/transcription.md) 和
[翻译并美化所选文本](guides/text-actions.md)。

## 我可以在没有 OpenAI API 键的情况下使用 GPT-Voice 吗？

是的。 ChatGPT Web 使用登录的 ChatGPT 浏览器会话而不是 API 密钥。它与 OpenAI API 分开
提供商及其帐户要求。请参阅[提供商设置](settings/providers.md)。

## GPT-Voice 可以完全离线工作吗？

不适用于转录或翻译：这些功能使用其选择的远程服务。美化可以使用本地
Ollama 或 vLLM 端点，当您在同一台计算机上运行该服务时，但 GPT-Voice 不会安装或操作
为您提供终点。请参阅[美化设置](settings/prettify.md)。

## 支持哪些平台？

当前版本通过 Windows 安装程序、deb、rpm 和 AppImage 包支持 Windows 和 Linux。 macOS
在准备签署和公证时暂停发布。请参阅[安装、更新或删除](install.md)。

## 更新或卸载会删除我的设置吗？

不会。正常的卸载路径会有意保留本地应用程序数据，包括设置和保存的提供程序数据。
当您想要故意重置该数据时，请使用[隐私和数据](privacy.md)中的删除说明。

## 为什么我的快捷方式或选定文本操作没有运行？

确认该操作已启用，其快捷方式已保存，并且其他应用程序未保留相同的键
组合。 Translation 和 Prettify 一次运行一个，并等待任何录制结束。参见
[快捷方式设置](settings/shortcuts.md)和[故障排除](troubleshooting.md)。

## 我可以使用代理吗？

是的。 GPT-Voice 可以将 HTTP、HTTPS 或 SOCKS5 代理传递到其浏览器上下文。不支持 SOCKS5 凭据，
代理 GeoIP 可以控制浏览器区域设置和时区。请参阅[网络设置](settings/network.md)。

## 如何清除记录、会话或密钥？使用“历史记录”窗口中的 **Clear history** 保存已保存的转录。使用相关提供商的明确控制

ChatGPT 会话、OpenAI API 密钥、vLLM 密钥或代理密码。请参阅[隐私和数据](privacy.md)了解精确范围
每次重置。
