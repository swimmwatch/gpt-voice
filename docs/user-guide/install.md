# Install, update, or remove GPT-Voice

GPT-Voice has ready-to-run releases for Windows and Linux. You do not need Node.js, npm, a local model, CUDA, or
Whisper installed separately.

Download the package for your computer from [GitHub Releases](https://github.com/swimmwatch/gpt-voice/releases).
Each release also includes platform-specific `SHA256SUMS-*.txt` files. To verify a download, compare the SHA-256 value
reported by your operating system's checksum tool with the entry for the release asset you downloaded.

> macOS releases are paused while Developer ID signing and notarization are prepared. Do not install an unofficial DMG
> as GPT-Voice; there is no supported macOS package in current releases.

## Choose a release asset

| Platform            | Release asset            | Use it when                                                             |
| ------------------- | ------------------------ | ----------------------------------------------------------------------- |
| Windows             | `GPT-Voice Setup *.exe`  | You want a normal Windows installation.                                 |
| Debian-family Linux | `gpt-voice_*_amd64.deb`  | You use Ubuntu, Debian, Linux Mint, Pop!_OS, or a similar distribution. |
| RPM-family Linux    | `gpt-voice-*.x86_64.rpm` | You use Fedora, RHEL, CentOS, openSUSE, or a similar distribution.      |
| Linux               | `GPT-Voice-*.AppImage`   | You want a portable build without installing a system package.          |

## Platform guides

Choose your operating system for detailed installation, update, and removal steps.

- [Windows](install/windows.md)

- [Linux](install/linux.md)

- [macOS](install/macos.md)

When installation is complete, continue to [first use](getting-started.md) to connect a transcription provider and make your first recording.
