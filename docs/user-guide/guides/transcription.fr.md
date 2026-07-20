# Enregistrer et transcrire

Avant d'enregistrer, connectez un fournisseur qui affiche **Connected** et autorisez GPT-Voice à utiliser votre microphone. Voir
[utilisez d'abord](../getting-started.md) si vous n'avez pas terminé cette configuration, ou consultez le [guide du fournisseur](providers.md)
pour les détails de connexion et de compte.

## Cycle de vie de l'enregistrement

Démarrez un enregistrement à partir du Command Dock ou avec le raccourci d'enregistrement configuré (la valeur par défaut est `F9`). Le statut
passe de **Ready** à **Recording** une fois la capture du microphone démarrée. Pendant l'enregistrement, l'action principale est
**Stop recording** (par défaut `F10`).

| Actions             | Quand il sera disponible                                           | Que se passe-t-il                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Start recording** | GPT-Voice est inactif.                                             | Demande l’accès au microphone et commence une nouvelle capture. Le démarrage d’une nouvelle capture efface tout son réessayable de la précédente. |
| **Pause**           | Une capture est en cours d'enregistrement.                         | Met en pause la capture en cours sans la soumettre.                                                                                               |
| **Resume**          | Une capture est interrompue.                                       | Continue la même capture.                                                                                                                         |
| **Stop recording**  | Une capture est en cours d'enregistrement ou en pause.             | Termine la capture, prépare l'audio et l'envoie au fournisseur sélectionné.                                                                       |
| **Cancel**          | GPT-Voice est en cours de démarrage, d'enregistrement ou en pause. | Arrête et abandonne la capture active ; il n'est pas envoyé pour transcription.                                                                   |

Pendant que GPT-Voice s'arrête, prépare l'audio, transcrit ou réessaye, attendez la fin de l'opération en cours.
avant de commencer un autre enregistrement. Le Command Dock affiche un état de traitement pendant ce temps.

## Que se passe-t-il après votre arrêt

Après **Stop recording**, GPT-Voice prépare l'audio capturé et affiche **Transcribing**. Il envoie le préparé
audio au fournisseur sélectionné dans le Command Dock :

- **ChatGPT Web** envoie l'audio via la session de navigateur ChatGPT connectée.
- **OpenAI API** envoie l'audio au point de terminaison de transcription de OpenAI à l'aide de la clé API que vous avez configurée.

La disponibilité du fournisseur, l'accès au compte, la facturation, les quotas et les conditions de service sont contrôlés par le compte de ce fournisseur.
GPT-Voice ne contourne pas ces contrôles.

En cas de succès, GPT-Voice copie le texte renvoyé dans le presse-papiers de votre système et change le statut en **Copié dans
presse-papiers** et demande une notification de réussite. Collez le texte dans l'application que vous utilisiez. GPT-Voice égalementenregistre le texte, le nom du fournisseur et l'heure de la demande dans son historique de transcription local ; les contrôles d'historique sont
documenté séparément.

## Réessayez une transcription ayant échoué

Une fois que GPT-Voice a préparé une capture non vide, il conserve cet audio préparé en mémoire comme l'audio réessayable le plus récent.
enregistrement. Si la demande de transcription échoue, utilisez l'action de nouvelle tentative de transcription configurée lorsque GPT-Voice est inactif pour
envoyez à nouveau le même audio préparé. Réessayer n’enregistre pas à nouveau le microphone.

Cette nouvelle tentative de copie est volontairement temporaire :

- Il est effacé avant de commencer un nouvel enregistrement.
- Il n'est pas disponible lors de l'enregistrement, du traitement ou d'une nouvelle tentative.
- Il est conservé uniquement dans la mémoire de l'application en cours d'exécution ; le redémarrage de GPT-Voice le supprime.

Réessayer est un moyen de répéter une soumission ayant échoué après avoir corrigé un problème de connexion, de session ou de fournisseur. Ce n'est pas le cas
modifier les limites du fournisseur, restaurer une session de compte expirée ou garantir qu'un fournisseur acceptera la demande.

## Si l'enregistrement ou la transcription échoue

- **Could not access microphone** signifie que GPT-Voice n'a pas pu obtenir de flux audio. Vérifiez le système d'exploitation
  autorisation de confidentialité du microphone, confirmez qu'un microphone est connecté, puis démarrez un nouvel enregistrement.
- **Transcription failed** signifie que le fournisseur a renvoyé un résultat infructueux. Vérifiez le compte du fournisseur, le réseau,
  la disponibilité du service et les limites applicables avant de réessayer.
- **Transcription error** signifie que GPT-Voice n'a pas pu terminer la préparation ou la demande. La notification d'échec et
  L'état Command Dock fournit le message d'erreur sécurisé destiné à l'utilisateur ; le texte ayant échoué n'est pas copié dans le presse-papiers.
- Si une session ChatGPT Web a expiré, reconnectez-la avant de réessayer. Si une clé OpenAI API est manquante ou rejetée,
  corrigez-le dans les paramètres du fournisseur avant de réessayer.

L'annulation d'un enregistrement actif est différente d'une soumission ayant échoué : l'annulation supprime la capture avant qu'elle ne soit
préparé ou envoyé, il n’y a donc pas de transcription réessayable pour cet enregistrement.
