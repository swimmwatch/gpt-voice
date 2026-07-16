# 安装、更新或删除 GPT-Voice

GPT-Voice 具有适用于 Windows 和 Linux 的现成运行版本。您不需要 Node.js、npm、本地模型、CUDA 或
耳语单独安装。

从 [GitHub Releases](https://github.com/swimmwatch/gpt-voice/releases) 下载适合您的计算机的软件包。
每个版本还包括特定于平台的 `SHA256SUMS-*.txt` 文件。要验证下载，请比较 SHA-256 值
由操作系统的校验和工具报告，并包含您下载的发布资产的条目。

> macOS 版本已暂停，同时准备开发人员 ID 签名和公证。不要安装非官方的 DMG
> 作为 GPT-Voice;当前版本中没有受支持的 macOS 软件包。

## 选择发布资产

|平台|释放资产 |当 | 时使用它
| ------------------- | ------------------------ | ----------------------------------------------------------------------------------- |
|窗户 | `GPT-Voice Setup *.exe` |您想要正常的 Windows 安装。 |
| Debian 系列 Linux | `gpt-voice_*_amd64.deb` |您使用 Ubuntu、Debian、Linux Mint、Pop!_OS 或类似的发行版。 |
| RPM 系列 Linux | `gpt-voice-*.x86_64.rpm` |您使用 Fedora、RHEL、CentOS、openSUSE 或类似的发行版。 |
| Linux | `GPT-Voice-*.AppImage` |您想要一个便携式构建而不安装系统包。 |

## 按操作系统分类的指南

选择您的操作系统，查看安装、更新和卸载的详细步骤。

- [Windows](install/windows.md)

- [Linux](install/linux.md)

- [macOS](install/macos.md)

安装完成后，请继续[首次使用](getting-started.md)，连接转写提供商并进行第一次录音。
