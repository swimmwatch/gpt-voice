# Installer, mettre à jour ou supprimer GPT-Voice

GPT-Voice propose des versions prêtes à l'emploi pour Windows et Linux. Vous n'avez pas besoin de Node.js, npm, d'un modèle local, de CUDA ou
Whisper installé séparément.

Téléchargez le package pour votre ordinateur depuis [GitHub Releases](https://github.com/swimmwatch/gpt-voice/releases).
Chaque version comprend également des fichiers `SHA256SUMS-*.txt` spécifiques à la plate-forme. Pour vérifier un téléchargement, comparez la valeur SHA-256
signalé par l'outil de somme de contrôle de votre système d'exploitation avec l'entrée correspondant à la ressource de version que vous avez téléchargée.

> Les versions macOS sont suspendues pendant la préparation de la signature et de la notarisation de l'ID de développeur. N'installez pas de DMG non officiel
> comme GPT-Voice ; il n'existe aucun package macOS pris en charge dans les versions actuelles.

## Choisissez un élément de version

| Plateforme                 | Libérer l'actif          | Utilisez-le lorsque                                                              |
| -------------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| Fenêtres                   | `GPT-Voice Setup *.exe`  | Vous voulez une installation Windows normale.                                    |
| Linux de la famille Debian | `gpt-voice_*_amd64.deb`  | Vous utilisez Ubuntu, Debian, Linux Mint, Pop!_OS ou une distribution similaire. |
| Famille RPM Linux          | `gpt-voice-*.x86_64.rpm` | Vous utilisez Fedora, RHEL, CentOS, openSUSE ou une distribution similaire.      |
| Linux                      | `GPT-Voice-*.AppImage`   | Vous voulez une version portable sans installer de package système.              |

## Fenêtres

1. Téléchargez `GPT-Voice Setup *.exe` à partir de la dernière version et ouvrez-la.
2. Choisissez un emplacement d'installation si vous y êtes invité.
3. Gardez les raccourcis du bureau et du menu Démarrer activés, sauf si vous préférez lancer l'application manuellement.
4. Terminez le programme d'installation, puis ouvrez **GPT-Voice** à partir du menu Démarrer, du raccourci sur le bureau ou de l'écran final du programme d'installation.

Le package Windows est un programme d'installation NSIS. Il installe GPT-Voice, son environnement d'exécution de navigateur fourni, des icônes, des raccourcis et un
entrée du programme de désinstallation dans les paramètres Windows.

### Mettre à jour ou supprimer sous Windows

Pour mettre à jour, téléchargez le nouveau `GPT-Voice Setup *.exe` et exécutez-le sur l'installation existante.

Pour supprimer l'application :

1. Ouvrez **Settings** > **Apps** > **Installed apps**.
2. Recherchez **GPT-Voice**.
3. Sélectionnez **Uninstall**.

La suppression de l'application supprime les fichiers installés et les raccourcis, mais conserve délibérément vos paramètres locaux et enregistrés
session du fournisseur dans `%APPDATA%\GPT-Voice`. Cela permet à une réinstallation de les réutiliser. Supprimez ce dossier manuellement uniquement lorsque vous
souhaitez également supprimer ces données locales.

## Package de développement Linux

Pour Ubuntu, Debian, Linux Mint, Pop!_OS et les distributions similaires, installez le package téléchargé :

```bash
sudo apt install ./gpt-voice_*_amd64.deb
```

Si votre système ne peut pas installer un deb local via `apt`, utilisez :

```bash
sudo dpkg -i ./gpt-voice_*_amd64.deb
sudo apt-get install -f
```

Le package installe GPT-Voice dans `/opt/GPT-Voice`, enregistre un lanceur de bureau et des icônes et fournit le
Commande `gpt-voice`. Lancez-le depuis le menu de votre application ou avec `gpt-voice`.

Pour mettre à jour, installez le nouveau deb avec la même commande `apt install`. Pour supprimer le package, utilisez`sudo apt remove gpt-voice` ; utilisez `sudo apt purge gpt-voice` si vous souhaitez également supprimer la configuration du package.

## Paquet RPM Linux

Pour Fedora, RHEL, CentOS, openSUSE et les distributions similaires, utilisez votre gestionnaire de packages de distribution afin qu'il puisse résoudre
les dépendances du package. N'utilisez pas de simple `rpm -i` pour une installation normale.

```bash
# Fedora, RHEL, CentOS, and compatible distributions
sudo dnf install ./gpt-voice-*.x86_64.rpm

# Older CentOS or RHEL systems
sudo yum install ./gpt-voice-*.x86_64.rpm

# openSUSE
sudo zypper install ./gpt-voice-*.x86_64.rpm
```

Le package rpm installe le même lanceur, les mêmes icônes et la même commande `gpt-voice` que le package deb. Son actif de sortie est
pour les systèmes de bureau `x86_64`. Sur une installation Linux minimale, activez les référentiels de bureau/runtime normaux avant
installation afin que votre gestionnaire de paquets puisse obtenir ses dépendances.

Pour mettre à jour, installez le RPM le plus récent avec la même commande package-manager. Pour le supprimer, utilisez
`sudo dnf remove gpt-voice` sur Fedora/RHEL/CentOS ou `sudo zypper remove gpt-voice` sur openSUSE.

## Linux AppImage

Utilisez AppImage lorsque vous préférez une copie portable plutôt qu’un package système.

1. Téléchargez `GPT-Voice-*.AppImage`.
2. Rendez-le exécutable et exécutez-le :

   ```bash
   chmod +x GPT-Voice-*.AppImage
   ./GPT-Voice-*.AppImage
   ```

Lors de son premier lancement, GPT-Voice enregistre un lanceur de bureau local et une icône pour votre utilisateur lorsque cela est possible. Pour mettre à jour,
téléchargez la nouvelle AppImage, rendez-la exécutable et exécutez-la à la place de l'ancien fichier.

Pour supprimer une installation AppImage, quittez GPT-Voice, exécutez la commande de suppression de l'intégration de bureau à partir de cette AppImage,
puis supprimez le fichier :

```bash
./GPT-Voice-*.AppImage --remove-linux-appimage-desktop-integration
```

## Données Linux conservées

La suppression d'un package deb ou rpm, ou la suppression d'une AppImage, ne supprime pas vos paramètres ni la session de fournisseur enregistrée. Ils
rester dans `~/.config/GPT-Voice`. Supprimez ce répertoire manuellement uniquement lorsque vous souhaitez une réinitialisation propre.

Une fois l'installation terminée, continuez avec [première utilisation](getting-started.md) pour connecter un fournisseur de transcription et
faites votre premier enregistrement.
