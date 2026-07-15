# Grave e transcreva

Antes de gravar, conecte um provedor que mostre **Connected** e permita que GPT-Voice use seu microfone. Veja
[primeiro uso](../getting-started.md) se você não tiver concluído essa configuração ou revise o [guia do provedor](providers.md)
para conexão e detalhes da conta.

## Ciclo de vida da gravação

Inicie uma gravação a partir do Command Dock ou com o atalho de gravação configurado (o padrão é `F9`). O estado
muda de **Ready** para **Recording** assim que a captura do microfone for iniciada. Durante a gravação, a ação principal é
**Stop recording** (padrão `F10`).

| Ação                | Quando estiver disponível                      | O que acontece                                                                                                               |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Start recording** | GPT-Voice está ocioso.                         | Solicita acesso ao microfone e inicia uma nova captura. Iniciar uma nova captura limpa qualquer áudio repetível da anterior. |
| **Pause**           | Uma captura está sendo gravada.                | Pausa a captura atual sem enviá-la.                                                                                          |
| **Resume**          | Uma captura está pausada.                      | Continua a mesma captura.                                                                                                    |
| **Stop recording**  | Uma captura está sendo gravada ou pausada.     | Finaliza a captura, prepara o áudio e envia para o provedor selecionado.                                                     |
| **Cancel**          | GPT-Voice está iniciando, gravando ou pausado. | Interrompe e descarta a captura ativa; não é enviado para transcrição.                                                       |

Enquanto GPT-Voice está parando, preparando o áudio, transcrevendo ou tentando novamente, aguarde a conclusão da operação atual
antes de iniciar outra gravação. O Command Dock mostra um estado de processamento durante esse tempo.

## O que acontece depois que você para

Após **Stop recording**, GPT-Voice preparar o áudio capturado e mostrar **Transcribing**. Ele envia o preparado
áudio para o provedor selecionado em Command Dock:

- **ChatGPT Web** envia o áudio por meio da sessão do navegador ChatGPT conectado.
- **OpenAI API** envia o áudio para o endpoint de transcrição de OpenAI usando a chave API que você configurou.

A disponibilidade do provedor, o acesso à conta, o faturamento, as cotas e os termos de serviço são controlados pela conta desse provedor.
GPT-Voice não ignora esses controles.

Em caso de sucesso, GPT-Voice copia o texto retornado para a área de transferência do sistema, altera o status para **Copiado para
área de transferência** e solicita uma notificação de sucesso. Cole o texto no aplicativo que você estava usando. GPT-Voice tambémsalva o texto, o nome do provedor e o horário da solicitação em seu histórico de transcrição local; os controles de histórico são
documentado separadamente.

## Tente novamente uma transcrição com falha

Depois que GPT-Voice preparou uma captura não vazia, ele mantém o áudio preparado na memória como o áudio retentável mais recente
gravação. Se a solicitação de transcrição falhar, use a ação de nova tentativa de transcrição configurada quando GPT-Voice estiver ocioso para
envie o mesmo áudio preparado novamente. Tentar novamente não grava o microfone novamente.

Esta nova tentativa de cópia é deliberadamente temporária:

- É apagado antes de iniciar uma nova gravação.
- Não está disponível durante a gravação, processamento ou nova tentativa.
- É mantido apenas na memória da aplicação em execução; reiniciar GPT-Voice remove-o.

Tentar novamente é uma maneira de repetir um envio com falha após corrigir um problema de conexão, sessão ou provedor. Não
alterar os limites do provedor, restaurar uma sessão de conta expirada ou garantir que um provedor aceitará a solicitação.

## Se a gravação ou transcrição falhar

- **Could not access microphone** significa que GPT-Voice não conseguiu obter um fluxo de áudio. Verifique o sistema operacional
  permissão de privacidade do microfone, confirme se um microfone está conectado e inicie uma nova gravação.
- **Transcription failed** significa que o provedor retornou um resultado malsucedido. Verifique a conta do provedor, rede,
  disponibilidade do serviço e limites aplicáveis antes de tentar novamente.
- **Transcription error** significa que GPT-Voice não conseguiu concluir a preparação ou a solicitação. A notificação de falha e
  O status Command Dock fornece a mensagem de erro segura voltada para o usuário; o texto com falha não é copiado para a área de transferência.
- Se uma sessão ChatGPT Web expirou, reconecte-a antes de tentar novamente. Se uma chave OpenAI API estiver faltando ou for rejeitada,
  corrija-o nas configurações do provedor antes de tentar novamente.

Cancelar uma gravação ativa é diferente de um envio com falha: cancelar descarta a captura antes que ela seja
preparado ou enviado, portanto não há transcrição repetível para essa gravação.
