<div class="guide-wordmark" align="center" markdown>

<img class="guide-logo" src="/gpt-voice/docs/assets/generated/icons/gpt-voice.png" width="112" height="112" alt="GPT-Voice logo" />

![GPT-Voice marca denominativa](/gpt-voice/docs/assets/generated/icons/gpt-voice-wordmark.svg){ ancho="620" }

</div>

# GPT-Voice Documentación

GPT-Voice es una aplicación de escritorio de voz a texto. Graba un pensamiento con un atajo global, envía el audio a través de un
proveedor que controlas y recibe la transcripción en tu portapapeles.

<div class="guide-links" markdown>

[GPT-Voice inicio](/gpt-voice/) <span aria-hidden="true">·</span>
[Repositorio](https://github.com/swimmwatch/gpt-voice) <span aria-hidden="true">·</span>
[Última versión](https://github.com/swimmwatch/gpt-voice/releases)

</div>

<div class="guide-actions" markdown>

[:material-download: Descargar GPT-Voice](https://github.com/swimmwatch/gpt-voice/releases){ .md-button .md-button--primary }
[:material-rocket-launch: Empezar](getting-started.md){ .md-button }

</div>

<figure class="product-screenshot">
  <a href="/gpt-voice/docs/assets/generated/images/app-main.png">
    <picture>
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.avif" type="image/avif" />
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.webp" type="image/webp" />
      <img src="/gpt-voice/docs/assets/generated/images/app-main.png" width="920" height="840" loading="eager" decoding="async" alt="GPT-Voice Command Dock showing ChatGPT Web connected, a loaded Prettify model, the Start recording action with F9, and English as the target language." />
    </picture>
  </a>
  <figcaption>Un Command Dock listo para grabar en GPT-Voice.</figcaption>
</figure>

<aside class="release-note">
  Esta guía documenta la última versión publicada GPT-Voice. La disponibilidad, los límites, la facturación y los términos del proveedor permanecen
  controlado por la cuenta del proveedor que utiliza.
</aside>

## ¿Qué hace GPT-Voice

<div class="grid cards" markdown>

- :material-microphone: **Transcribe speech**

  Utilice una sesión iniciada **ChatGPT Web** o la **OpenAI API** oficial para transcribir una grabación.

- :material-content-paste: **Keep the workflow on your desktop**

  Grabe, detenga y pegue el texto copiado donde lo necesite. Los resultados exitosos se copian al portapapeles;
  GPT-Voice no los inserta automáticamente en otra aplicación.

- :material-translate: **Translate selected text**

  Ejecute una acción de traducción de texto seleccionado con un acceso directo global y luego pegue el resultado desde el portapapeles.

- :material-auto-fix: **Use Prettify**

  Limpia el texto seleccionado conservando su significado a través de un servicio Ollama o vLLM que configures y ejecutes.

- :material-history: **Return to useful results**

  Utilice atajos globales y el historial de transcripción local para volver a un resultado copiado sin volver a enviar el audio.

</div>

## Antes de comenzar

GPT-Voice tiene paquetes de lanzamiento compatibles para Windows y Linux. Las versiones actuales de macOS se pausan mientras se firma y
Se preparan notarizaciones. Descargue el paquete para su plataforma desde
[Página de lanzamientos de GitHub](https://github.com/swimmwatch/gpt-voice/releases).

Para la transcripción, elija un proveedor:

- **ChatGPT Web** requiere una sesión de navegador iniciada.
- **OpenAI API** requiere su propia clave API y facturación o cuota de API disponible.

La disponibilidad, los límites, la facturación y los términos del proveedor están controlados por la cuenta de proveedor que utiliza. GPT-Voice no
superar esos límites.

## Alcance de la guía

Comience con [instalación](install.md), luego siga [primer uso](getting-started.md) para conectar un proveedor y confirmar
que una transcripción llegue a tu portapapeles. Continúe con [grabación y transcripción](guides/transcription.md),
[configuración del proveedor](guides/providers.md), [Configuración](settings/index.md), [privacidad y datos](privacy.md),
[solución de problemas](troubleshooting.md) y [preguntas frecuentes](faq.md).GPT-Voice es un proyecto independiente y no está afiliado a OpenAI, Anthropic ni Google. Tiene licencia bajo
[PolyForm No Comercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), que no es un
Licencia de código abierto aprobada por OSI.
