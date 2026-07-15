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

## Windows

1. Download `GPT-Voice Setup *.exe` from the latest release and open it.
2. Choose an installation location if prompted.
3. Keep the desktop and Start Menu shortcuts enabled unless you prefer to launch the app manually.
4. Complete the installer, then open **GPT-Voice** from the Start Menu, desktop shortcut, or final installer screen.

The Windows package is an NSIS installer. It installs GPT-Voice, its bundled browser runtime, icons, shortcuts, and an
uninstaller entry in Windows settings.

### Update or remove on Windows

To update, download the newer `GPT-Voice Setup *.exe` and run it over the existing installation.

To remove the application:

1. Open **Settings** > **Apps** > **Installed apps**.
2. Find **GPT-Voice**.
3. Select **Uninstall**.

Removing the application removes installed files and shortcuts, but deliberately keeps your local settings and saved
provider session in `%APPDATA%\GPT-Voice`. This lets a reinstall reuse them. Delete that folder manually only when you
want to remove those local data too.

## Linux deb package

For Ubuntu, Debian, Linux Mint, Pop!_OS, and similar distributions, install the downloaded package:

```bash
sudo apt install ./gpt-voice_*_amd64.deb
```

If your system cannot install a local deb through `apt`, use:

```bash
sudo dpkg -i ./gpt-voice_*_amd64.deb
sudo apt-get install -f
```

The package installs GPT-Voice in `/opt/GPT-Voice`, registers a desktop launcher and icons, and provides the
`gpt-voice` command. Launch it from your application menu or with `gpt-voice`.

To update, install the newer deb with the same `apt install` command. To remove the package, use
`sudo apt remove gpt-voice`; use `sudo apt purge gpt-voice` if you also want package configuration removed.

## Linux rpm package

For Fedora, RHEL, CentOS, openSUSE, and similar distributions, use your distribution package manager so it can resolve
the package dependencies. Do not use plain `rpm -i` for a normal installation.

```bash
# Fedora, RHEL, CentOS, and compatible distributions
sudo dnf install ./gpt-voice-*.x86_64.rpm

# Older CentOS or RHEL systems
sudo yum install ./gpt-voice-*.x86_64.rpm

# openSUSE
sudo zypper install ./gpt-voice-*.x86_64.rpm
```

The rpm package installs the same launcher, icons, and `gpt-voice` command as the deb package. Its release asset is
for `x86_64` desktop systems. On a minimal Linux installation, enable the normal desktop/runtime repositories before
installing so your package manager can obtain its dependencies.

To update, install the newer rpm with the same package-manager command. To remove it, use
`sudo dnf remove gpt-voice` on Fedora/RHEL/CentOS or `sudo zypper remove gpt-voice` on openSUSE.

## Linux AppImage

Use the AppImage when you prefer a portable copy rather than a system package.

1. Download `GPT-Voice-*.AppImage`.
2. Make it executable and run it:

   ```bash
   chmod +x GPT-Voice-*.AppImage
   ./GPT-Voice-*.AppImage
   ```

On its first launch, GPT-Voice registers a local desktop launcher and icon for your user when possible. To update,
download the newer AppImage, make it executable, and run it instead of the old file.

To remove an AppImage installation, quit GPT-Voice, run the desktop-integration removal command from that AppImage,
then delete the file:

```bash
./GPT-Voice-*.AppImage --remove-linux-appimage-desktop-integration
```

## Retained Linux data

Removing a deb or rpm package, or deleting an AppImage, does not remove your settings or saved provider session. They
remain in `~/.config/GPT-Voice`. Delete that directory manually only when you want a clean reset.

When installation is complete, continue to [first use](getting-started.md) to connect a transcription provider and
make your first recording.
