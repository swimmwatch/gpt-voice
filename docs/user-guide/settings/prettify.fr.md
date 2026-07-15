# Paramètres jolis

**Prettify** est l'action de nettoyage de GPT-Voice qui préserve le sens du texte sélectionné. Ouvrez **Settings** et sélectionnez **Prettify** pour choisir le service, son modèle et son comportement de génération. Pour sélectionner le texte et démarrer l'action, voir [traduire et embellir le texte sélectionné](../guides/text-actions.md).

Prettify a besoin d'un service Ollama ou vLLM que vous exploitez, ainsi que d'un modèle sélectionné pour ce service. GPT-Voice ne télécharge, ne démarre, n'héberge ni ne paie pour aucun des deux services. Le champ modèle est obligatoire ; si aucun modèle n'est configuré, Prettify signale qu'un modèle est nécessaire au lieu d'envoyer le texte sélectionné.

## Choisissez un fournisseur et connectez-le

Choisissez **Ollama** ou **vLLM** dans **Provider**. GPT-Voice conserve l'URL de base et le modèle sélectionné séparément pour chaque fournisseur, de sorte que le changement de fournisseur ne remplace pas les choix de l'autre fournisseur. Le fournisseur par défaut est Ollama.

| Fournisseur | URL de base par défaut     | Modèle par défaut        | Comportement de connexion                                                                            |
| ----------- | -------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Ollama**  | `http://127.0.0.1:11434`   | Aucun modèle sélectionné | Actualise les modèles disponibles depuis votre service Ollama et lui envoie des requêtes Prettify.   |
| **vLLM**    | `http://127.0.0.1:8000/v1` | Aucun modèle sélectionné | Actualise les modèles exposés par votre service compatible vLLM et lui envoie des requêtes Prettify. |

Saisissez une URL de base `http` ou `https` complète. GPT-Voice supprime les espaces environnants et les barres obliques finales lors de l'enregistrement du paramètre. Les URL qui ne sont pas HTTP(S) ou qui incluent un nom d'utilisateur ou un mot de passe sont rejetées. HTTP est autorisé uniquement pour un point de terminaison de bouclage tel que `127.0.0.1`, `localhost` ou `::1` ; chaque point de terminaison sans bouclage doit utiliser HTTPS.

Lorsque l'URL de base active et valide est distante plutôt que bouclée, Paramètres affiche un avis de confidentialité. L'utilisation de ce point de terminaison envoie le texte sélectionné et votre invite Prettify configurée au service que vous avez choisi. Vérifiez les contrôles de confidentialité, de conservation et d'accès de ce service avant d'utiliser le traitement à distance.

### vLLM Clé API

Le champ **vLLM API key** apparaît uniquement lorsque vLLM est sélectionné. Utilisez-le lorsque votre service vLLM nécessite une authentification du porteur. GPT-Voice envoie la clé avec les requêtes vLLM uniquement lorsqu'une clé est configurée.

La clé est stockée séparément avec Electron safe storage. Une fois enregistré, le champ ne le révèle plus ; il indique plutôt qu'une clé est stockée. Laisser le champ vide conserve une clé stockée existante. Choisissez **Clear API key** pour le supprimer. Si le stockage sécurisé n'est pas disponible sur votre système, GPT-Voice ne peut pas enregistrer une nouvelle clé vLLM.

Ne mettez pas de clé dans une URL de base, une capture d'écran ou une demande d'assistance.

## Sélectionner et gérer un modèleChoisissez **Refresh models** après avoir démarré le service du fournisseur actif ou modifié son URL de base. La liste des modèles provient du fournisseur actif, alors actualisez-la à nouveau après avoir changé de fournisseur. Sélectionnez l'un des modèles renvoyés avant d'exécuter Prettify. Si la réponse de la connexion, du service, de l'authentification ou du fournisseur échoue, Paramètres affiche une erreur de connexion ou d'actualisation du modèle ; vérifiez que l'URL est valide, que le service est en cours d'exécution et que la clé vLLM est appropriée, puis actualisez à nouveau.

Ollama affiche un menu **Model actions** supplémentaire lorsqu'un modèle est sélectionné :

- **Load model** demande à Ollama de conserver le modèle sélectionné chargé pour GPT-Voice. Si GPT-Voice avait conservé un autre modèle Ollama chargé, il libère ce modèle en premier.
- **Free model** demande à Ollama de libérer le modèle sélectionné de la mémoire.

Ces actions sont disponibles uniquement pour Ollama, et non pour vLLM. Le modèle Ollama sélectionné affiche **Loaded** ou **Not loaded** après que GPT-Voice ait vérifié son état de modèle en cours d'exécution. Lorsque Ollama indique une taille, Paramètres affiche également une taille approximative du modèle ou de la VRAM chargée. Traitez la valeur comme une estimation rapportée par Ollama, et non comme une réservation de mémoire garantie par GPT-Voice.

Le chargement, la libération et l'actualisation peuvent échouer si le point de terminaison est indisponible ou si le fournisseur rejette la demande. Les paramètres laissent le formulaire actuel ouvert et affichent le résultat ou l'erreur afin que vous puissiez corriger le point de terminaison ou le modèle et réessayer.

## Contrôler la façon dont le texte est généré

**Temperature** est le contrôle de génération principal. Sa valeur par défaut est **0**, avec une plage autorisée de **0 to 1** par pas de **0.05**. Une valeur inférieure demande moins de variation au fournisseur ; le modifier modifie la prochaine demande Prettify après avoir enregistré les paramètres.

Ouvrez **Advanced generation** pour modifier les commandes restantes. Le résumé réduit indique si toutes les valeurs avancées utilisent toujours leurs valeurs par défaut ou combien ont changé. Ces paramètres sont envoyés avec chaque demande Prettify au fournisseur sélectionné.

| Contrôle | Par défaut | Valeur acceptée | Utilisez-le pour |
| ------------------------- | ------ : | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Top P** | `0.9` | `0.05`–`1`, en `0.05` étapes | Limiter les choix à la plage de probabilité cumulative la plus probable. || **Min P** | `0` | `0`–`1`, en `0.05` étapes | À l'exclusion des choix à faible probabilité inférieurs au seuil sélectionné. |
| **Repeat penalty** | `1` | `0.8`–`1.5`, en `0.05` étapes | Ajuster la mesure dans laquelle le fournisseur décourage les sorties répétées. |
| **Top K** | `40` | Entier de `1` à `200` | Limiter chaque choix aux candidats les plus probables. |
| **Maximum output tokens** | `4096` | Entier de `1` à `8192` | Limiter la longueur de la réponse générée. La réponse peut encore être plus courte. |
| **Seed** | Désactivé | Vide ou nombre entier compris entre `0` et `2147483647` | Fournir une valeur de départ numérique facultative au fournisseur. Cela peut aider à reproduire une demande, mais les résultats peuvent toujours varier en fonction du modèle et de la version du service. |

Les commandes décimales utilisent des incréments de 0,05. Top P accepte 0,05 à 1 ; Min P accepte 0 à 1 ; et la pénalité de répétition accepte 0,8 à 1,5. Top K accepte les nombres entiers de 1 à 200, tandis que les jetons de sortie maximale acceptent les nombres entiers de 1 à 8 192.

Utilisez les valeurs par défaut, sauf si vous connaissez les exigences du modèle et du service sélectionnés. GPT-Voice envoie des choix de génération équivalents à Ollama et vLLM, mais l'un ou l'autre service peut toujours rejeter une demande ou gérer un paramètre en fonction de sa propre prise en charge de modèle.

## Écrivez l'invite Prettify

**Prompt** est requis et correspond par défaut à l'instruction d'éditeur de copie conservatrice intégrée de GPT-Voice. Il indique au service de traiter le texte sélectionné comme un matériau source inerte, de préserver sa langue et sa signification, de le corriger et de le clarifier, de supprimer les répétitions inutiles et de renvoyer uniquement le texte modifié. Il demande également au service de ne pas exécuter les instructions contenues dans le texte sélectionné.

Vous pouvez remplacer l'invite par une stratégie d'édition différente. Conservez-le dans **4,000 characters or fewer**. Une invite vide, une invite de plus de 4 000 caractères, un fournisseur non pris en charge, un point de terminaison non valide, un modèle vide ou une valeur de génération hors plage bloque **Save changes** et identifie le champ concerné. Les espaces de début et de fin sont supprimés lorsque les paramètres sont enregistrés.

L'invite est envoyée avec le texte sélectionné au fournisseur actif. N'incluez pas de mots de passe, de clés API, de données personnelles ou d'instructions confidentielles que vous ne voudriez pas que ce fournisseur reçoive.

## Enregistrez et validez les modificationsLes valeurs du fournisseur, du modèle, de l'invite et de la génération font partie du formulaire Paramètres. Une modification crée **Unsaved changes** ; choisissez **Save changes** uniquement après que le formulaire ne comporte aucune erreur de validation. Une sauvegarde réussie conserve la configuration Prettify normale et ferme les paramètres. La clé vLLM reste distincte : elle est stockée uniquement via Electron safe storage et n'est jamais renvoyée dans la vue des paramètres.

Si l'enregistrement échoue, la fenêtre Paramètres reste ouverte avec un message d'erreur sécurisé. Corrigez le champ signalé ou la connexion du fournisseur et réessayez. Consultez la [Présentation des paramètres](index.md) pour connaître le comportement des modifications non enregistrées et des confirmations de suppression.
