<div class="guide-wordmark" align="center" markdown>

![GPT-Voice 字标](/gpt-voice/docs/assets/generated/icons/gpt-voice-wordmark.svg){ width="620" }

</div>

# GPT-Voice 文档

GPT-Voice 是一款桌面语音转文本应用程序。使用全局快捷方式记录想法，通过
您控制的提供商，并在剪贴板上接收转录。

<div class="guide-links" markdown>

[GPT-Voice首页](/gpt-voice/)<span aria-hidden="true">·</span>
[存储库](https://github.com/swimmwatch/gpt-voice) <span aria-hidden="true">·</span>
[最新版本](https://github.com/swimmwatch/gpt-voice/releases)

</div>

<div class="guide-actions" markdown>

[:material-download: 下载 GPT-Voice](https://github.com/swimmwatch/gpt-voice/releases){ .md-button .md-button--primary }
[:material-rocket-launch: 开始使用](getting-started.md){ .md-button }

</div>

<figure class="product-screenshot">
  <a href="/gpt-voice/docs/assets/generated/images/app-main.png">
    <picture>
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.avif" type="image/avif" />
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.webp" type="image/webp" />
      <img src="/gpt-voice/docs/assets/generated/images/app-main.png" width="920" height="840" loading="eager" decoding="async" alt="GPT-Voice Command Dock showing ChatGPT Web connected, a loaded Prettify model, the Start recording action with F9, and English as the target language." />
    </picture>
  </a>
  <figcaption>GPT-Voice.</figcaption> 中准备录制 Command Dock
</figure>

<aside class="release-note">
  本指南记录了最新发布的 GPT-Voice 版本。提供商的可用性、限制、计费和条款保持不变
  由您使用的提供商帐户控制。
</aside>

## GPT-Voice 的作用

<div class="grid cards" markdown>

- :material-microphone: **Transcribe speech**

  使用登录的 **ChatGPT Web** 会话或官方 **OpenAI API** 转录录音。

- :material-content-paste: **Keep the workflow on your desktop**

  录制、停止复制的文本并将其粘贴到您需要的位置。成功的结果被复制到剪贴板；
  GPT-Voice 不会自动将它们插入到另一个应用程序中。

- :material-translate: **Translate selected text**

  使用全局快捷方式运行选定文本翻译操作，然后粘贴剪贴板中的结果。

- :material-auto-fix: **Use Prettify**

  通过您配置和运行的 Ollama 或 vLLM 服务清理选定的文本，同时保留其含义。

- :material-history: **Return to useful results**

  使用全局快捷方式和本地转录历史记录返回复制的结果，而无需再次发送音频。

</div>

## 开始之前

GPT-Voice 支持 Windows 和 Linux 的发行包。当前的 macOS 版本在签名时暂停，并且
公证准备就绪。从以下位置下载适合您平台的软件包
[GitHub 发布页面](https://github.com/swimmwatch/gpt-voice/releases)。

对于转录，请选择一个提供商：

- **ChatGPT Web** 需要登录的浏览器会话。
- **OpenAI API** 需要您自己的 API 密钥和可用的 API 计费或配额。

提供商的可用性、限制、计费和条款由您使用的提供商帐户控制。 GPT-Voice 不
绕过这些限制。

## 指导范围

从[安装](install.md)开始，然后按照[首先使用](getting-started.md)连接提供商并确认
转录到达您的剪贴板。继续[录音和转录](guides/transcription.md)，
[提供商设置](guides/providers.md)、[设置](settings/index.md)、[隐私和数据](privacy.md)、
[故障排除](troubleshooting.md)和[常见问题](faq.md)。GPT-Voice 是一个独立项目，不隶属于 OpenAI、Anthropic 或 Google。它已获得许可
[PolyForm 非商业 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)，这不是
OSI 批准的开源许可证。
