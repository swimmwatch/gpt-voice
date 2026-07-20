# Questions fréquemment posées

## Est-ce que GPT-Voice transcrit la parole tout seul ?

Non. GPT-Voice est une application de bureau qui envoie un enregistrement au fournisseur de transcription que vous sélectionnez : ChatGPT Web
via votre session de navigateur connectée ou OpenAI API via votre propre clé API. Disponibilité du fournisseur, facturation,
les quotas et les conditions sont contrôlés par ce fournisseur. Voir [choisir et gérer un fournisseur de transcription](guides/providers.md).

## Qu'est-ce qui quitte mon ordinateur ?

L'arrêt d'un enregistrement envoie l'audio préparé au fournisseur de transcription sélectionné. La traduction envoie le texte sélectionné à
Google Translate. Prettify envoie le texte sélectionné et son invite configurée à votre point de terminaison Ollama ou vLLM. Voir
[confidentialité et données](privacy.md) pour les détails complets du flux de données et de la conservation locale.

## Est-ce que GPT-Voice saisit le résultat dans mon application ?

Non. Les résultats de transcription, de traduction et de mise en beauté réussis sont copiés dans le presse-papiers du système. Collez le résultat
là où vous en avez besoin. Voir [enregistrer et transcrire](guides/transcription.md) et
[Traduire et embellir le texte sélectionné](guides/text-actions.md).

## Puis-je utiliser GPT-Voice sans clé OpenAI API ?

Oui. ChatGPT Web utilise une session de navigateur ChatGPT connectée au lieu d'une clé API. Il est distinct du OpenAI API
fournisseur et ses exigences en matière de compte. Voir [Paramètres du fournisseur](settings/providers.md).

## Est-ce que GPT-Voice peut fonctionner entièrement hors ligne ?

Pas pour la transcription ou la traduction : ces fonctionnalités utilisent le service distant sélectionné. Prettify peut utiliser un local
Ollama ou vLLM point de terminaison lorsque vous exécutez ce service sur le même ordinateur, mais GPT-Voice n'installe ni n'utilise le
point final pour vous. Voir [Paramètres d'embellissement](settings/prettify.md).

## Quelles plateformes sont prises en charge ?

Les versions actuelles prennent en charge Windows et Linux via le programme d'installation Windows, les packages deb, rpm et AppImage. macOS
les versions sont suspendues pendant la préparation de la signature et de la légalisation. Voir [installer, mettre à jour ou supprimer](install.md).

## Une mise à jour ou une désinstallation efface-t-elle mes paramètres ?

Non. Les chemins de désinstallation normaux conservent intentionnellement les données des applications locales, y compris les paramètres et les données enregistrées du fournisseur.
Utilisez les instructions de suppression dans [confidentialité et données](privacy.md) lorsque vous souhaitez réinitialiser délibérément ces données.

## Pourquoi mon raccourci ou mon action sur le texte sélectionné n'a-t-il pas été exécuté ?

Confirmez que l'action est activée, que son raccourci est enregistré et qu'une autre application n'a pas réservé la même clé
combinaison. Translation et Prettify s'exécutent un par un et attendent la fin de tout enregistrement. Voir
[paramètres de raccourci](settings/shortcuts.md) et [dépannage](troubleshooting.md).

## Puis-je utiliser un proxy ?

Oui. GPT-Voice peut transmettre un proxy HTTP, HTTPS ou SOCKS5 à ses contextes de navigateur. Les informations d'identification SOCKS5 ne sont pas prises en charge,
et le proxy GeoIP peut prendre le contrôle des paramètres régionaux et du fuseau horaire du navigateur. Voir [Paramètres réseau](settings/network.md).

## Comment puis-je effacer une transcription, une session ou une clé ?Utilisez **Clear history** dans la fenêtre Historique pour les transcriptions enregistrées. Utilisez le contrôle clair du fournisseur concerné pour un

Session ChatGPT, clé OpenAI API, clé vLLM ou mot de passe proxy. Voir [confidentialité et données](privacy.md) pour la portée précise
de chaque réinitialisation.
