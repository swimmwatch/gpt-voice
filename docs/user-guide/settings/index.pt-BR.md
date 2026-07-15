# Visão geral das configurações

Abra **Settings** no menu da bandeja GPT-Voice. A janela Configurações abre em **Shortcuts** e tem quatro seções:

| Seção                       | Use-o para                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Shortcuts**               | Escolha os atalhos globais para gravar, parar, cancelar, traduzir, embelezar e tentar novamente uma transcrição.                   |
| **[Prettify](prettify.md)** | Escolha o provedor de processamento de texto Ollama ou vLLM e configure seu modelo e comportamento de geração.                     |
| **[Browser](browser.md)**   | Configure a identidade do navegador e o comportamento em segundo plano que GPT-Voice usa para seus serviços baseados em navegador. |
| **[Network](network.md)**   | Configure o proxy usado por esses serviços baseados em navegador.                                                                  |

Os botões de seção permanecem disponíveis em janelas estreitas como ícones com rótulos acessíveis. Selecione uma seção para alterar suas configurações; cada página descreve seus próprios campos e pré-requisitos.

## Salvar alterações

As configurações são carregadas a partir da configuração salva do aplicativo quando a janela é aberta. Alterar um valor marca o formulário como tendo **Unsaved changes**. O botão **Save changes** estará disponível somente após pelo menos uma alteração ser feita e todos os valores de campo atuais serem válidos. Ele permanece desativado enquanto GPT-Voice está salvando.

Quando um valor não atende aos seus requisitos, o campo afetado mostra uma mensagem de validação e o salvamento fica bloqueado até que você o corrija. Se uma operação de salvamento falhar, as Configurações permanecerão abertas e mostrarão uma mensagem de erro para que você possa corrigir o problema ou tentar novamente. Um salvamento bem-sucedido atualiza a configuração salva e fecha a janela Configurações.

##Feche sem perder trabalho por acidente

Fechar as configurações sem alterações não salvas fecha-as imediatamente. Se houver alterações não salvas, GPT-Voice perguntará se você deseja descartá-las. Escolha **Keep editing** para retornar ao formulário ou **Discard changes** para fechar as Configurações sem salvar as edições pendentes. Enquanto um salvamento está em andamento, o fechamento das Configurações fica bloqueado até que a operação termine.

Esta confirmação se aplica ao formulário de configurações. Capturar um novo atalho global é uma ação separada: GPT-Voice suspende temporariamente os atalhos globais enquanto escuta a combinação de teclas e os retoma quando a captura é concluída ou cancelada.
