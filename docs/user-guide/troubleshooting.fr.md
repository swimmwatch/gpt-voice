# Dépannage

Commencez par le message d'état visible et la fonctionnalité que vous utilisiez. Ne collez pas de clés API, de mots de passe proxy,
ChatGPT données de session, texte dicté, texte sélectionné ou captures d'écran les contenant dans une demande d'assistance. Un utile
le rapport sécurisé inclut la version GPT-Voice, le système d'exploitation, le type de package, la fonctionnalité, le message exact non sensible et
étapes qui reproduisent le problème.

## Le microphone ne peut pas démarrer

Si le Command Dock affiche **Could not access microphone** :

1. Confirmez qu'un microphone est connecté et disponible pour d'autres applications.
2. Autorisez GPT-Voice à utiliser le microphone dans les contrôles de confidentialité de votre système d'exploitation.
3. Fermez les autres logiciels qui ont le contrôle exclusif de l'appareil, puis démarrez un nouvel enregistrement.
4. Si le périphérique a changé alors que GPT-Voice était ouvert, reconnectez-le et redémarrez GPT-Voice avant de réessayer.

Aucun audio n'est envoyé jusqu'à ce que GPT-Voice ait démarré un enregistrement et que vous l'arrêtiez. Pour les contrôles d'enregistrement et la limite de tentatives,
voir [enregistrer et transcrire](guides/transcription.md).

## La session ChatGPT Web est déconnectée

Si **ChatGPT Web** n'est pas **Connected**, la fenêtre de connexion du navigateur ne se termine pas ou la session a expiré :

1. Vérifiez que l'ordinateur peut atteindre ChatGPT et que le compte est autorisé à utiliser le service.
2. Sélectionnez **Connect** et complétez la connexion dans la fenêtre du navigateur GPT-Voice.
3. Si la session stockée n'est plus valide, utilisez **Clear session**, confirmez-la et reconnectez-vous.
4. Si l'initialisation ou la connexion du navigateur échoue toujours, testez temporairement sans proxy, puis examinez le navigateur.
   et les paramètres réseau ci-dessous.

Effacer une session supprime la session locale enregistrée de GPT-Voice ; cela ne change pas le compte ou les sessions dans d'autres
navigateurs. Voir [Paramètres du fournisseur](settings/providers.md).

## OpenAI API la transcription échoue

Pour **OpenAI API**, vérifiez que le fournisseur est sélectionné et configuré avec votre propre clé API valide. Confirmez le
la facturation, le quota, les limites d'utilisation et l'état du service du compte du fournisseur, puis enregistrez toute correction et réessayez le préparé.
enregistrement s’il est encore disponible. GPT-Voice utilise le modèle de transcription fixe `whisper-1` ; il n'y a pas de modèle
sélection à réparer pour ce fournisseur.

Laissez une clé enregistrée existante en dehors des rapports et des captures d'écran. Si vous devez la remplacer, entrez la nouvelle clé et enregistrez-la ; utiliser
**Clear API key** lorsque vous souhaitez que GPT-Voice l'oublie. Voir [paramètres du fournisseur](settings/providers.md) et
[fournisseurs](guides/providers.md).

## Prettify ne parvient pas à joindre un modèle

Avant que Prettify puisse traiter le texte sélectionné, son fournisseur, son point de terminaison et son modèle doivent être valides :

1. Dans **Settings** > **Prettify**, sélectionnez le fournisseur souhaité : Ollama ou vLLM.
2. Confirmez que le service local ou distant est en cours d'exécution et accessible depuis cet ordinateur.
3. Vérifiez l'adresse du fournisseur et le nom du modèle, puis utilisez **Load model** lorsque le modèle sélectionné n'est pas prêt.
4. Pour vLLM, fournissez une clé API uniquement lorsque ce point de terminaison en nécessite une. Pour un point de terminaison distant, utilisez HTTPS et confirmezque vous êtes autorisé à y envoyer le texte sélectionné.
5. Enregistrez les paramètres valides avant d'exécuter à nouveau le raccourci.

GPT-Voice n'installe ni n'utilise Ollama ou vLLM. Voir [Paramètres Prettify](settings/prettify.md) pour le champ
exigences et [actions de texte](guides/text-actions.md) pour les limites et l'annulation du texte sélectionné.

## Le proxy ou le service de navigateur ne peut pas se connecter

ChatGPT Web et Traduction utilisent les contextes de navigateur GPT-Voice. Si l'un ou l'autre service fonctionne sans le proxy mais pas avec celui-ci :

1. Désactivez temporairement **Proxy enabled** et enregistrez le paramètre pour isoler le proxy du service.
2. Lors de sa réactivation, utilisez une URL de serveur `http://`, `https://` ou `socks5://` accessible et mettez HTTP/HTTPS
   qualifications dans leurs domaines dédiés.
3. Supprimez les informations d'identification SOCKS5 : CloakBrowser ne les prend pas en charge.
4. Si **GeoIP** est activé, n'oubliez pas qu'il contrôle les paramètres régionaux et le fuseau horaire du navigateur. Désactivez GeoIP pour tester le fichier enregistré
   Valeurs d’identité du navigateur directement.

En cas d'erreur d'exécution du navigateur, réessayez d'abord une fois le réseau stable, puis testez le proxy comme ci-dessus. Définir **Arrière-plan
navigateur** to **Visible** temporairement si vous devez observer le contexte du navigateur pendant que vous reproduisez le problème ; restaurer
le réglage habituel **Hidden** par la suite. Voir [Paramètres du navigateur](settings/browser.md) et
[Paramètres réseau](settings/network.md).

## Un raccourci ne s'exécute pas

Ouvrez **Settings** > **Shortcuts** et confirmez que l'action est activée, le raccourci affiché est celui sur lequel vous appuyez,
et la modification a été enregistrée. GPT-Voice rejette les conflits entre ses propres raccourcis, mais une autre application ou le
Le système d'exploitation peut toujours réserver la même combinaison.

Choisissez un autre raccourci, enregistrez-le et réessayez pendant que GPT-Voice est inactif. Les actions de texte sélectionné attendent également qu'un
l'enregistrement actif se termine et Translation et Prettify ne peuvent pas s'exécuter en même temps. Voir
[paramètres de raccourci](settings/shortcuts.md).

## Le Presse-papiers ou le texte sélectionné n'apparaissent pas

Pour une transcription, attendez **Copied to clipboard** avant de coller. Une transcription échouée n’est pas copiée. Pour
Traduction ou Prettify, sélectionnez le texte dans l'application source avant d'appuyer sur le raccourci d'action ; Prettify accepte
jusqu'à 16 000 caractères.

En cas d'échec ou d'annulation, GPT-Voice restaure la valeur du presse-papiers qu'il a capturée avant l'action du texte sélectionné. Un
un résultat réussi remplace le presse-papiers. Confirmez que l'application source autorise les opérations de copie normales ; sous Linux,
GPT-Voice peut également utiliser le presse-papiers de sélection lorsque l'automatisation normale de la copie échoue. Voir
[Traduire et embellir le texte sélectionné](guides/text-actions.md).

## Problème d'installation, de mise à jour ou de lancement

Téléchargez uniquement le package qui correspond à votre plate-forme à partir de la version officielle de GitHub et comparez sa valeur SHA-256
avec le fichier de somme de contrôle qui l'accompagne. Exécutez à nouveau le programme d'installation de Windows pour mettre à jour une installation existante. Sous Linux, utilisez
la commande package-manager documentée pour les packages deb ou rpm, ou rendez l'AppImage exécutable avant de l'exécuter.Aucun package macOS n’est pris en charge pendant que la signature et la notarisation sont suspendues. Si GPT-Voice ne se lance pas après un
l'installation ou la mise à jour, redémarrez l'ordinateur, réessayez le package vérifié et vérifiez que le temps d'exécution normal du bureau
des dépendances sont disponibles. Ne supprimez pas les données d'application conservées dans un premier temps ; il contient les paramètres et enregistré
données du fournisseur. Suivez [installer, mettre à jour ou supprimer](install.md) pour connaître le package exact et la procédure de suppression.

## Si le problème persiste

Essayez la plus petite reproduction sûre : un court enregistrement non sensible, un échantillon de texte sélectionné non sensible ou un
vérification temporaire par procuration. Enregistrez la version, la plate-forme, le package, la zone de configuration et l'erreur visible sans copier
informations d’identification ou contenu privé. Les guides associés ci-dessus décrivent le comportement pris en charge et la récupération disponible
contrôles.
