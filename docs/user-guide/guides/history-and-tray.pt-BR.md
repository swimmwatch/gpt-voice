# Histórico de transcrição e bandeja

GPT-Voice mantém um histórico local de transcrições bem-sucedidas para que você possa reutilizar um resultado depois que ele sair da área de transferência.
A bandeja fornece acesso ao aplicativo quando sua janela principal está oculta.

## Reutilizar histórico de transcrição

Abra o menu da bandeja e escolha **History**. Cada transcrição bem-sucedida é armazenada localmente com seu horário de solicitação,
nome do provedor e texto. O histórico é armazenado nos dados SQLite locais da aplicação; não armazena o gravado
áudio. Como as entradas podem conter texto ditado confidencial, trate o histórico como faria com qualquer outro documento local.

As entradas mais recentes aparecem primeiro. O histórico é carregado progressivamente à medida que você rola, portanto, um histórico longo não precisa ser carregado
um pedido. A janela mostra mensagens de carregamento, nova tentativa e erro seguro se não for possível buscar a próxima página.

Para reutilizar uma entrada, selecione seu cartão de texto. GPT-Voice copia o texto armazenado dessa entrada para a área de transferência do sistema e brevemente
mostra **Copied**. Não submete novamente o texto para transcrição. Se a cópia falhar ou uma entrada já tiver sido
removido, a janela do histórico relata a falha em vez de alterar a área de transferência.

## Limpar histórico local

Use **Clear history** na janela Histórico e confirme a caixa de diálogo para excluir todas as entradas de transcrição salvas. Isto
a ação limpa a história local; não pode ser desfeito em GPT-Voice. Novas transcrições bem-sucedidas criam novas entradas
depois.

Se você deseja remover todos os dados retidos do aplicativo como parte da desinstalação do GPT-Voice, siga as instruções específicas da plataforma
instruções em [instalar, atualizar ou remover](../install.md).

## Use a bandeja

Fechar a janela principal GPT-Voice a oculta em vez de encerrar o aplicativo. O aplicativo continua a ser executado no
bandeja do sistema, para que seus atalhos globais configurados permaneçam disponíveis. Selecione o ícone da bandeja para focar a janela principal visível
ou mostre-o se estiver oculto.

O menu da bandeja fornece estas ações:

| Ação do menu       | Resultado                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| **Show GPT-Voice** | Mostra e foca a janela principal ou cria-a, se necessário.                                             |
| **Settings**       | Abre a janela Configurações.                                                                           |
| **History**        | Abre o histórico de transcrição local.                                                                 |
| **About**          | Abre a janela Sobre.                                                                                   |
| **Quit**           | Sai de GPT-Voice. Use isto quando quiser parar o aplicativo em vez de simplesmente ocultar sua janela. |

O ícone da bandeja reflete a atividade atual: inativo, gravação, pausado, processamento de transcrição ou Prettify. É umindicador e ponto de navegação; os controles de gravação permanecem disponíveis através do Command Dock e seus configurados
atalhos.
