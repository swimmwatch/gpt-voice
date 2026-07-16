# GPT-Voice をインストール、更新、または削除します

GPT-Voice には、Windows および Linux 用のすぐに実行できるリリースがあります。 Node.js、npm、ローカル モデル、CUDA、または
ウィスパーは別途取り付けます。

[GitHub Releases](https://github.com/swimmwatch/gpt-voice/releases) からコンピューター用のパッケージをダウンロードします。
各リリースには、プラットフォーム固有の `SHA256SUMS-*.txt` ファイルも含まれています。ダウンロードを検証するには、SHA-256 値を比較します。
オペレーティング システムのチェックサム ツールによって、ダウンロードしたリリース アセットのエントリとともに報告されます。

> 開発者 ID の署名と公証の準備が行われている間、macOS リリースは一時停止されます。非公式 DMG をインストールしないでください
> GPT-Voiceとして;現在のリリースではサポートされている macOS パッケージはありません。

## リリース アセットを選択する

|プラットフォーム |アセットをリリース | | の場合に使用します。
| ------------------- | ------------------------ | ----------------------------------------------------------------------- |
|ウィンドウズ | `GPT-Voice Setup *.exe` |通常の Windows インストールが必要です。 |
| Debian ファミリー Linux | `gpt-voice_*_amd64.deb` | Ubuntu、Debian、Linux Mint、Pop!_OS、または同様のディストリビューションを使用している。 |
| RPM ファミリ Linux | `gpt-voice-*.x86_64.rpm` | Fedora、RHEL、CentOS、openSUSE、または同様のディストリビューションを使用している。 |
|リナックス | `GPT-Voice-*.AppImage` |システム パッケージをインストールせずにポータブルなビルドが必要です。 |

## OS 別ガイド

OS を選択して、インストール、更新、削除の詳しい手順を確認してください。

- [Windows](install/windows.md)

- [Linux](install/linux.md)

- [macOS](install/macos.md)

インストールが完了したら、[初回使用](getting-started.md)に進み、文字起こしプロバイダーを接続して最初の録音を行ってください。
