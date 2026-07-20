# Configurações do provedor

Escolha o provedor de transcrição em GPT-Voice Command Dock. Para configurar o provedor atualmente selecionado, abra seu controle **Connect** ou **Configure** no cabeçalho. A caixa de diálogo do provedor mostra apenas os controles que se aplicam a esse provedor.

## ChatGPT Web

ChatGPT Web usa uma sessão do navegador em vez de uma chave de API. A caixa de diálogo do provedor exibe se uma sessão foi salva.

1. Selecione **ChatGPT Web** em Command Dock.
2. Abra a caixa de diálogo do provedor e escolha **Log in** quando nenhuma sessão for salva ou **Log in again** para substituir uma sessão salva.
3. Conclua o login na janela do navegador GPT-Voice e retorne para Command Dock quando o provedor mostrar **Connected**.

Use **Clear session** quando quiser que GPT-Voice esqueça a autenticação ChatGPT Web salva. GPT-Voice pede confirmação antes de limpá-lo. Limpar a sessão desconecta este provedor; faça login novamente antes de usá-lo para transcrição.

Para obter detalhes sobre propriedade da conta, sessão do navegador e limite do provedor, consulte [provedores](../guides/providers.md).

## OpenAI API

Selecione **OpenAI API** e abra a caixa de diálogo do provedor para configurar esses campos. Use sua própria chave e conta OpenAI API; GPT-Voice não fornece chave, créditos ou acesso aos serviços OpenAI.

| Campo           | Comportamento atual                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API key**     | Insira uma nova chave para salvá-la. O campo fica em branco quando reaberto, mesmo que uma chave seja armazenada, e um salvamento em branco não substitui essa chave armazenada. |
| **Model**       | `whisper-1` é o único modelo de transcrição disponível. Ele é mostrado como um campo somente leitura.                                                                            |
| **Language**    | Escolha detecção automática (padrão), inglês, russo, ucraniano ou bielorrusso.                                                                                                   |
| **Prompt**      | Orientação de transcrição opcional. O padrão está vazio; Os espaços em branco à esquerda e à direita são removidos quando salvos.                                                |
| **Temperature** | Controla a variação da transcrição de 0 a 1. O padrão é 0; o controle muda em passos de 0,05.                                                                                    |

Escolha **Save** para validar e armazenar as alterações. Um salvamento bem-sucedido fecha a caixa de diálogo. Valores de modelo, idioma ou temperatura inválidos são rejeitados; se o salvamento falhar, a caixa de diálogo mostrará uma mensagem de erro segura e permanecerá aberta.

## Credenciais armazenadas e limpeza de autenticação

GPT-Voice armazena uma chave OpenAI API somente por meio de Electron safe storage. A chave em si não é mostrada na caixa de diálogo; a caixa de diálogo indica que uma chave de API está armazenada. Se o armazenamento seguro não estiver disponível, GPT-Voice não poderá salvar uma nova chave.Use **Clear API key** e confirme a caixa de diálogo para remover a chave armazenada enquanto mantém as outras configurações de OpenAI API. O botão está disponível apenas quando uma chave é armazenada. Você deve inserir e salvar uma nova chave antes que OpenAI API possa transcrever novamente.

As credenciais do provedor e o uso do serviço permanecem sob os termos, cobrança, cotas e política de privacidade da conta do provedor. Não cole chaves em solicitações de suporte, capturas de tela ou documentação.
