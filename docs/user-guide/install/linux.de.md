# Linux

## Linux-Deb-Paket

Installieren Sie für Ubuntu, Debian, Linux Mint, Pop!_OS und ähnliche Distributionen das heruntergeladene Paket:

```bash
sudo apt install ./gpt-voice_*_amd64.deb
```

Wenn Ihr System kein lokales Deb über `apt` installieren kann, verwenden Sie:

```bash
sudo dpkg -i ./gpt-voice_*_amd64.deb
sudo apt-get install -f
```

Das Paket installiert GPT-Voice in `/opt/GPT-Voice`, registriert einen Desktop-Launcher und Symbole und stellt die bereit
`gpt-voice`-Befehl. Starten Sie es über Ihr Anwendungsmenü oder mit `gpt-voice`.

Installieren Sie zum Aktualisieren die neuere Deb mit demselben Befehl `apt install`. Um das Paket zu entfernen, verwenden Sie`sudo apt remove gpt-voice`; Verwenden Sie `sudo apt purge gpt-voice`, wenn Sie auch die Paketkonfiguration entfernen möchten.

## Linux-RPM-Paket

Verwenden Sie für Fedora, RHEL, CentOS, openSUSE und ähnliche Distributionen Ihren Distributionspaketmanager, damit er aufgelöst werden kann
die Paketabhängigkeiten. Verwenden Sie für eine normale Installation nicht einfach `rpm -i`.

```bash
# Fedora, RHEL, CentOS, and compatible distributions
sudo dnf install ./gpt-voice-*.x86_64.rpm

# Older CentOS or RHEL systems
sudo yum install ./gpt-voice-*.x86_64.rpm

# openSUSE
sudo zypper install ./gpt-voice-*.x86_64.rpm
```

Das RPM-Paket installiert denselben Launcher, dieselben Symbole und denselben `gpt-voice`-Befehl wie das Deb-Paket. Sein Release-Asset ist
für `x86_64` Desktop-Systeme. Aktivieren Sie bei einer minimalen Linux-Installation vorher die normalen Desktop-/Laufzeit-Repositorys
installieren, damit Ihr Paketmanager seine Abhängigkeiten erhalten kann.

Installieren Sie zum Aktualisieren das neuere RPM mit demselben Paketmanagerbefehl. Um es zu entfernen, verwenden Sie
`sudo dnf remove gpt-voice` unter Fedora/RHEL/CentOS oder `sudo zypper remove gpt-voice` unter openSUSE.

## Linux AppImage

Verwenden Sie AppImage, wenn Sie eine tragbare Kopie einem Systempaket vorziehen.

1. Laden Sie `GPT-Voice-*.AppImage` herunter.
2. Machen Sie es ausführbar und führen Sie es aus:

   ```bash
   chmod +x GPT-Voice-*.AppImage
   ./GPT-Voice-*.AppImage
   ```

Beim ersten Start registriert GPT-Voice nach Möglichkeit einen lokalen Desktop-Launcher und ein Symbol für Ihren Benutzer. Zum Aktualisieren,
Laden Sie das neuere AppImage herunter, machen Sie es ausführbar und führen Sie es anstelle der alten Datei aus.

Um eine AppImage-Installation zu entfernen, beenden Sie GPT-Voice, führen Sie den Befehl zum Entfernen der Desktop-Integration von diesem AppImage aus.
Dann lösche die Datei:

```bash
./GPT-Voice-*.AppImage --remove-linux-appimage-desktop-integration
```

## Behaltene Linux-Daten

Durch das Entfernen eines Deb- oder RPM-Pakets oder das Löschen eines AppImage werden Ihre Einstellungen oder gespeicherten Anbietersitzungen nicht entfernt. Sie
bleiben in `~/.config/GPT-Voice`. Löschen Sie dieses Verzeichnis nur manuell, wenn Sie einen sauberen Reset wünschen.

Wenn die Installation abgeschlossen ist, fahren Sie mit [erster Verwendung](../getting-started.md) fort, um einen Transkriptionsanbieter zu verbinden und
Machen Sie Ihre erste Aufnahme.
