# Escolha e gerencie um provedor de transcrição

GPT-Voice usa um provedor de transcrição ativo por vez. Escolha-o no seletor **Provider** em Command Dock. A troca do seletor altera qual provedor receberá a próxima gravação; ele não transfere sessões, chaves de API, cobrança ou acesso à conta entre provedores.

| Provedor        | Autenticação                               | Para onde o áudio é enviado                  |
| --------------- | ------------------------------------------ | -------------------------------------------- |
| **ChatGPT Web** | Uma sessão do navegador ChatGPT conectada. | Por meio da sessão ChatGPT conectada.        |
| **OpenAI API**  | Uma chave OpenAI API que você fornece.     | Endpoint de transcrições de áudio de OpenAI. |

Use apenas uma conta que você esteja autorizado a usar. Disponibilidade, cobrança, cotas, limites de uso e termos de serviço são definidos pela conta e serviço do provedor. GPT-Voice não os ignora.

## ChatGPT Web

Selecione **ChatGPT Web** e escolha **Connect**. GPT-Voice abre uma janela de login do navegador em ChatGPT. Conclua o login lá e feche a página de login. GPT-Voice salva a sessão do navegador resultante localmente e inicia seu navegador em segundo plano em inicializações posteriores, quando a sessão ainda estiver utilizável.

Quando a sessão estiver pronta, o provedor mostrará **Connected**. Se a sessão expirar, GPT-Voice removerá a sessão armazenada inutilizável e você deverá escolher **Connect** novamente. Uma solicitação de transcrição também pode atualizar seu token de acesso de curta duração uma vez; isso não substitui uma nova entrada quando a sessão subjacente não é mais válida.

Para sair do GPT-Voice, abra as configurações do provedor e use **Clear authentication**. Isso remove os dados da sessão do navegador GPT-Voice salvos do ChatGPT e o token de acesso em cache. Ele não gerencia sua conta, assinatura ou quaisquer sessões realizadas por outros navegadores ou dispositivos.

## OpenAI API

Selecione **OpenAI API** e escolha **Configure** ou abra o controle de configurações do provedor ao lado do seletor. Cole sua própria chave de API e salve o formulário. GPT-Voice usa o modelo de transcrição fixo `whisper-1`; não permite que este provedor selecione outro modelo de transcrição.

As configurações do provedor também permitem escolher:

- **Language**: detecção automática (o padrão), inglês, russo, ucraniano ou bielorrusso.
- **Prompt**: orientação opcional enviada junto com a solicitação de transcrição.
- **Temperature**: um valor de `0` a `1`; o padrão é `0`.

GPT-Voice armazena a chave API localmente com Electron safe storage quando essa proteção está disponível e nunca exibe a chave salva na interface. Se o armazenamento seguro não estiver disponível, o salvamento de uma nova chave falhará em vez de armazená-la sem essa proteção. O provedor OpenAI API não usa a janela de login do navegador.Use **Clear authentication** nas configurações do provedor para remover a chave de API salva. As opções de transcrição não secreta permanecem disponíveis para a próxima chave configurada, mas o provedor não está conectado até que uma chave válida seja salva novamente.

## Troque ou recupere um provedor

Você pode trocar de provedor antes de iniciar uma gravação. Confirme se o provedor recém-selecionado é **Connected** antes de gravar; uma sessão ChatGPT Web configurada e uma chave OpenAI API configurada são independentes.

Se a transcrição falhar:

1. Verifique se o provedor selecionado ainda está conectado e se sua conta pode usar transcrição.
2. Para **ChatGPT Web**, reconecte se a sessão expirou ou o navegador não conseguiu inicializar.
3. Para **OpenAI API**, confirme a chave API, o faturamento ou a cota e o status do serviço do provedor e salve qualquer correção necessária.
4. Retorne para [gravação e transcrição](transcription.md) para tentar novamente a captura preparada mais recentemente ou iniciar uma nova gravação.

As configurações do provedor afetam solicitações futuras. Eles não podem recuperar uma gravação cancelada ou substituir erros de acesso, cota, política ou serviço do lado do provedor.
