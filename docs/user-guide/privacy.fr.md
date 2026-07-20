# Confidentialité et données

GPT-Voice gère la parole, le texte sélectionné, les informations d'identification et les paramètres du navigateur. Cette page explique les chemins de données actuels
et les contrôles disponibles pour supprimer des données. Il ne remplace pas la politique de confidentialité ou les conditions de tout service que vous choisissez
utiliser.

## Flux de données

GPT-Voice envoie des données en dehors de votre ordinateur uniquement lorsque vous utilisez une fonctionnalité soutenue par un service externe :

| Fonctionnalité                     | Données envoyées                                                       | Destination                                             |
| ---------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| Transcription avec **ChatGPT Web** | L'enregistrement préparé                                               | ChatGPT via votre session de navigateur connectée       |
| Transcription avec **OpenAI API**  | Les options d'enregistrement préparées et de transcription configurées | Point de terminaison des transcriptions audio de OpenAI |
| **Translate**                      | Le texte sélectionné                                                   | Google Translate                                        |
| **Prettify**                       | Le texte sélectionné et votre invite Prettify configurée               | Votre point de terminaison Ollama ou vLLM configuré     |

Utilisez des comptes et des points de terminaison en qui vous avez confiance et examinez leurs conditions de gestion des données. Un point de terminaison de bouclage local Ollama ou vLLM
conserve la requête sur la machine exécutant ce service ; un point de terminaison distant reçoit le texte. Utilisez HTTPS pour un
Point de terminaison Prettify sans bouclage. Les services basés sur un navigateur peuvent utiliser le proxy configuré dans [Paramètres réseau](settings/network.md).

GPT-Voice écrit les résultats de transcription, de traduction et de Prettify réussis dans le presse-papiers du système. Le fonctionnement
le système et d'autres applications ayant accès au presse-papiers peuvent conserver ou lire cette valeur ; Effacez-le ou remplacez-le après le collage
sortie sensible.

## Données locales et mémoire temporaire

| Données                              | Où et combien de temps est-il conservé                                                                                                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historique de transcription réussie  | Données SQLite locales à `gpt-voice.sqlite3`, avec l'heure de la demande, l'ID et le nom du fournisseur, ainsi que le texte de transcription. Il ne stocke pas l'audio enregistré.                                                |
| Enregistrement réessayable           | L'audio préparé le plus récent est conservé uniquement dans la mémoire de l'application en cours d'exécution après un échec de transcription. Le démarrage d'un nouvel enregistrement ou le redémarrage de GPT-Voice le supprime. |     | Joli cache de résultats | Jusqu'à 20 résultats sont conservés en mémoire pendant 60 secondes maximum. Le contexte du cache dépend du texte sélectionné, de l'invite et des paramètres du fournisseur configurés ; il est supprimé à la sortie de GPT-Voice. |
| Paramètres et identité du navigateur | Stocké dans les données d'application locales de GPT-Voice et utilisé pour les lancements ultérieurs.                                                                                                                             |
| ChatGPT Web authentification         | Données de session de navigateur local et d'authentification. Utilisez le contrôle du fournisseur pour l’effacer.                                                                                                                 |

Les actions de texte sélectionné lisent et remplacent temporairement le contenu du presse-papiers pendant qu'elles collectent une sélection. Si la traduction ou
Prettify échoue ou est annulé, GPT-Voice restaure la valeur du presse-papiers qu'il a capturée avant l'action. En cas de succès, le
le résultat reste dans le presse-papiers pour que vous puissiez le coller.

## Informations d'identification et qualifications en matière de chiffrement

Les clés OpenAI API, les clés API vLLM et les mots de passe proxy HTTP/HTTPS sont stockés via Electron safe storage lorsque cela
une protection est disponible. GPT-Voice ne renvoie pas ces valeurs enregistrées dans leurs vues de paramètres. Si un stockage sécurisé est
indisponible, GPT-Voice ne peut pas enregistrer un nouveau secret via ce contrôle.

Il ne s’agit pas d’une revendication globale de chiffrement pour chaque fichier du répertoire application-data. En particulier, la transcription
l'historique, les paramètres ordinaires et les données de session ChatGPT Web ont leur propre comportement de stockage local. Ne partagez pas de clés API,
mots de passe proxy, informations de session, texte dicté ou captures d'écran les contenant.

## Supprimer ou réinitialiser des données

Choisissez le contrôle le plus étroit qui répond à vos besoins :

1. Dans la fenêtre Historique, utilisez **Clear history** pour supprimer définitivement toutes les entrées de transcription enregistrées. Voir
   [historique et bac](guides/history-and-tray.md).
2. Dans les contrôles du fournisseur de transcription, utilisez **Clear session** pour ChatGPT Web ou **Clear API key** pour OpenAI API.
   Voir [Paramètres du fournisseur](settings/providers.md).
3. Utilisez le contrôle **Clear API key** dans [Prettify settings](settings/prettify.md) et le contrôle de mot de passe **Clear**
   dans [Paramètres réseau](settings/network.md), le cas échéant.
4. Remplacez ou effacez le presse-papiers du système séparément s'il contient une sortie que vous ne souhaitez plus pouvoir coller.
5. Pour une réinitialisation locale complète, quittez GPT-Voice de la barre d'état et supprimez son répertoire de données d'application conservé :
   `%APPDATA%\GPT-Voice` sous Windows ou `~/.config/GPT-Voice` sous Linux. Cela supprime les applications locales gérées
   les paramètres, l'historique et les données enregistrées du fournisseur, et nécessite une nouvelle configuration après la réinstallation ou la relance.

La suppression des données locales est irréversible. La désinstallation de l'application seule conserve intentionnellement ces répertoires ; voir
[installer, mettre à jour ou supprimer](install.md) pour le comportement de désinstallation spécifique à la plate-forme.

## Guides associés

- [Enregistrer et transcrire](guides/transcription.md) explique la soumission temporaire de l'audio et du fournisseur réessayable.- [Traduire et embellir le texte sélectionné](guides/text-actions.md) explique la restauration du presse-papiers et les actions de texte à distance.
- [Choisir et gérer un fournisseur de transcription](guides/providers.md) explique les comptes et les sessions du fournisseur.
