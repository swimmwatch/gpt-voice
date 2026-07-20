# Primeiro uso: conecte um provedor e transcreva a fala

Após [instalar GPT-Voice](install.md), conecte um provedor de transcrição, permita o acesso ao microfone e faça uma
gravação curta. GPT-Voice copia uma transcrição bem-sucedida para a área de transferência; ele não digita automaticamente no
aplicativo que você estava usando.

## 1. Escolha um provedor de transcrição

Abra GPT-Voice e escolha **ChatGPT Web** ou **OpenAI API** no seletor **Provider** no Command Dock.

| Provedor        | O que você precisa                                                 | Ação pela primeira vez                                                       |
| --------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **ChatGPT Web** | Uma conta ChatGPT na qual você pode fazer login.                   | Selecione-o, escolha **Connect** e conclua o login no navegador.             |
| **OpenAI API**  | Sua própria chave OpenAI API e cobrança ou cota de API disponível. | Selecione-o e escolha **Configure** para abrir as configurações do provedor. |

A disponibilidade, limites, cobrança e termos do provedor são controlados pela conta que você usa. GPT-Voice não ignora
esses limites.

### Conectar ChatGPT Web

1. Selecione **ChatGPT Web**.
2. Escolha **Connect**.
3. Conclua o login do ChatGPT na janela do navegador que é aberta.
4. Depois que ChatGPT estiver pronto, feche a janela de login e retorne para GPT-Voice.

O estado do provedor muda para **Connected** quando a sessão está pronta. GPT-Voice salva a sessão do navegador em seu
dados locais do aplicativo e inicia seu navegador em segundo plano automaticamente em inicializações posteriores. Se a sessão expirar, escolha
**Connect** novamente para fazer login novamente.

### Configurar OpenAI API

1. Selecione **OpenAI API**.
2. Escolha **Configure**. Você também pode usar o controle de configurações do provedor ao lado do seletor de provedor.
3. Cole sua chave OpenAI API.
4. Opcionalmente, escolha um idioma de transcrição, prompt ou temperatura.
5. Escolha **Save**.

O modelo de transcrição é fixado em `whisper-1`. Após um salvamento bem-sucedido, GPT-Voice mostra o provedor como
**Connected** e informa que o provedor está configurado. O aplicativo armazena a chave API localmente usando Electron
armazenamento seguro quando disponível; a chave não é mostrada na interface. A transcrição OpenAI API não usa um
navegador.

## 2. Permitir acesso ao microfone

A primeira gravação solicita permissão do microfone ao seu sistema operacional. Permitir acesso para GPT-Voice, depois retornar para
o Command Dock. Se o acesso for negado ou nenhum microfone estiver disponível, o status mostrará **Erro: não foi possível acessar
microfone** e nenhum áudio é enviado. Habilite a permissão nos controles de privacidade do seu sistema operacional antes de tentar
novamente.

## 3. Faça uma primeira gravação

1. Selecione um provedor que mostre **Connected**.
2. Escolha **Start recording** ou pressione o atalho de gravação exibido (o padrão é `F9`).3. Fale uma frase curta. O status muda para **Recording**.
3. Escolha **Stop recording** (padrão `F10`). GPT-Voice altera o status para **Transcribing** enquanto envia o
   áudio capturado para o provedor selecionado.
4. Aguarde **Copied to clipboard** e cole em qualquer campo de texto para confirmar o resultado.

Você também pode pausar, retomar ou cancelar uma gravação ativa no Command Dock. Cancelar descarta o ativo
gravar em vez de enviá-lo para transcrição.

## Se a primeira transcrição não funcionar

- Se **Connected** não for mostrado, reabra os controles do provedor e conclua o login ou salve uma chave de API válida. Para
  ChatGPT Web, o status pode indicar que a inicialização do navegador falhou ou que a sessão expirou.
- Se o status reportar um erro de microfone, permita que GPT-Voice use seu microfone no sistema operacional e faça um
  nova gravação.
- Se o status reportar **Transcription failed** ou **Transcription error**, verifique a conta do provedor selecionado,
  conexão e limites e tente novamente. Uma transcrição com falha não é copiada para a área de transferência.

As próximas páginas do guia cobrem controles de gravação, comportamento do provedor, atalhos e solução de problemas com mais detalhes. Para
agora, um provedor **Connected** e um resultado **Copied to clipboard** confirmam que o caminho básico está funcionando.
