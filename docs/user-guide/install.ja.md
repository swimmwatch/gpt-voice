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

## Windows

1. 最新リリースから `GPT-Voice Setup *.exe` をダウンロードして開きます。
2. プロンプトが表示されたら、インストール場所を選択します。
3. アプリを手動で起動する場合を除き、デスクトップとスタート メニューのショートカットを有効にしておきます。
4. インストーラーを完了し、スタート メニュー、デスクトップ ショートカット、またはインストーラーの最終画面から **GPT-Voice** を開きます。

Windows パッケージは NSIS インストーラーです。 GPT-Voice、バンドルされているブラウザ ランタイム、アイコン、ショートカット、および
Windows 設定のアンインストーラー エントリ。

### Windows での更新または削除

更新するには、新しい `GPT-Voice Setup *.exe` をダウンロードし、既存のインストール上で実行します。

アプリケーションを削除するには:

1. **Settings** > **Apps** > **Installed apps** を開きます。
2. **GPT-Voice** を見つけます。
3. **Uninstall**を選択します。

アプリケーションを削除すると、インストールされているファイルとショートカットが削除されますが、ローカル設定は意図的に保持され、保存されます。
`%APPDATA%\GPT-Voice` のプロバイダー セッション。これにより、再インストール時にそれらを再利用できるようになります。次の場合にのみ、そのフォルダーを手動で削除してください。
それらのローカルデータも削除したいと考えています。

## Linux deb パッケージ

Ubuntu、Debian、Linux Mint、Pop!_OS、および同様のディストリビューションの場合は、ダウンロードしたパッケージをインストールします。

```bash
sudo apt install ./gpt-voice_*_amd64.deb
```

システムが `apt` を通じてローカル deb をインストールできない場合は、次を使用します。

```bash
sudo dpkg -i ./gpt-voice_*_amd64.deb
sudo apt-get install -f
```

このパッケージは GPT-Voice を `/opt/GPT-Voice` にインストールし、デスクトップ ランチャーとアイコンを登録し、
`gpt-voice` コマンド。アプリケーションメニューから、または`gpt-voice`を使用して起動します。

更新するには、同じ `apt install` コマンドを使用して新しい deb をインストールします。パッケージを削除するには、次を使用します`sudo apt remove gpt-voice`;パッケージ構成も削除したい場合は、`sudo apt purge gpt-voice` を使用してください。

## Linux rpm パッケージ

Fedora、RHEL、CentOS、openSUSE、および同様のディストリビューションの場合は、ディストリビューション パッケージ マネージャーを使用して問題を解決します。
パッケージの依存関係。通常のインストールでは、プレーン `rpm -i` を使用しないでください。

```bash
# Fedora, RHEL, CentOS, and compatible distributions
sudo dnf install ./gpt-voice-*.x86_64.rpm

# Older CentOS or RHEL systems
sudo yum install ./gpt-voice-*.x86_64.rpm

# openSUSE
sudo zypper install ./gpt-voice-*.x86_64.rpm
```

rpm パッケージは、deb パッケージと同じランチャー、アイコン、および `gpt-voice` コマンドをインストールします。そのリリースアセットは
`x86_64` デスクトップ システム用。最小限の Linux インストールでは、事前に通常のデスクトップ/ランタイム リポジトリを有効にします。
インストールすると、パッケージ マネージャーがその依存関係を取得できるようになります。

更新するには、同じ package-manager コマンドを使用して新しい rpm をインストールします。削除するには、次を使用します。
Fedora/RHEL/CentOS の場合は `sudo dnf remove gpt-voice`、openSUSE の場合は `sudo zypper remove gpt-voice`。

## Linux アプリイメージ

システム パッケージではなくポータブル コピーを希望する場合は、AppImage を使用します。

1. `GPT-Voice-*.AppImage`をダウンロードします。
2. 実行可能にして実行します。

   ```bash
   chmod +x GPT-Voice-*.AppImage
   ./GPT-Voice-*.AppImage
   ```

最初の起動時に、GPT-Voice は可能な場合はユーザーのローカル デスクトップ ランチャーとアイコンを登録します。更新するには、
新しい AppImage をダウンロードして実行可能にし、古いファイルの代わりに実行します。

AppImage インストールを削除するには、GPT-Voice を終了し、その AppImage からデスクトップ統合削除コマンドを実行します。
次にファイルを削除します。

```bash
./GPT-Voice-*.AppImage --remove-linux-appimage-desktop-integration
```

## Linux データの保持

deb または rpm パッケージを削除したり、AppImage を削除しても、設定や保存されたプロバイダー セッションは削除されません。彼らは
`~/.config/GPT-Voice` に残ります。クリーンなリセットが必要な場合にのみ、そのディレクトリを手動で削除してください。

インストールが完了したら、[最初に使用](getting-started.md)に進み、文字起こしプロバイダーに接続し、
最初の録音を行います。
