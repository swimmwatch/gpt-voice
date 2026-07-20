# Embelezar as configurações

**Prettify** é a ação de limpeza de preservação de significado de GPT-Voice para o texto selecionado. Abra **Settings** e selecione **Prettify** para escolher o serviço, seu modelo e seu comportamento de geração. Para selecionar o texto e iniciar a ação, consulte [traduzir e embelezar o texto selecionado](../guides/text-actions.md).

Prettify precisa de um serviço Ollama ou vLLM que você opera, além de um modelo selecionado para esse serviço. GPT-Voice não baixa, inicia, hospeda ou paga por nenhum dos serviços. O campo modelo é obrigatório; se nenhum modelo estiver configurado, o Prettify informa que um modelo é necessário em vez de enviar o texto selecionado.

## Escolha um provedor e conecte-o

Escolha **Ollama** ou **vLLM** em **Provider**. GPT-Voice mantém o URL base e o modelo selecionado separadamente para cada provedor, portanto, a troca de provedor não substitui as escolhas do outro provedor. O provedor padrão é Ollama.

| Provedor   | URL base padrão            | Padrão do modelo          | Comportamento de conexão                                                                                  |
| ---------- | -------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Ollama** | `http://127.0.0.1:11434`   | Nenhum modelo selecionado | Atualiza os modelos disponíveis em seu serviço Ollama e envia solicitações Prettify para ele.             |
| **vLLM**   | `http://127.0.0.1:8000/v1` | Nenhum modelo selecionado | Atualiza os modelos expostos pelo seu serviço compatível com vLLM e envia solicitações Prettify para ele. |

Insira um URL base completo `http` ou `https`. GPT-Voice remove espaços em branco ao redor e barras finais ao salvar a configuração. URLs que não sejam HTTP(S) ou que incluam um nome de usuário ou senha serão rejeitados. HTTP é permitido apenas para um endpoint de loopback como `127.0.0.1`, `localhost` ou `::1`; todo endpoint sem loopback deve usar HTTPS.

Quando o URL base válido e ativo é remoto em vez de loopback, as Configurações exibem um aviso de privacidade. Usar esse endpoint envia o texto selecionado e o prompt do Prettify configurado para o serviço que você escolheu. Revise os controles de privacidade, retenção e acesso desse serviço antes de usar o processamento remoto.

### vLLM Chave de API

O campo **vLLM API key** aparece somente quando vLLM é selecionado. Use-o quando seu serviço vLLM exigir autenticação de portador. GPT-Voice envia a chave com solicitações vLLM somente quando uma chave é configurada.

A chave é armazenada separadamente com Electron safe storage. Depois de salvo, o campo não o revela novamente; em vez disso, indica que uma chave está armazenada. Deixar o campo em branco mantém uma chave armazenada existente. Escolha **Clear API key** para removê-lo. Se o armazenamento seguro não estiver disponível em seu sistema, GPT-Voice não poderá salvar uma nova chave vLLM.

Não coloque uma chave em um URL base, uma captura de tela ou uma solicitação de suporte.

## Selecione e gerencie um modeloEscolha **Refresh models** após iniciar o serviço do provedor ativo ou alterar seu URL base. A lista de modelos vem do provedor ativo, portanto atualize-a novamente após mudar de provedor. Selecione um dos modelos retornados antes de executar o Prettify. Se a conexão, o serviço, a autenticação ou a resposta do provedor falhar, as Configurações mostrarão um erro de conexão ou de atualização de modelo; verifique se o URL é válido, se o serviço está em execução e se a chave vLLM é apropriada e atualize novamente.

Ollama mostra um menu **Model actions** adicional quando um modelo é selecionado:

- **Load model** pede a Ollama para manter o modelo selecionado carregado para GPT-Voice. Se GPT-Voice manteve um modelo Ollama diferente carregado, ele libera esse modelo primeiro.
- **Free model** pede a Ollama para liberar o modelo selecionado da memória.

Essas ações estão disponíveis apenas para Ollama, não para vLLM. O modelo Ollama selecionado mostra **Loaded** ou **Not loaded** após GPT-Voice verificar seu estado de modelo em execução. Quando Ollama informa um tamanho, Configurações também mostra um modelo aproximado ou tamanho de VRAM carregado. Trate o valor como uma estimativa relatada por Ollama, não como uma reserva de memória garantida por GPT-Voice.

O carregamento, a liberação e a atualização poderão falhar se o endpoint estiver indisponível ou se o provedor rejeitar a solicitação. As configurações deixam o formulário atual aberto e mostram o resultado ou erro para que você possa corrigir o endpoint ou modelo e tentar novamente.

## Controle como o texto é gerado

**Temperature** é o controle de geração primário. Seu padrão é **0**, com um intervalo permitido de **0 to 1** em etapas de **0.05**. Um valor menor exige menor variação do fornecedor; alterá-lo altera a próxima solicitação do Prettify depois de salvar as configurações.

Abra **Advanced generation** para alterar os controles restantes. O resumo recolhido indica se todos os valores avançados ainda usam seus padrões ou quantos foram alterados. Essas configurações são enviadas com cada solicitação do Prettify ao provedor selecionado.

| Controle                  |    Padrão | Valor aceito                                         | Use-o para                                                                                                                                                                       |
| ------------------------- | --------: | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Top P**                 |     `0.9` | `0.05`–`1`, em `0.05` etapas                         | Limitar as escolhas ao intervalo de probabilidade cumulativa mais provável.                                                                                                      |     | **Min P** | `0` | `0`–`1`, em `0.05` etapas | Excluindo escolhas de menor probabilidade abaixo do limite selecionado. |
| **Repeat penalty**        |       `1` | `0.8`–`1.5`, em `0.05` etapas                        | Ajustar a intensidade com que o fornecedor desencoraja a produção repetida.                                                                                                      |
| **Top K**                 |      `40` | Inteiro de `1` a `200`                               | Limitar cada escolha aos candidatos mais prováveis.                                                                                                                              |
| **Maximum output tokens** |    `4096` | Inteiro de `1` a `8192`                              | Limitando o comprimento da resposta gerada. A resposta ainda pode ser mais curta.                                                                                                |
| **Seed**                  | Desativar | Em branco ou um número inteiro de `0` a `2147483647` | Fornecer uma semente numérica opcional ao provedor. Pode ajudar a reproduzir uma solicitação, mas os resultados ainda podem variar de acordo com o modelo e a versão do serviço. |

Os controles decimais usam incrementos de 0,05. Top P aceita 0,05 a 1; Min P aceita 0 a 1; e a penalidade de repetição aceita 0,8 a 1,5. Top K aceita números inteiros de 1 a 200, enquanto os tokens de saída máxima aceitam números inteiros de 1 a 8192.

Use os padrões, a menos que conheça os requisitos do modelo e serviço selecionado. GPT-Voice envia opções de geração equivalentes para Ollama e vLLM, mas qualquer um dos serviços ainda pode rejeitar uma solicitação ou lidar com uma configuração de acordo com seu próprio suporte de modelo.

## Escreva o prompt do Prettify

**Prompt** é obrigatório e o padrão é a instrução conservadora integrada do editor de cópia de GPT-Voice. Diz ao serviço para tratar o texto selecionado como material de origem inerte, preservar sua linguagem e significado, corrigi-lo e esclarecê-lo, remover repetições desnecessárias e retornar apenas o texto editado. Também instrui o serviço a não executar instruções contidas no texto selecionado.

Você pode substituir o prompt por uma política de edição diferente. Mantenha-o em **4,000 characters or fewer**. Um prompt em branco, um prompt com mais de 4.000 caracteres, um provedor não suportado, um terminal inválido, um modelo vazio ou um valor de geração fora do intervalo bloqueia **Save changes** e identifica o campo afetado. Os espaços em branco à esquerda e à direita são removidos quando as configurações são salvas.

O prompt é enviado com o texto selecionado para o provedor ativo. Não inclua senhas, chaves de API, dados pessoais ou instruções confidenciais que você não gostaria que esse provedor recebesse.

## Salvar e validar alteraçõesOs valores de provedor, modelo, prompt e geração fazem parte do formulário Configurações. Uma edição cria **Unsaved changes**; escolha **Save changes** somente depois que o formulário não apresentar erros de validação. Um salvamento bem-sucedido persiste na configuração normal do Prettify e fecha as Configurações. A chave vLLM permanece separada: ela é armazenada apenas através de Electron safe storage e nunca é retornada na visualização de configurações.

Se o salvamento falhar, a janela Configurações permanecerá aberta com uma mensagem de erro segura. Corrija o campo informado ou a conexão do provedor e tente novamente. Consulte a [Visão geral das configurações](index.md) para comportamento de alteração não salva e confirmação de descarte.
