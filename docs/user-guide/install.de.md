# Installieren, aktualisieren oder entfernen Sie GPT-Voice

GPT-Voice verfügt über betriebsbereite Versionen für Windows und Linux. Sie benötigen weder Node.js noch npm, ein lokales Modell, CUDA oder
Whisper separat installiert.

Laden Sie das Paket für Ihren Computer von [GitHub Releases](https://github.com/swimmwatch/gpt-voice/releases) herunter.
Jede Version enthält außerdem plattformspezifische `SHA256SUMS-*.txt`-Dateien. Um einen Download zu überprüfen, vergleichen Sie den SHA-256-Wert
Wird vom Prüfsummentool Ihres Betriebssystems mit dem Eintrag für das von Ihnen heruntergeladene Release-Asset gemeldet.

> macOS-Versionen werden angehalten, während die Signierung und Beglaubigung der Entwickler-ID vorbereitet wird. Installieren Sie keine inoffizielle DMG
> als GPT-Voice; In aktuellen Versionen gibt es kein unterstütztes macOS-Paket.

## Wählen Sie ein Release-Asset

| Plattform            | Asset freigeben          | Verwenden Sie es, wenn                                                             |
| -------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| Windows              | `GPT-Voice Setup *.exe`  | Sie möchten eine normale Windows-Installation.                                     |
| Debian-Familie Linux | `gpt-voice_*_amd64.deb`  | Sie verwenden Ubuntu, Debian, Linux Mint, Pop!_OS oder eine ähnliche Distribution. |
| RPM-Familie Linux    | `gpt-voice-*.x86_64.rpm` | Sie verwenden Fedora, RHEL, CentOS, openSUSE oder eine ähnliche Distribution.      |
| Linux                | `GPT-Voice-*.AppImage`   | Sie möchten einen portablen Build, ohne ein Systempaket zu installieren.           |

## Anleitungen nach Betriebssystem

Wählen Sie Ihr Betriebssystem für die detaillierten Schritte zur Installation, Aktualisierung und Entfernung.

- [Windows](install/windows.md)

- [Linux](install/linux.md)

- [macOS](install/macos.md)

Fahren Sie nach der Installation mit der [ersten Verwendung](getting-started.md) fort, um einen Transkriptionsanbieter zu verbinden und die erste Aufnahme zu machen.
