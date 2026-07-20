# Historique et plateau de transcription

GPT-Voice conserve un historique local des transcriptions réussies afin que vous puissiez réutiliser un résultat une fois qu'il a quitté le presse-papiers.
La barre d'état permet d'accéder à l'application lorsque sa fenêtre principale est masquée.

## Réutiliser l'historique des transcriptions

Ouvrez le menu de la barre d'état et choisissez **History**. Chaque transcription réussie est stockée localement avec son heure de requête,
nom du fournisseur et texte. L'historique est stocké dans les données SQLite locales de l'application ; il ne stocke pas l'enregistrement
audio. Étant donné que les entrées peuvent contenir du texte dicté sensible, traitez l’historique comme vous le feriez pour n’importe quel autre document local.

Les entrées les plus récentes apparaissent en premier. L'historique se charge progressivement au fur et à mesure que vous faites défiler l'écran. Il n'est donc pas nécessaire de charger un historique long.
une demande. La fenêtre affiche des messages d'erreur de chargement, de nouvelle tentative et de sécurité si elle ne parvient pas à récupérer la page suivante.

Pour réutiliser une entrée, sélectionnez sa fiche texte. GPT-Voice copie le texte stocké de cette entrée dans le presse-papiers du système et brièvement
affiche **Copied**. Il ne soumet pas à nouveau le texte pour transcription. Si la copie échoue ou si une entrée a déjà été
supprimée, la fenêtre d'historique signale l'échec au lieu de modifier le presse-papiers.

## Effacer l'historique local

Utilisez **Clear history** dans la fenêtre Historique et confirmez la boîte de dialogue pour supprimer chaque entrée de transcription enregistrée. Ceci
l'action efface l'histoire locale ; il ne peut pas être annulé à partir de GPT-Voice. De nouvelles transcriptions réussies créent de nouvelles entrées
par la suite.

Si vous souhaitez supprimer toutes les données d'application conservées dans le cadre de la désinstallation de GPT-Voice, suivez les instructions spécifiques à la plate-forme.
instructions dans [installer, mettre à jour ou supprimer](../install.md).

## Utilisez le plateau

La fermeture de la fenêtre principale GPT-Voice la masque au lieu de quitter l'application. L'application continue de s'exécuter dans le
barre d'état système, de sorte que ses raccourcis globaux configurés restent disponibles. Sélectionnez l'icône de la barre d'état pour focaliser la fenêtre principale visible
ou montrez-le s'il est caché.

Le menu de la barre d'état propose ces actions :

| Actions du menu    | Résultat                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Show GPT-Voice** | Affiche et concentre la fenêtre principale, ou la crée si nécessaire.                                                   |
| **Settings**       | Ouvre la fenêtre Paramètres.                                                                                            |
| **History**        | Ouvre l’historique de transcription local.                                                                              |
| **About**          | Ouvre la fenêtre À propos.                                                                                              |
| **Quit**           | Quitte GPT-Voice. Utilisez-le lorsque vous souhaitez arrêter l'application plutôt que de simplement masquer sa fenêtre. |

L'icône de la barre d'état reflète l'activité en cours : inactif, enregistrement, pause, traitement de transcription ou Prettify. C'est unindicateur et point de navigation ; les commandes d'enregistrement restent disponibles via le Command Dock et leur configuration
raccourcis.
