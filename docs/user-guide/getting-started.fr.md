# Première utilisation : connecter un prestataire et transcrire la parole

Après avoir [installé GPT-Voice](install.md), connectez un fournisseur de transcription, autorisez l'accès au microphone et créez un
court enregistrement. GPT-Voice copie une transcription réussie dans le presse-papiers ; il ne tape pas automatiquement dans le
application que vous utilisiez.

## 1. Choisissez un fournisseur de transcription

Ouvrez GPT-Voice et choisissez **ChatGPT Web** ou **OpenAI API** dans le sélecteur **Provider** dans le Command Dock.

| Fournisseur     | Ce dont vous avez besoin                                                  | Action pour la première fois                                                              |
| --------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **ChatGPT Web** | Un compte ChatGPT auquel vous pouvez vous connecter.                      | Sélectionnez-le, puis choisissez **Connect** et terminez la connexion au navigateur.      |
| **OpenAI API**  | Votre propre clé OpenAI API et la facturation ou le quota API disponible. | Sélectionnez-le, puis choisissez **Configure** pour ouvrir les paramètres du fournisseur. |

La disponibilité, les limites, la facturation et les conditions du fournisseur sont contrôlées par le compte que vous utilisez. GPT-Voice ne contourne pas
ces limites.

### Connecter ChatGPT Web

1. Sélectionnez **ChatGPT Web**.
2. Choisissez **Connect**.
3. Complétez la connexion ChatGPT dans la fenêtre du navigateur qui s'ouvre.
4. Une fois que ChatGPT est prêt, fermez cette fenêtre de connexion et revenez à GPT-Voice.

L'état du fournisseur passe à **Connected** lorsque la session est prête. GPT-Voice enregistre la session du navigateur dans votre
données de l'application locale et démarre automatiquement son navigateur en arrière-plan lors des lancements ultérieurs. Si la session expire, choisissez
**Connect** à nouveau pour vous reconnecter.

### Configurer OpenAI API

1. Sélectionnez **OpenAI API**.
2. Choisissez **Configure**. Vous pouvez également utiliser le contrôle des paramètres du fournisseur à côté du sélecteur de fournisseur.
3. Collez votre clé OpenAI API.
4. Choisissez éventuellement une langue de transcription, une invite ou une température.
5. Choisissez **Save**.

Le modèle de transcription est fixé sur `whisper-1`. Après une sauvegarde réussie, GPT-Voice affiche le fournisseur comme
**Connected** et signale que le fournisseur est configuré. L'application stocke la clé API localement à l'aide d'Electron
stockage sûr lorsqu'il est disponible ; la clé n'est pas affichée dans l'interface. La transcription OpenAI API n'utilise pas de
navigateur.

## 2. Autoriser l'accès au microphone

Le premier enregistrement demande à votre système d'exploitation l'autorisation du microphone. Autoriser l'accès à GPT-Voice, puis revenir à
le Command Dock. Si l'accès est refusé ou qu'aucun microphone n'est disponible, l'état indique **Erreur : accès impossible
microphone** et aucun son n’est envoyé. Activez l'autorisation dans les contrôles de confidentialité de votre système d'exploitation avant d'essayer
encore une fois.

## 3. Faire un premier enregistrement

1. Sélectionnez un fournisseur qui affiche **Connected**.
2. Choisissez **Start recording** ou appuyez sur le raccourci d'enregistrement affiché (la valeur par défaut est `F9`).3. Prononcez une courte phrase. Le statut passe à **Recording**.
3. Choisissez **Stop recording** (par défaut `F10`). GPT-Voice change l'état en **Transcribing** pendant qu'il envoie le
   l'audio capturé au fournisseur sélectionné.
4. Attendez **Copied to clipboard**, puis collez-le dans n'importe quel champ de texte pour confirmer le résultat.

Vous pouvez également mettre en pause, reprendre ou annuler un enregistrement actif à partir du Command Dock. L'annulation supprime l'actif
enregistrement au lieu de l’envoyer pour transcription.

## Si la première transcription ne fonctionne pas

- Si **Connected** ne s'affiche pas, rouvrez les contrôles du fournisseur et terminez la connexion ou enregistrez une clé API valide. Pour
  ChatGPT Web, l'état peut indiquer à la place que l'initialisation du navigateur a échoué ou que la session a expiré.
- Si l'état signale une erreur de microphone, autorisez GPT-Voice à utiliser votre microphone dans le système d'exploitation et effectuez une
  nouvel enregistrement.
- Si le statut indique **Transcription failed** ou **Transcription error**, vérifiez le compte du fournisseur sélectionné,
  connexion et limites, puis réessayez. Une transcription échouée n’est pas copiée dans le presse-papiers.

Les pages de guide suivantes couvrent plus en détail les commandes d'enregistrement, le comportement du fournisseur, les raccourcis et le dépannage. Pour
maintenant, un fournisseur **Connected** et un résultat **Copied to clipboard** confirment que le chemin de base fonctionne.
