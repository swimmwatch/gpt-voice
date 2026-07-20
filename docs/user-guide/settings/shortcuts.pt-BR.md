# Configurações de atalho

GPT-Voice usa atalhos globais, para que possam funcionar enquanto você está em outro aplicativo. Abra **Settings** e escolha **Shortcuts** para visualizá-los ou alterá-los.

| Ação                                  | Atalho padrão | Quando funciona                                                                                                                |
| ------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Start, pause, or resume recording** | `F9`          | Inicia a gravação quando ocioso, pausa uma gravação ativa ou retoma uma gravação pausada.                                      |
| **Stop recording**                    | `F10`         | Interrompe uma gravação ou uma gravação pausada e inicia a transcrição.                                                        |
| **Cancel**                            | `Escape`      | Cancela uma gravação ativa. Quando nenhuma gravação está ativa, ela cancela uma solicitação Prettify em execução.              |
| **Translate selected text**           | `F11`         | Traduz o texto selecionado quando a Tradução está habilitada e nenhuma gravação ou outra ação de texto selecionado está ativa. |
| **Prettify selected text**            | `F12`         | Embeleza o texto selecionado quando Embelezar está ativado e nenhuma gravação ou outra ação de texto selecionado está ativa.   |
| **Retry transcription**               | `Ctrl+F8`     | Tenta novamente a transcrição repetível mais recente somente quando GPT-Voice está ocioso.                                     |

O atalho para nova tentativa fica indisponível até que haja uma transcrição que possa ser repetida. Consulte [gravar e transcrever](../guides/transcription.md) para saber quando a nova tentativa fica disponível e [traduzir e embelezar o texto selecionado](../guides/text-actions.md) para os fluxos de trabalho de texto selecionado.

## Alterar um atalho

1. Selecione **Change** na linha da ação.
2. Na caixa de diálogo de captura, pressione toda a combinação de teclas que deseja usar.
3. Verifique a combinação mostrada na caixa de diálogo e escolha **Apply**. Escolha **Cancel** para deixar o atalho atual inalterado.

GPT-Voice suspende temporariamente todos os seus atalhos globais enquanto a caixa de diálogo de captura está aberta e os registra novamente quando você os aplica ou cancela. Pressione uma tecla não modificadora como parte da combinação; pressionar apenas `Ctrl`, `Alt`, `Shift` ou a tecla de comando da plataforma não cria um atalho.

## Evite conflitos

Use um atalho diferente para cada ação GPT-Voice e escolha combinações que não colidam com seu sistema operacional ou outro software. GPT-Voice rejeita atribuições GPT-Voice conflitantes. Uma chave não modificada entra em conflito com a mesma chave base, mesmo que a outra atribuição inclua modificadores, portanto, não emparelhe, por exemplo, F9 com Ctrl+F9.

Se uma nova atribuição não puder ser registrada, GPT-Voice mantém o atalho atual e mostra o motivo. No macOS, uma tecla Command capturada é representada como `Command`; em outras plataformas suportadas, a plataforma equivalente é usada.## Habilite ou desabilite ações de texto selecionado

As linhas **Translate** e **Prettify** possuem, cada uma, uma chave de habilitação. Ambos estão habilitados por padrão. Desligue um botão para evitar que essa ação seja executada mesmo se seu atalho for pressionado; ative-o para disponibilizar novamente o atalho configurado quando as condições normais da ação forem atendidas.

Essas opções fazem parte do formulário Configurações, então escolha **Save changes** após alterá-las. Alterar um atalho através da caixa de diálogo de captura aplica esse atalho de forma independente; use o indicador de alterações não salvas na visão geral das configurações para distinguir as edições pendentes do formulário de um atalho já aplicado.
