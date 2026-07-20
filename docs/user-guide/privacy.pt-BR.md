# Privacidade e dados

GPT-Voice lida com fala, texto selecionado, credenciais e configurações do navegador. Esta página explica os caminhos de dados atuais
e os controles disponíveis para remover dados. Ele não substitui a política de privacidade ou os termos de qualquer serviço que você escolher
usar.

## Fluxos de dados

GPT-Voice envia dados para fora do seu computador somente quando você usa um recurso apoiado por um serviço externo:

| Recurso                         | Dados enviados                                               | Destino                                           |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Transcrição com **ChatGPT Web** | A gravação preparada                                         | ChatGPT por meio da sessão do navegador conectado |
| Transcrição com **OpenAI API**  | A gravação preparada e as opções de transcrição configuradas | Endpoint de transcrições de áudio de OpenAI       |
| **Translate**                   | O texto selecionado                                          | Google Translate                                  |
| **Prettify**                    | O texto selecionado e o prompt do Prettify configurado       | Seu endpoint Ollama ou vLLM configurado           |

Use contas e endpoints em que você confia e revise seus termos de tratamento de dados. Um ponto de extremidade de loopback local Ollama ou vLLM
mantém a solicitação na máquina que executa esse serviço; um endpoint remoto recebe o texto. Use HTTPS para um
Endpoint Prettify sem loopback. Os serviços baseados em navegador podem usar o proxy configurado em [Configurações de rede](settings/network.md).

GPT-Voice grava resultados bem-sucedidos de transcrição, tradução e Prettify na área de transferência do sistema. A operação
o sistema e outros aplicativos com acesso à área de transferência podem reter ou ler esse valor; limpe ou substitua-o após colar
saída sensível.

## Dados locais e memória temporária

| Dados                                   | Onde e por quanto tempo é guardado                                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Histórico de transcrição bem-sucedida   | Dados SQLite locais em `gpt-voice.sqlite3`, com horário da solicitação, ID e nome do provedor e texto de transcrição. Ele não armazena o áudio gravado.                             |
| Gravação repetível                      | O áudio preparado mais recentemente é mantido apenas na memória do aplicativo em execução após uma falha na transcrição. Iniciar uma nova gravação ou reiniciar GPT-Voice a remove. |     | Embelezar o cache de resultados | Até 20 resultados são mantidos na memória por até 60 segundos. O contexto do cache depende do texto selecionado, do prompt e das configurações definidas do provedor; ele é removido quando GPT-Voice sai. |
| Configurações e identidade do navegador | Armazenado nos dados locais do aplicativo GPT-Voice e usado para lançamentos posteriores.                                                                                           |
| Autenticação ChatGPT Web                | Sessão local do navegador e dados de autenticação. Use o controle do provedor para limpá-lo.                                                                                        |

As ações de texto selecionado leem e substituem temporariamente o conteúdo da área de transferência enquanto coletam uma seleção. Se Tradução ou
O Prettify falha ou é cancelado, GPT-Voice restaura o valor da área de transferência capturado antes da ação. No sucesso, o
O resultado permanece na área de transferência para você colar.

## Credenciais e qualificações de criptografia

Chaves OpenAI API, chaves de API vLLM e senhas de proxy HTTP/HTTPS são armazenadas por meio de Electron safe storage quando isso
proteção está disponível. GPT-Voice não retorna esses valores salvos para suas visualizações de configurações. Se o armazenamento seguro for
indisponível, GPT-Voice não pode salvar um novo segredo por meio desse controle.

Esta não é uma reivindicação de criptografia geral para todos os arquivos no diretório de dados do aplicativo. Em particular, a transcrição
histórico, configurações comuns e dados de sessão ChatGPT Web têm seu próprio comportamento de armazenamento local. Não compartilhe chaves de API,
senhas de proxy, informações de sessão, texto ditado ou capturas de tela que os contenham.

## Remover ou redefinir dados

Escolha o controle mais restrito que atenda às suas necessidades:

1. Na janela Histórico, use **Clear history** para remover permanentemente todas as entradas de transcrição salvas. Veja
   [histórico e bandeja](guides/history-and-tray.md).
2. Nos controles do provedor de transcrição, use **Clear session** para ChatGPT Web ou **Clear API key** para OpenAI API.
   Consulte [configurações do provedor](settings/providers.md).
3. Use o controle **Clear API key** em [Prettify settings](settings/prettify.md) e o controle de senha **Clear**
   em [Configurações de rede](settings/network.md), quando aplicável.
4. Substitua ou limpe a área de transferência do sistema separadamente se ela contiver resultados que você não deseja mais disponibilizar para colar.
5. Para uma redefinição local completa, saia do GPT-Voice da bandeja e remova o diretório de dados do aplicativo retido:
   `%APPDATA%\GPT-Voice` no Windows ou `~/.config/GPT-Voice` no Linux. Isso remove os gerenciados por aplicativos locais
   configurações, histórico e dados salvos do provedor e requer configuração novamente após reinstalar ou reiniciar.

A remoção de dados locais é irreversível. A desinstalação do aplicativo por si só retém intencionalmente esses diretórios; veja
[instalar, atualizar ou remover](install.md) para o comportamento de desinstalação específico da plataforma.

## Guias relacionados

- [Gravar e transcrever](guides/transcription.md) explica áudio repetível temporário e envio do provedor.- [Traduzir e embelezar o texto selecionado](guides/text-actions.md) explica a restauração da área de transferência e ações remotas de texto.
- [Escolha e gerencie um provedor de transcrição](guides/providers.md) explica as contas e sessões do provedor.
