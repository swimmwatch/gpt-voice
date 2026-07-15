# Paramètres du fournisseur

Choisissez le fournisseur de transcription dans GPT-Voice Command Dock. Pour configurer le fournisseur actuellement sélectionné, ouvrez son contrôle **Connect** ou **Configure** dans l'en-tête. La boîte de dialogue du fournisseur affiche uniquement les contrôles qui s'appliquent à ce fournisseur.

## ChatGPT Web

ChatGPT Web utilise une session de navigateur plutôt qu'une clé API. Sa boîte de dialogue de fournisseur indique si une session est enregistrée.

1. Sélectionnez **ChatGPT Web** dans Command Dock.
2. Ouvrez la boîte de dialogue de son fournisseur et choisissez **Log in** lorsqu'aucune session n'est enregistrée, ou **Log in again** pour remplacer une session enregistrée.
3. Terminez la connexion dans la fenêtre du navigateur GPT-Voice, puis revenez à Command Dock lorsque le fournisseur affiche **Connected**.

Utilisez **Clear session** lorsque vous souhaitez que GPT-Voice oublie l'authentification ChatGPT Web enregistrée. GPT-Voice demande une confirmation avant de l'effacer. La suppression de la session déconnecte ce fournisseur ; reconnectez-vous avant de l’utiliser pour la transcription.

Pour plus de détails sur la propriété du compte, la session de navigateur et la limite du fournisseur, voir [providers](../guides/providers.md).

## OpenAI API

Sélectionnez **OpenAI API** et ouvrez sa boîte de dialogue de fournisseur pour configurer ces champs. Utilisez votre propre clé et votre propre compte OpenAI API ; GPT-Voice ne fournit pas de clé, de crédits ou d'accès aux services OpenAI.

| Champ           | Comportement actuel                                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API key**     | Entrez une nouvelle clé pour l'enregistrer. Le champ est vide lorsqu'il est rouvert même si une clé est stockée, et une sauvegarde vierge ne remplace pas cette clé stockée. |
| **Model**       | `whisper-1` est le seul modèle de transcription disponible. Il s'affiche sous forme de champ en lecture seule.                                                               |
| **Language**    | Choisissez la détection automatique (par défaut), l'anglais, le russe, l'ukrainien ou le biélorusse.                                                                         |
| **Prompt**      | Conseils de transcription facultatifs. La valeur par défaut est vide ; Les espaces de début et de fin sont supprimés lors de l’enregistrement.                               |
| **Temperature** | Contrôle la variation de transcription de 0 à 1. La valeur par défaut est 0 ; le contrôle change par pas de 0,05.                                                            |

Choisissez **Save** pour valider et stocker les modifications. Une sauvegarde réussie ferme la boîte de dialogue. Les valeurs de modèle, de langue ou de température non valides sont rejetées ; si l'enregistrement échoue, la boîte de dialogue affiche un message d'erreur sécurisé et reste ouverte.

## Informations d'identification stockées et effacement de l'authentification

GPT-Voice stocke une clé OpenAI API uniquement via Electron safe storage. La clé elle-même n'est pas affichée dans la boîte de dialogue ; la boîte de dialogue indique à la place qu'une clé API est stockée. Si le stockage sécurisé n'est pas disponible, GPT-Voice ne peut pas enregistrer une nouvelle clé.Utilisez **Clear API key** et confirmez la boîte de dialogue pour supprimer la clé stockée tout en conservant les autres paramètres OpenAI API. Le bouton est disponible uniquement lorsqu'une clé est stockée. Vous devez saisir et enregistrer une nouvelle clé avant que OpenAI API puisse à nouveau transcrire.

Les informations d'identification du fournisseur et l'utilisation du service restent régies par les conditions, la facturation, les quotas et la politique de confidentialité du compte du fournisseur. Ne collez pas de clés dans des demandes d'assistance, des captures d'écran ou de la documentation.
