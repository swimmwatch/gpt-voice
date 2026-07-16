<div class="guide-wordmark" align="center" markdown>

<img class="guide-logo" src="/gpt-voice/docs/assets/generated/icons/gpt-voice.png" width="112" height="112" alt="GPT-Voice logo" />

![GPT-Voice mot-symbole](/gpt-voice/docs/assets/generated/icons/gpt-voice-wordmark.svg){ width="620" }

</div>

# GPT-Voice Documentation

GPT-Voice est une application de synthèse vocale de bureau. Enregistrez une pensée avec un raccourci global, envoyez l'audio via un
fournisseur que vous contrôlez et recevez la transcription dans votre presse-papiers.

<div class="guide-links" markdown>

[GPT-Voice accueil](/gpt-voice/) <span aria-hidden="true">·</span>
[Dépôt](https://github.com/swimmwatch/gpt-voice) <span aria-hidden="true">·</span>
[Dernière version](https://github.com/swimmwatch/gpt-voice/releases)

</div>

<div class="guide-actions" markdown>

[:material-download: Télécharger GPT-Voice](https://github.com/swimmwatch/gpt-voice/releases){ .md-button .md-button--primary }
[:material-rocket-launch: Commencer](getting-started.md){ .md-button }

</div>

<figure class="product-screenshot">
  <a href="/gpt-voice/docs/assets/generated/images/app-main.png">
    <picture>
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.avif" type="image/avif" />
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.webp" type="image/webp" />
      <img src="/gpt-voice/docs/assets/generated/images/app-main.png" width="920" height="840" loading="eager" decoding="async" alt="GPT-Voice Command Dock showing ChatGPT Web connected, a loaded Prettify model, the Start recording action with F9, and English as the target language." />
    </picture>
  </a>
  <figcaption>Un Command Dock prêt à enregistrer dans GPT-Voice.</figcaption>
</figure>

<aside class="release-note">
  Ce guide documente la dernière version GPT-Voice publiée. La disponibilité, les limites, la facturation et les conditions du fournisseur demeurent
  contrôlé par le compte fournisseur que vous utilisez.
</aside>

## Que fait GPT-Voice

<div class="grid cards" markdown>

- :material-microphone: **Transcribe speech**

  Utilisez une session **ChatGPT Web** connectée ou la session officielle **OpenAI API** pour transcrire un enregistrement.

- :material-content-paste: **Keep the workflow on your desktop**

  Enregistrez, arrêtez et collez le texte copié là où vous en avez besoin. Les résultats réussis sont copiés dans le presse-papiers ;
  GPT-Voice ne les insère pas automatiquement dans une autre application.

- :material-translate: **Translate selected text**

  Exécutez une action de traduction du texte sélectionné avec un raccourci global, puis collez le résultat depuis le presse-papiers.

- :material-auto-fix: **Use Prettify**

  Nettoyez le texte sélectionné tout en préservant sa signification grâce à un service Ollama ou vLLM que vous configurez et exécutez.

- :material-history: **Return to useful results**

  Utilisez les raccourcis globaux et l'historique de transcription local pour revenir à un résultat copié sans renvoyer l'audio.

</div>

## Avant de commencer

GPT-Voice prend en charge les packages de version pour Windows et Linux. Les versions actuelles de macOS sont suspendues lors de la signature et
l'authentification est préparée. Téléchargez le package pour votre plateforme à partir du
[Page des versions de GitHub](https://github.com/swimmwatch/gpt-voice/releases).

Pour la transcription, choisissez un fournisseur :

- **ChatGPT Web** nécessite une session de navigateur connectée.
- **OpenAI API** nécessite votre propre clé API et la facturation ou le quota API disponible.

La disponibilité, les limites, la facturation et les conditions du fournisseur sont contrôlées par le compte fournisseur que vous utilisez. GPT-Voice ne
contourner ces limites.

## Portée du guide

Commencez par [installation](install.md), puis suivez [first use](getting-started.md) pour connecter un fournisseur et confirmez
qu'une transcription arrive dans votre presse-papiers. Continuez avec [l'enregistrement et la transcription](guides/transcription.md),
[configuration du fournisseur](guides/providers.md), [Paramètres](settings/index.md), [confidentialité et données](privacy.md),
[dépannage](troubleshooting.md) et [questions fréquemment posées](faq.md).GPT-Voice est un projet indépendant et n'est pas affilié à OpenAI, Anthropic ou Google. Il est sous licence
[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), qui n'est pas un
Licence open source approuvée par OSI.
