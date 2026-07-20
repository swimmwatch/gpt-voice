# Solução de problemas

Comece com a mensagem de status visível e o recurso que você estava usando. Não cole chaves de API, senhas de proxy,
ChatGPT dados da sessão, texto ditado, texto selecionado ou capturas de tela contendo-os em uma solicitação de suporte. Um útil
O relatório seguro inclui a versão GPT-Voice, sistema operacional, tipo de pacote, recurso, mensagem exata não confidencial e
etapas que reproduzem o problema.

## O microfone não pode ser iniciado

Se o Command Dock mostrar **Could not access microphone**:

1. Confirme se um microfone está conectado e disponível para outros aplicativos.
2. Permita que GPT-Voice use o microfone nos controles de privacidade do seu sistema operacional.
3. Feche outros softwares que tenham controle exclusivo do dispositivo e inicie uma nova gravação.
4. Se o dispositivo mudou enquanto GPT-Voice estava aberto, reconecte-o e reinicie GPT-Voice antes de tentar novamente.

Nenhum áudio é enviado até que GPT-Voice inicie uma gravação e você a interrompa. Para os controles de gravação e limite de novas tentativas,
veja [gravar e transcrever](guides/transcription.md).

## ChatGPT Web sessão desconectada

Se **ChatGPT Web** não for **Connected**, uma janela de login do navegador não termina ou a sessão expirou:

1. Verifique se o computador pode acessar ChatGPT e se a conta tem permissão para usar o serviço.
2. Selecione **Connect** e conclua o login na janela do navegador GPT-Voice.
3. Se a sessão armazenada não for mais válida, use **Clear session**, confirme e faça login novamente.
4. Se a inicialização ou conexão do navegador ainda falhar, teste temporariamente sem proxy e revise o navegador
   e configurações de rede abaixo.

Limpar uma sessão remove a sessão local salva de GPT-Voice; não altera a conta ou sessões em outros
navegadores. Consulte [configurações do provedor](settings/providers.md).

## OpenAI API transcrição falha

Para **OpenAI API**, verifique se o provedor está selecionado e configurado com sua própria chave de API válida. Confirme o
faturamento, cota, limites de uso e status do serviço da conta do provedor, salve qualquer correção e tente novamente o preparado
gravação se ainda estiver disponível. GPT-Voice usa o modelo de transcrição fixo `whisper-1`; não há modelo
seleção para reparar para este fornecedor.

Deixe uma chave salva existente fora dos relatórios e capturas de tela. Caso precise substituí-la, insira a nova chave e salve; usar
**Clear API key** quando quiser que GPT-Voice esqueça. Consulte [configurações do provedor](settings/providers.md) e
[provedores](guides/providers.md).

## Prettify não consegue alcançar um modelo

Antes que o Prettify possa processar o texto selecionado, seu provedor, endpoint e modelo devem ser válidos:

1. Em **Settings** > **Prettify**, selecione o provedor pretendido: Ollama ou vLLM.
2. Confirme se o serviço local ou remoto está em execução e acessível a partir deste computador.
3. Verifique o endereço do provedor e o nome do modelo e use **Load model** quando o modelo selecionado não estiver pronto.
4. Para vLLM, forneça uma chave de API somente quando esse endpoint exigir uma. Para um endpoint remoto, use HTTPS e confirmeque você tem permissão para enviar o texto selecionado para lá.
5. Salve as configurações válidas antes de executar o atalho novamente.

GPT-Voice não instala ou opera Ollama ou vLLM. Consulte [Configurações de embelezamento](settings/prettify.md) para campo
requisitos e [ações de texto](guides/text-actions.md) para limites e cancelamento de texto selecionado.

## Proxy ou serviço de navegador não pode se conectar

ChatGPT Web e Tradução usam contextos de navegador GPT-Voice. Se algum dos serviços funcionar sem o proxy, mas não com ele:

1. Desligue **Proxy enabled** temporariamente e salve a configuração para isolar o proxy do serviço.
2. Ao reativá-lo, use um URL de servidor `http://`, `https://` ou `socks5://` acessível e coloque HTTP/HTTPS
   credenciais em seus campos dedicados.
3. Remova as credenciais SOCKS5: CloakBrowser não as suporta.
4. Se **GeoIP** estiver ativado, lembre-se de que ele controla a localidade e o fuso horário do navegador. Desligue GeoIP para testar o salvo
   Valores de identidade do navegador diretamente.

Para um erro de tempo de execução do navegador, primeiro tente novamente depois que a rede estiver estável e, em seguida, teste o proxy conforme acima. Definir ** Plano de fundo
navegador** to **Visível** temporariamente se você precisar observar o contexto do navegador enquanto reproduz o problema; restaurar
a configuração usual **Hidden** depois. Consulte [Configurações do navegador](settings/browser.md) e
[Configurações de rede](settings/network.md).

## Um atalho não funciona

Abra **Settings** > **Shortcuts** e confirme se a ação está habilitada, o atalho exibido é aquele que você pressiona,
e a alteração foi salva. GPT-Voice rejeita conflitos entre seus próprios atalhos, mas outro aplicativo ou o
sistema operacional ainda pode reservar a mesma combinação.

Escolha um atalho diferente, salve-o e tente novamente enquanto GPT-Voice estiver ocioso. As ações de texto selecionado também aguardam até que um
a gravação ativa termina e a Tradução e o Prettify não podem ser executados ao mesmo tempo. Veja
[configurações de atalho](settings/shortcuts.md).

## A área de transferência ou o texto selecionado não apareceu

Para uma transcrição, aguarde **Copied to clipboard** antes de colar. Uma transcrição com falha não é copiada. Para
Tradução ou Prettify, selecione o texto no aplicativo de origem antes de pressionar o atalho de ação; Prettify aceita
até 16.000 caracteres.

Em caso de falha ou cancelamento, GPT-Voice restaura o valor da área de transferência capturado antes da ação do texto selecionado. Um
o resultado bem-sucedido substitui a área de transferência. Confirme se o aplicativo de origem permite operações normais de cópia; no Linux,
GPT-Voice também pode usar a área de transferência de seleção quando a automação de cópia normal falha. Veja
[Traduzir e embelezar o texto selecionado](guides/text-actions.md).

## Problema de instalação, atualização ou inicialização

Baixe apenas o pacote que corresponde à sua plataforma no lançamento oficial do GitHub e compare seu valor SHA-256
com o arquivo de soma de verificação que o acompanha. Execute o instalador do Windows novamente para atualizar uma instalação existente. No Linux, use
o comando documentado do gerenciador de pacotes para pacotes deb ou rpm, ou torne o AppImage executável antes de executá-lo.Não há pacote macOS compatível enquanto a assinatura e o reconhecimento de firma estão pausados. Se GPT-Voice não for iniciado após um
instalação ou atualização, reinicie o computador, tente novamente o pacote verificado e verifique se o tempo de execução normal da área de trabalho
dependências estão disponíveis. Não exclua os dados retidos do aplicativo como primeira etapa; ele contém configurações e salvo
dados do provedor. Siga [instalar, atualizar ou remover](install.md) para obter o pacote exato e o procedimento de remoção.

## Se o problema persistir

Experimente a menor reprodução segura: uma gravação curta e não sensível, uma amostra de texto selecionado não sensível ou um
verificação temporária de proxy desligado. Registre a versão, plataforma, pacote, área de configuração e erro visível sem copiar
credenciais ou conteúdo privado. Os guias relacionados acima descrevem o comportamento suportado e a recuperação disponível
controles.
