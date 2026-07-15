<div class="guide-wordmark" align="center" markdown>

![GPT-Voice ワードマーク](assets/generated/icons/gpt-voice-wordmark.svg){ width="620" }

</div>

# GPT-Voice ドキュメント

GPT-Voice は、デスクトップの音声テキスト変換アプリケーションです。グローバル ショートカットを使用して考えを記録し、オーディオを経由して送信します。
あなたが制御するプロバイダーにアクセスし、クリップボードで転写を受け取ります。

<div class="guide-links" markdown>

[GPT-Voice ホーム](/gpt-voice/) <span aria-hidden="true">·</span>
[リポジトリ](https://github.com/swimmwatch/gpt-voice) <span aria-hidden="true">·</span>
[最新リリース](https://github.com/swimmwatch/gpt-voice/releases)

</div>

<div class="guide-actions" markdown>

[:material-download: ダウンロード GPT-Voice](https://github.com/swimmwatch/gpt-voice/releases){ .md-button .md-button--primary }
[:material-rocket-launch: 始めましょう](getting-started.md){ .md-button }

</div>

<figure class="product-screenshot">
  <a href="assets/generated/images/app-main.png">
    <picture>
      <source srcset="assets/generated/images/app-main.avif" type="image/avif" />
      <source srcset="assets/generated/images/app-main.webp" type="image/webp" />
      <img src="assets/generated/images/app-main.png" width="920" height="840" loading="eager" decoding="async" alt="GPT-Voice Command Dock showing ChatGPT Web connected, a loaded Prettify model, the Start recording action with F9, and English as the target language." />
    </picture>
  </a>
  <figcaption>すぐに録音できる Command Dock を GPT-Voice で。</figcaption>
</figure>

<aside class="release-note">
  このガイドでは、最新リリースの GPT-Voice バージョンについて説明します。プロバイダーの可用性、制限、請求、および条件はそのまま残ります
  使用するプロバイダー アカウントによって制御されます。
</aside>

## GPT-Voice の機能

<div class="grid cards" markdown>

- :material-microphone: **Transcribe speech**

  サインインした **ChatGPT Web** セッションまたは公式 **OpenAI API** を使用して録音を文字起こしします。

- :material-content-paste: **Keep the workflow on your desktop**

  コピーしたテキストを録音し、停止し、必要な場所に貼り付けます。成功した結果はクリップボードにコピーされます。
  GPT-Voice は、それらを別のアプリケーションに自動的に挿入しません。

- :material-translate: **Translate selected text**

  グローバル ショートカットを使用して選択したテキストの翻訳アクションを実行し、クリップボードから結果を貼り付けます。

- :material-auto-fix: **Use Prettify**

  構成して実行する Ollama または vLLM サービスを通じて、選択したテキストの意味を保持しながらクリーンアップします。

- :material-history: **Return to useful results**

  グローバル ショートカットとローカルの文字起こし履歴を使用すると、音声を再度送信せずに、コピーした結果に戻ります。

</div>

## 始める前に

GPT-Voice は、Windows と Linux のリリース パッケージをサポートしています。現在の macOS リリースは署名中に一時停止され、
公証が準備されています。からプラットフォーム用のパッケージをダウンロードします。
[GitHub リリース ページ](https://github.com/swimmwatch/gpt-voice/releases)。

文字起こしの場合は、プロバイダーを 1 つ選択します。

- **ChatGPT Web** には、サインインしたブラウザー セッションが必要です。
- **OpenAI API** には独自の API キーと利用可能な API の課金または割り当てが必要です。

プロバイダーの可用性、制限、請求、および条件は、使用するプロバイダー アカウントによって制御されます。 GPT-Voiceはそうではありません
それらの制限を回避します。

## ガイド範囲

[installation](install.md) から始めて、[first use](getting-started.md) に従ってプロバイダーに接続して確認します
文字起こしがクリップボードに届くことを確認します。 [録音と転写](guides/transcription.md)を続行し、
[プロバイダーのセットアップ](guides/providers.md)、[設定](settings/index.md)、[プライバシーとデータ](privacy.md)、
[トラブルシューティング](troubleshooting.md)、および[よくある質問](faq.md)。GPT-Voice は独立したプロジェクトであり、OpenAI、Anthropic、Google とは提携していません。以下に基づいてライセンスされています
[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)、これは
OSI承認のオープンソースライセンス。
