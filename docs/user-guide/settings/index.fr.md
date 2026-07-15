# Aperçu des paramètres

Ouvrez **Settings** à partir du menu de la barre d'état GPT-Voice. La fenêtre Paramètres s'ouvre sur **Shortcuts** et comporte quatre sections :

| Rubrique                    | Utilisez-le pour                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Shortcuts**               | Choisissez les raccourcis globaux pour l'enregistrement, l'arrêt, l'annulation, la traduction, Prettify et réessayer une transcription. |
| **[Prettify](prettify.md)** | Choisissez le fournisseur de traitement de texte Ollama ou vLLM et configurez son modèle et son comportement de génération.             |
| **[Browser](browser.md)**   | Configurez l'identité du navigateur et le comportement en arrière-plan que GPT-Voice utilise pour ses services basés sur le navigateur. |
| **[Network](network.md)**   | Configurez le proxy utilisé par ces services basés sur un navigateur.                                                                   |

Les boutons de section restent disponibles sur les fenêtres étroites sous forme d'icônes avec des étiquettes accessibles. Sélectionnez une section pour modifier ses paramètres ; chaque page décrit ses propres champs et prérequis.

## Enregistrer les modifications

Les paramètres sont chargés à partir de la configuration de l'application enregistrée lorsque la fenêtre s'ouvre. La modification d'une valeur marque le formulaire comme ayant **Unsaved changes**. Le bouton **Save changes** n'est disponible qu'après qu'au moins une modification a été effectuée et que toutes les valeurs de champ actuelles sont valides. Il reste désactivé pendant la sauvegarde de GPT-Voice.

Lorsqu'une valeur ne répond pas à ses exigences, le champ concerné affiche un message de validation et l'enregistrement est bloqué jusqu'à ce que vous la corrigiez. Si une opération de sauvegarde échoue, les paramètres restent ouverts et affichent un message d'erreur afin que vous puissiez corriger le problème ou réessayer. Une sauvegarde réussie met à jour la configuration enregistrée et ferme la fenêtre Paramètres.

## Fermez sans perdre votre travail par accident

La fermeture des paramètres sans aucune modification non enregistrée le ferme immédiatement. S'il y a des modifications non enregistrées, GPT-Voice vous demande si vous souhaitez les ignorer. Choisissez **Keep editing** pour revenir au formulaire ou **Discard changes** pour fermer les paramètres sans enregistrer les modifications en attente. Pendant qu'une sauvegarde est en cours, la fermeture des paramètres est bloquée jusqu'à la fin de l'opération.

Cette confirmation s'applique au formulaire de paramètres. La capture d'un nouveau raccourci global est une action distincte : GPT-Voice suspend temporairement les raccourcis globaux pendant qu'il écoute la combinaison de touches, puis les reprend lorsque cette capture est terminée ou annulée.
