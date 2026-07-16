# Linux

## Linux deb 包

对于 Ubuntu、Debian、Linux Mint、Pop!_OS 和类似发行版，请安装下载的软件包：

```bash
sudo apt install ./gpt-voice_*_amd64.deb
```

如果您的系统无法通过 `apt` 安装本地 deb，请使用：

```bash
sudo dpkg -i ./gpt-voice_*_amd64.deb
sudo apt-get install -f
```

该软件包将 GPT-Voice 安装在 `/opt/GPT-Voice` 中，注册桌面启动器和图标，并提供
`gpt-voice`命令。从应用程序菜单或使用 `gpt-voice` 启动它。

要更新，请使用相同的 `apt install` 命令安装较新的 deb。要删除该包，请使用`sudo apt remove gpt-voice`;如果您还想删除包配置，请使用 `sudo apt purge gpt-voice`。

## Linux rpm 包

对于 Fedora、RHEL、CentOS、openSUSE 和类似发行版，请使用您的发行版包管理器，以便它可以解决
包依赖项。请勿使用普通 `rpm -i` 进行正常安装。

```bash
# Fedora, RHEL, CentOS, and compatible distributions
sudo dnf install ./gpt-voice-*.x86_64.rpm

# Older CentOS or RHEL systems
sudo yum install ./gpt-voice-*.x86_64.rpm

# openSUSE
sudo zypper install ./gpt-voice-*.x86_64.rpm
```

rpm 软件包安装与 deb 软件包相同的启动器、图标和 `gpt-voice` 命令。其释放资产为
适用于 `x86_64` 桌面系统。在最小的 Linux 安装上，先启用正常的桌面/运行时存储库
安装以便您的包管理器可以获得其依赖项。

要更新，请使用相同的包管理器命令安装较新的 rpm。要删除它，请使用
Fedora/RHEL/CentOS 上的 `sudo dnf remove gpt-voice` 或 openSUSE 上的 `sudo zypper remove gpt-voice`。

## Linux 应用程序映像

当您更喜欢便携式副本而不是系统包时，请使用 AppImage。

1.下载`GPT-Voice-*.AppImage`。2. 使其可执行并运行它：

```bash
chmod +x GPT-Voice-*.AppImage
./GPT-Voice-*.AppImage
```

首次启动时，GPT-Voice 会尽可能为您的用户注册本地桌面启动器和图标。要更新，
下载较新的 AppImage，使其可执行，然后运行它而不是旧文件。

要删除 AppImage 安装，请退出 GPT-Voice，从该 AppImage 运行桌面集成删除命令，
然后删除该文件：

```bash
./GPT-Voice-*.AppImage --remove-linux-appimage-desktop-integration
```

## 保留的Linux数据

删除 deb 或 rpm 包，或者删除 AppImage，不会删除您的设置或保存的提供程序会话。他们
保留在 `~/.config/GPT-Voice` 中。仅当您想要干净重置时才手动删除该目录。

安装完成后，继续[首先使用](../getting-started.md)连接转录提供程序并
进行你的第一次录音。
