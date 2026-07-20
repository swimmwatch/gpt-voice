# Perguntas frequentes

## O GPT-Voice transcreve a fala sozinho?

Não. GPT-Voice é um aplicativo de desktop que envia uma gravação para o provedor de transcrição selecionado: ChatGPT Web
por meio da sessão do navegador conectado ou OpenAI API por meio de sua própria chave de API. Disponibilidade do provedor, faturamento,
cotas e os termos são controlados por esse provedor. Consulte [escolher e gerenciar um provedor de transcrição](guides/providers.md).

## O que sai do meu computador?

Interromper uma gravação envia o áudio preparado para o provedor de transcrição selecionado. A tradução envia o texto selecionado para
Google Translate. Prettify envia o texto selecionado e seu prompt configurado para seu endpoint Ollama ou vLLM. Veja
[privacidade e dados](privacy.md) para obter detalhes completos sobre fluxo de dados e retenção local.

## O GPT-Voice digita o resultado em meu aplicativo?

Não. Os resultados bem-sucedidos de transcrição, tradução e Prettify são copiados para a área de transferência do sistema. Cole o resultado
onde você precisar. Consulte [gravar e transcrever](guides/transcription.md) e
[Traduzir e embelezar o texto selecionado](guides/text-actions.md).

## Posso usar GPT-Voice sem uma chave OpenAI API?

Sim. ChatGPT Web usa uma sessão de navegador ChatGPT conectada em vez de uma chave de API. É separado do OpenAI API
provedor e seus requisitos de conta. Consulte [configurações do provedor](settings/providers.md).

## O GPT-Voice pode funcionar totalmente offline?

Não para transcrição ou tradução: esses recursos usam o serviço remoto selecionado. Prettify pode usar um local
Endpoint Ollama ou vLLM quando você executa esse serviço no mesmo computador, mas GPT-Voice não instala ou opera o
ponto final para você. Consulte [Configurações de embelezamento](settings/prettify.md).

## Quais plataformas são suportadas?

As versões atuais suportam Windows e Linux por meio dos pacotes de instalação do Windows, deb, rpm e AppImage. macOS
as liberações são pausadas enquanto a assinatura e o reconhecimento de firma são preparados. Consulte [instalar, atualizar ou remover](install.md).

## Uma atualização ou desinstalação apaga minhas configurações?

Não. Os caminhos normais de desinstalação retêm intencionalmente os dados locais do aplicativo, incluindo configurações e dados salvos do provedor.
Use as instruções de remoção em [privacidade e dados](privacy.md) quando quiser redefinir esses dados deliberadamente.

## Por que meu atalho ou ação de texto selecionado não foi executado?

Confirme se a ação está habilitada, seu atalho está salvo e outro aplicativo não reservou a mesma chave
combinação. A tradução e o Prettify são executados um de cada vez e aguardam até que qualquer gravação termine. Veja
[configurações de atalho](settings/shortcuts.md) e [solução de problemas](troubleshooting.md).

## Posso usar um proxy?

Sim. GPT-Voice pode passar um proxy HTTP, HTTPS ou SOCKS5 para seus contextos de navegador. Credenciais SOCKS5 não são suportadas,
e o proxy GeoIP pode assumir o controle da localidade e do fuso horário do navegador. Consulte [Configurações de rede](settings/network.md).

## Como faço para limpar uma transcrição, sessão ou chave?Use **Clear history** na janela Histórico para transcrições salvas. Use o controle claro do fornecedor relevante para um

Sessão ChatGPT, chave OpenAI API, chave vLLM ou senha de proxy. Consulte [privacidade e dados](privacy.md) para obter o escopo preciso
de cada reinicialização.
