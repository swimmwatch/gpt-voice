# Choisir et gérer un fournisseur de transcription

GPT-Voice utilise un seul fournisseur de transcription actif à la fois. Choisissez-le dans le sélecteur **Provider** du Command Dock. Changer le sélecteur change quel fournisseur reçoit l'enregistrement suivant ; il ne transfère pas les sessions, les clés API, la facturation ou l'accès au compte entre les fournisseurs.

| Fournisseur     | Authentification                             | Où l'audio est envoyé                                   |
| --------------- | -------------------------------------------- | ------------------------------------------------------- |
| **ChatGPT Web** | Une session de navigateur ChatGPT connectée. | Via la session ChatGPT connectée.                       |
| **OpenAI API**  | Une clé OpenAI API que vous fournissez.      | Point de terminaison des transcriptions audio d'OpenAI. |

Utilisez uniquement un compte que vous êtes autorisé à utiliser. La disponibilité, la facturation, les quotas, les limites d'utilisation et les conditions de service sont définis par le compte et le service du fournisseur. GPT-Voice ne les contourne pas.

## ChatGPT Web

Sélectionnez **ChatGPT Web**, puis choisissez **Connect**. GPT-Voice ouvre une fenêtre de connexion du navigateur sur ChatGPT. Connectez-vous ici, puis fermez la page de connexion. GPT-Voice enregistre localement la session de navigateur résultante et démarre son navigateur en arrière-plan lors de lancements ultérieurs lorsque la session est toujours utilisable.

Lorsque la session est prête, le fournisseur affiche **Connected**. Si la session expire, GPT-Voice supprime la session stockée inutilisable et vous devez choisir à nouveau **Connect**. Une demande de transcription peut également actualiser une fois son jeton d'accès de courte durée ; cela ne remplace pas une nouvelle connexion lorsque la session sous-jacente n'est plus valide.

Pour vous déconnecter de GPT-Voice, ouvrez les paramètres du fournisseur et utilisez **Clear authentication**. Cela supprime les données de session de navigateur ChatGPT enregistrées par GPT-Voice et le jeton d'accès mis en cache. Il ne gère pas votre compte, votre abonnement ou les sessions détenues par d'autres navigateurs ou appareils.

## OpenAI API

Sélectionnez **OpenAI API** et choisissez **Configure**, ou ouvrez le contrôle des paramètres du fournisseur à côté du sélecteur. Collez votre propre clé API et enregistrez le formulaire. GPT-Voice utilise le modèle de transcription fixe `whisper-1` ; il ne permet pas à ce fournisseur de sélectionner un autre modèle de transcription.

Les paramètres du fournisseur vous permettent également de choisir :

- **Language** : détection automatique (par défaut), anglais, russe, ukrainien ou biélorusse.
- **Prompt** : guidance facultative envoyée avec la demande de transcription.
- **Temperature** : une valeur de `0` à `1` ; la valeur par défaut est `0`.

GPT-Voice stocke la clé API localement avec Electron safe storage lorsque cette protection est disponible et n'affiche jamais la clé enregistrée dans l'interface. Si le stockage sécurisé n'est pas disponible, l'enregistrement d'une nouvelle clé échoue au lieu de la stocker sans cette protection. Le fournisseur OpenAI API n'utilise pas la fenêtre de connexion du navigateur.

Utilisez **Clear authentication** dans les paramètres du fournisseur pour supprimer la clé API enregistrée. Les options de transcription non secrètes restent disponibles pour la prochaine clé que vous configurez, mais le fournisseur n'est connecté que lorsqu'une clé valide est à nouveau enregistrée.

## Changer ou récupérer un fournisseur

Vous pouvez changer de fournisseur avant de démarrer un enregistrement. Confirmez que le fournisseur nouvellement sélectionné est **Connected** avant d'enregistrer ; une session ChatGPT Web configurée et une clé OpenAI API configurée sont indépendantes.

Si la transcription échoue :

1. Vérifiez que le prestataire sélectionné est toujours connecté et que son compte peut utiliser la transcription.
2. Pour **ChatGPT Web**, reconnectez-vous si la session a expiré ou si le navigateur n'a pas pu s'initialiser.
3. Pour **OpenAI API**, confirmez la clé API, la facturation ou le quota ainsi que l'état du service du fournisseur, puis enregistrez toute correction nécessaire.
4. Revenez à [enregistrement et transcription](transcription.md) pour réessayer la capture préparée la plus récente ou démarrer un nouvel enregistrement.

Les paramètres du fournisseur affectent les demandes futures. Ils ne peuvent pas récupérer un enregistrement annulé ni remplacer les erreurs d'accès, de quota, de politique ou de service du côté du fournisseur.
