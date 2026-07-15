#Configurações do navegador

GPT-Voice usa CloakBrowser para serviços baseados em navegador, como ChatGPT Web e tradução de texto selecionado. Abra **Settings** e selecione **Browser** para definir o comportamento e os valores de identidade usados ​​quando GPT-Voice cria esses contextos de navegador. Configure um proxy em [Configurações de rede](network.md).

## Comportamento do navegador

| Configuração           | Padrão      | Valores disponíveis        | Efeito                                                                                   |
| ---------------------- | ----------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| **Humanize input**     | Habilitado  | Habilitado ou desabilitado | Passa a configuração de entrada Humanizar para CloakBrowser.                             |
| **Human preset**       | **Careful** | **Default** ou **Careful** | Escolhe a predefinição de humanização CloakBrowser.                                      |
| **Background browser** | **Hidden**  | **Hidden** ou **Visible**  | Controla se o navegador de fundo persistente de GPT-Voice está sem cabeça ou é mostrado. |

A configuração **Background browser** se aplica ao navegador persistente em segundo plano. Uma janela de login ChatGPT Web está sempre visível para que você possa concluir a autenticação. Escolha **Visible** quando precisar observar o navegador em segundo plano; caso contrário, deixe o modo padrão **Hidden** selecionado.

## Identidade do navegador

Abra **Identity** para visualizar ou alterar os valores que GPT-Voice passa para um contexto de navegador.

| Configuração         | Padrão                                                     | Requisito e ação                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fingerprint seed** | Semente numérica gerada por GPT-Voice                      | Somente dígitos obrigatórios. Escolha **Reset** para gerar uma nova semente numérica de cinco dígitos.                                                                                                    |
| **Locale**           | `en-US`                                                    | Selecione uma das localidades do navegador suportadas: `en-US`, `en-GB`, `ru-RU`, `uk-UA`, `be-BY`, `de-DE`, `fr-FR`, `es-ES`, `it-IT`, `pt-BR`, `pl-PL`, `tr-TR`, `ja-JP`, `ko-KR`, `zh-CN`, ou `zh-TW`. |
| **Timezone**         | O fuso horário do seu sistema ou `UTC` quando indisponível | Selecione um fuso horário da IANA compatível.                                                                                                                                                             | Semente de impressão digital, localidade e fuso horário são obrigatórios. As configurações rejeitam uma semente contendo qualquer coisa que não seja dígitos, uma localidade que não seja uma localidade BCP 47 válida ou um fuso horário que não seja um fuso horário IANA válido. GPT-Voice remove os espaços em branco ao redor ao salvar esses valores. |

### Proxy GeoIP controla localidade e fuso horário

Quando o proxy é ativado com **GeoIP** em [Configurações de rede](network.md), o proxy determina a localidade e o fuso horário do navegador. GPT-Voice desabilita esses dois campos em **Identity** e mostra a mensagem **Proxy GeoIP controls locale and timezone**. A localidade e o fuso horário salvos permanecerão disponíveis se você desativar GeoIP posteriormente, mas eles não serão enviados para um contexto de navegador enquanto o proxy ativo GeoIP os possuir.

## Salvar alterações

As configurações do navegador fazem parte do formulário Configurações. Alterar um valor cria **Unsaved changes**; escolha **Save changes** após a validação ser bem-sucedida. A configuração normal do navegador é armazenada nas configurações locais de GPT-Voice e será usada na próxima vez que GPT-Voice criar o contexto de navegador aplicável. Consulte a [Visão geral das configurações](index.md) para erros de salvamento e comportamento de confirmação de descarte.
