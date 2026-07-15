# Traduzir e embelezar o texto selecionado

GPT-Voice pode atuar no texto selecionado em outro aplicativo. **Translate** envia a seleção para Google Translate no
idioma alvo que você escolher. **Prettify** envia para seu provedor de processamento de texto configurado para melhorar o texto
de acordo com seu prompt. Nenhuma das ações é colada no outro aplicativo: em caso de sucesso, copie o resultado do sistema
área de transferência e cole-a onde for necessário.

## Habilite uma ação e escolha seu atalho

Abra **Settings** e selecione **Shortcuts**. As linhas **Translate** e **Prettify** têm, cada uma, uma chave de habilitação e um
**Change** controle para seu atalho global. Ambas as ações estão habilitadas por padrão; seus atalhos padrão são `F11`
para Traduzir e `F12` para Prettify. Salve as configurações depois de fazer uma alteração.

Escolha um atalho que não entre em conflito com outro atalho GPT-Voice ou com o software que você usa. Uma ação desabilitada
não é executado quando seu atalho é pressionado. Uma ação também espera até que uma gravação ativa termine e GPT-Voice é executada
apenas uma ação de texto selecionado por vez.

## Traduzir uma seleção

1. No aplicativo que contém o texto, selecione o texto que deseja traduzir.
2. Em GPT-Voice Command Dock, escolha **Target language**: inglês, russo, ucraniano ou bielorrusso.
3. Pressione o atalho Traduzir habilitado (por padrão, `F11`).
4. Aguarde a notificação de sucesso e cole o texto traduzido da sua área de transferência.

GPT-Voice copia o texto selecionado usando a ação de cópia normal do sistema operacional e depois o envia ao Google
Traduzir. A tradução é um serviço externo: o texto selecionado é enviado para Google Translate, portanto não use esta ação
para texto que você não tem permissão para compartilhar com esse serviço.

Se não houver texto selecionado, a cópia não poderá ser automatizada ou o serviço não poderá retornar um resultado, GPT-Voice relata um
mensagem de erro segura e restaura o valor da área de transferência que estava presente antes da ação. No Linux, também pode usar o
área de transferência de seleção quando a ação normal de cópia falhar. Uma tradução bem-sucedida substitui a área de transferência do sistema pela
resultado traduzido.

## Embelezar uma seleção

Antes de usar o Prettify, abra **Settings** e selecione **Prettify**. Escolha **Ollama** ou **vLLM**, defina o provedor
endereço e modelo e salve uma configuração válida. vLLM também pode exigir uma chave de API.

1. Selecione até 16.000 caracteres no aplicativo que você está editando.
2. Pressione o atalho Prettify habilitado (por padrão, `F12`).
3. Aguarde a notificação **Text prettified** e cole o resultado da sua área de transferência.

Ollama e vLLM são dependências operadas pelo usuário: GPT-Voice não instala, hospeda ou gerencia nenhum dos serviços. Um local
O endpoint de loopback mantém a solicitação na máquina que executa esse serviço. Um terminal remoto recebe o texto selecionado;
use um provedor em que você confia, siga sua política de tratamento de dados e use HTTPS para um endpoint não local.Se nenhum texto for selecionado, a seleção excede 16.000 caracteres, o provedor configurado não pode ser alcançado ou
não retorna nenhum resultado utilizável, GPT-Voice relata a falha e restaura o conteúdo anterior da área de transferência. Enquanto um lindo
solicitação está em execução, o atalho de cancelamento configurado (padrão `Escape`) a cancela e restaura o valor da área de transferência.

## Área de transferência e ações simultâneas

Tradução e Prettify são intencionalmente mutuamente exclusivos. Começar um enquanto o outro já está funcionando pula
a nova solicitação, portanto aguarde o status ou a notificação antes de tentar novamente. Em caso de sucesso, o resultado substitui o
prancheta; em uma solicitação com falha ou cancelada, GPT-Voice restaura o valor da área de transferência capturado antes de ler o
seleção. Verifique sempre o resultado colado, especialmente quando o texto fonte contém nomes, códigos ou outros valores exatos.
