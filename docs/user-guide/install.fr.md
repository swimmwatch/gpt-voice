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

## Guides par système d’exploitation

Choisissez votre système d’exploitation pour consulter les étapes détaillées d’installation, de mise à jour et de suppression.

- [Windows](install/windows.md)

- [Linux](install/linux.md)

- [macOS](install/macos.md)

Lorsque l’installation est terminée, passez à la [première utilisation](getting-started.md) pour connecter un fournisseur de transcription et réaliser le premier enregistrement.
