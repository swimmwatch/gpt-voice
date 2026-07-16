<div class="guide-wordmark" align="center" markdown>

![GPT-Voice marca nominativa](/gpt-voice/docs/assets/generated/icons/gpt-voice-wordmark.svg){ largura="620" }

</div>

# GPT-Voice Documentação

GPT-Voice é um aplicativo de voz para texto para desktop. Grave um pensamento com um atalho global, envie o áudio através de um
provedor que você controla e receba a transcrição em sua área de transferência.

<div class="guide-links" markdown>

[GPT-Voice página inicial](/gpt-voice/) <span aria-hidden="true">·</span>
[Repositório](https://github.com/swimmwatch/gpt-voice) <span aria-hidden="true">·</span>
[Última versão](https://github.com/swimmwatch/gpt-voice/releases)

</div>

<div class="guide-actions" markdown>

[:material-download: Baixar GPT-Voice](https://github.com/swimmwatch/gpt-voice/releases){ .md-button .md-button--primary }
[:material-rocket-launch: Primeiros passos](getting-started.md){ .md-button }

</div>

<figure class="product-screenshot">
  <a href="/gpt-voice/docs/assets/generated/images/app-main.png">
    <picture>
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.avif" type="image/avif" />
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.webp" type="image/webp" />
      <img src="/gpt-voice/docs/assets/generated/images/app-main.png" width="920" height="840" loading="eager" decoding="async" alt="GPT-Voice Command Dock showing ChatGPT Web connected, a loaded Prettify model, the Start recording action with F9, and English as the target language." />
    </picture>
  </a>
  <figcaption>Um Command Dock pronto para gravar em GPT-Voice.</figcaption>
</figure>

<aside class="release-note">
  Este guia documenta a versão mais recente lançada GPT-Voice. A disponibilidade, limites, cobrança e termos do provedor permanecem
  controlado pela conta do provedor que você usa.
</aside>

## O que GPT-Voice faz

<div class="grid cards" markdown>

- :material-microphone: **Transcribe speech**

  Use uma sessão **ChatGPT Web** conectada ou a sessão oficial **OpenAI API** para transcrever uma gravação.

- :material-content-paste: **Keep the workflow on your desktop**

  Grave, pare e cole o texto copiado onde for necessário. Os resultados bem-sucedidos são copiados para a área de transferência;
  GPT-Voice não os insere automaticamente em outro aplicativo.

- :material-translate: **Translate selected text**

  Execute uma ação de tradução do texto selecionado com um atalho global e cole o resultado da área de transferência.

- :material-auto-fix: **Use Prettify**

  Limpe o texto selecionado preservando seu significado por meio de um serviço Ollama ou vLLM que você configura e executa.

- :material-history: **Return to useful results**

  Use atalhos globais e histórico de transcrição local para retornar a um resultado copiado sem enviar o áudio novamente.

</div>

## Antes de começar

GPT-Voice oferece suporte a pacotes de lançamento para Windows e Linux. As versões atuais do macOS são pausadas durante a assinatura e
a notarização é preparada. Baixe o pacote para sua plataforma no
[Página de lançamentos do GitHub](https://github.com/swimmwatch/gpt-voice/releases).

Para transcrição, escolha um provedor:

- **ChatGPT Web** requer uma sessão de navegador conectada.
- **OpenAI API** requer sua própria chave de API e cobrança ou cota de API disponível.

A disponibilidade, os limites, a cobrança e os termos do provedor são controlados pela conta do provedor que você usa. GPT-Voice não
contornar esses limites.

## Escopo do guia

Comece com [instalação](install.md), depois siga [primeiro uso](getting-started.md) para conectar um provedor e confirmar
que uma transcrição chegue à sua área de transferência. Continue com [gravação e transcrição](guides/transcription.md),
[configuração do provedor](guides/providers.md), [Configurações](settings/index.md), [privacidade e dados](privacy.md),
[solução de problemas](troubleshooting.md) e [perguntas frequentes](faq.md).GPT-Voice é um projeto independente e não é afiliado a OpenAI, Anthropic ou Google. Está licenciado sob
[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), que não é um
Licença de código aberto aprovada pela OSI.
