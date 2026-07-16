# Linux

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

Une fois l'installation terminée, continuez avec [première utilisation](../getting-started.md) pour connecter un fournisseur de transcription et
faites votre premier enregistrement.
