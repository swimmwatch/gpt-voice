# Paramètres de raccourci

GPT-Voice utilise des raccourcis globaux afin qu'ils puissent fonctionner lorsque vous êtes dans une autre application. Ouvrez **Settings** et choisissez **Shortcuts** pour les afficher ou les modifier.

| Actions                               | Raccourci par défaut | Quand ça marche                                                                                                                                 |
| ------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Start, pause, or resume recording** | `F9`                 | Commence l'enregistrement en cas d'inactivité, met en pause un enregistrement actif ou reprend un enregistrement en pause.                      |
| **Stop recording**                    | `F10`                | Arrête un enregistrement ou un enregistrement en pause et commence la transcription.                                                            |
| **Cancel**                            | `Escape`             | Annule un enregistrement actif. Lorsqu'aucun enregistrement n'est actif, il annule une requête Prettify en cours d'exécution.                   |
| **Translate selected text**           | `F11`                | Traduit le texte sélectionné lorsque la traduction est activée et qu'aucun enregistrement ou autre action sur le texte sélectionné n'est actif. |
| **Prettify selected text**            | `F12`                | Embellit le texte sélectionné lorsque Prettify est activé et qu'aucun enregistrement ou autre action sur le texte sélectionné n'est actif.      |
| **Retry transcription**               | `Ctrl+F8`            | Réessaye la dernière transcription réessayable uniquement lorsque GPT-Voice est inactif.                                                        |

Le raccourci de nouvelle tentative n’est pas disponible tant qu’il n’y a pas de transcription réessayable. Voir [enregistrer et transcrire](../guides/transcription.md) pour savoir quand une nouvelle tentative devient disponible et [traduire et embellir le texte sélectionné](../guides/text-actions.md) pour les flux de travail de texte sélectionné.

## Changer un raccourci

1. Sélectionnez **Change** sur la ligne de l'action.
2. Dans la boîte de dialogue de capture, appuyez sur la combinaison de touches complète que vous souhaitez utiliser.
3. Vérifiez la combinaison affichée dans la boîte de dialogue, puis choisissez **Apply**. Choisissez **Cancel** pour laisser le raccourci actuel inchangé.

GPT-Voice suspend temporairement tous ses raccourcis globaux pendant que la boîte de dialogue de capture est ouverte, puis les enregistre à nouveau lorsque vous appliquez ou annulez. Appuyez sur une touche non modificatrice dans le cadre de la combinaison ; appuyer uniquement sur `Ctrl`, `Alt`, `Shift` ou sur la touche de commande de la plate-forme ne crée pas de raccourci.

## Évitez les conflits

Utilisez un raccourci différent pour chaque action GPT-Voice et choisissez des combinaisons qui n'entrent pas en conflit avec votre système d'exploitation ou un autre logiciel. GPT-Voice rejette les affectations GPT-Voice conflictuelles. Une touche non modifiée entre en conflit avec la même touche de base même si l'autre affectation inclut des modificateurs. N'associez donc pas, par exemple, F9 avec Ctrl+F9.

Si une nouvelle affectation ne peut pas être enregistrée, GPT-Voice conserve le raccourci actuel et affiche la raison. Sur macOS, une touche de commande capturée est représentée par `Command` ; sur d'autres plates-formes prises en charge, l'équivalent de la plate-forme est utilisé.## Activer ou désactiver les actions sur le texte sélectionné

Les lignes **Translate** et **Prettify** ont chacune un commutateur d'activation. Les deux sont activés par défaut. Désactivez un interrupteur pour empêcher cette action de s'exécuter même si son raccourci est enfoncé ; activez-le pour rendre le raccourci configuré à nouveau disponible lorsque les conditions normales de l'action sont remplies.

Ces commutateurs font partie du formulaire Paramètres, choisissez donc **Save changes** après les avoir modifiés. La modification d'un raccourci via la boîte de dialogue de capture applique ce raccourci indépendamment ; utilisez l'indicateur de modifications non enregistrées dans l'aperçu des paramètres pour distinguer les modifications de formulaire en attente d'un raccourci déjà appliqué.
