# Traduire et embellir le texte sélectionné

GPT-Voice peut agir sur le texte sélectionné dans une autre application. **Translate** envoie la sélection à Google Translate dans le
langue cible que vous choisissez. **Prettify** l'envoie à votre fournisseur de traitement de texte configuré pour améliorer le texte
selon son invite. Aucune des deux actions n'est collée dans l'autre application : en cas de succès, copiez le résultat depuis le système.
presse-papiers et collez-le là où vous en avez besoin.

## Activer une action et choisir son raccourci

Ouvrez **Settings** et sélectionnez **Shortcuts**. Les lignes **Translate** et **Prettify** ont chacune un interrupteur d'activation et un
Contrôle **Change** pour leur raccourci global. Les deux actions sont activées par défaut ; leurs raccourcis par défaut sont `F11`
pour Translate et `F12` pour Prettify. Enregistrez les paramètres après avoir effectué une modification.

Choisissez un raccourci qui n'entre pas en conflit avec un autre raccourci GPT-Voice ou avec le logiciel que vous utilisez. Une action désactivée
ne s'exécute pas lorsque son raccourci est enfoncé. Une action attend également la fin d'un enregistrement actif et GPT-Voice s'exécute
une seule action de texte sélectionné à la fois.

## Traduire une sélection

1. Dans l'application contenant le texte, sélectionnez le texte que vous souhaitez traduire.
2. Dans le GPT-Voice Command Dock, choisissez **Target language** : anglais, russe, ukrainien ou biélorusse.
3. Appuyez sur le raccourci Traduire activé (par défaut, `F11`).
4. Attendez la notification de réussite, puis collez le texte traduit depuis votre presse-papiers.

GPT-Voice copie le texte sélectionné à l'aide de l'action de copie normale du système d'exploitation, puis le soumet à Google.
Traduire. La traduction est un service externe : le texte sélectionné est envoyé à Google Translate, n'utilisez donc pas cette action
pour les textes que vous n'êtes pas autorisé à partager avec ce service.

S'il n'y a pas de texte sélectionné, la copie ne peut pas être automatisée ou le service ne peut pas renvoyer de résultat, GPT-Voice signale un
message d'erreur sécurisé et restaure la valeur du presse-papiers qui était présente avant l'action. Sous Linux, il peut également utiliser le
presse-papiers de sélection lorsque l’action de copie normale échoue. Une traduction réussie remplace le presse-papiers du système par le
résultat traduit.

## Embellir une sélection

Avant d'utiliser Prettify, ouvrez **Settings** et sélectionnez **Prettify**. Choisissez soit **Ollama** ou **vLLM**, définissez le fournisseur
adresse et modèle, et enregistrez une configuration valide. vLLM peut également nécessiter une clé API.

1. Sélectionnez jusqu'à 16 000 caractères dans l'application que vous modifiez.
2. Appuyez sur le raccourci Prettify activé (par défaut, `F12`).
3. Attendez la notification **Text prettified**, puis collez le résultat depuis votre presse-papiers.

Ollama et vLLM sont des dépendances gérées par l'utilisateur : GPT-Voice n'installe, n'héberge ni ne gère aucun des deux services. Un local
Le point de terminaison de bouclage conserve la requête sur la machine exécutant ce service. Un point de terminaison distant reçoit le texte sélectionné ;
utilisez un fournisseur de confiance, suivez sa politique de gestion des données et utilisez HTTPS pour un point de terminaison non local.Si aucun texte n'est sélectionné, la sélection dépasse 16 000 caractères, le fournisseur configuré n'est pas joignable ou il
ne renvoie aucun résultat utilisable, GPT-Voice signale l'échec et restaure le contenu précédent du presse-papiers. Pendant qu'un joli
La requête est en cours d'exécution, le raccourci d'annulation configuré (par défaut `Escape`) l'annule et restaure cette valeur du presse-papiers.

## Presse-papiers et actions simultanées

Translation et Prettify s’excluent intentionnellement mutuellement. Démarrer l'un pendant que l'autre travaille déjà par sauts
la nouvelle demande, attendez donc le statut ou la notification avant de réessayer. En cas de succès, le résultat remplace le
presse-papiers ; en cas d'échec ou d'annulation d'une requête, GPT-Voice restaure la valeur du presse-papiers qu'il a capturée avant de lire le
sélection. Vérifiez toujours le résultat collé, en particulier lorsque le texte source contient des noms, du code ou d'autres valeurs exactes.
