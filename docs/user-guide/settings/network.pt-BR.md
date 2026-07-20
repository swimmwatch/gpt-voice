# Configurações de rede

Abra **Settings** e selecione **Network** para configurar o proxy GPT-Voice passa para contextos CloakBrowser. Essas configurações afetam serviços baseados em navegador, como ChatGPT Web e tradução de texto selecionado. Para as configurações de identidade afetadas pelo proxy GeoIP, consulte [Configurações do navegador](browser.md).

## Habilite um proxy

**Proxy enabled** está desativado por padrão. Quando está desativado, GPT-Voice não passa um proxy para CloakBrowser e os campos de rede restantes são desativados. Desligá-lo não apaga os valores inseridos, portanto você pode ativar o proxy novamente mais tarde.

Ao habilitá-lo, **Proxy server** é necessário. Insira um URL completo usando um destes protocolos:

- `http://`
- `https://`
- `socks5://`

Por exemplo, `http://proxy.example.com:8080` é um formato de servidor válido. GPT-Voice remove os espaços em branco ao redor quando salva o valor. Ele rejeita servidores ausentes ou malformados, protocolos não suportados e URLs que contenham nome de usuário ou senha. Coloque as credenciais em campos separados.

## Ignorar e credenciais

| Campo        | Padrão                   | Comportamento                                                                                |
| ------------ | ------------------------ | -------------------------------------------------------------------------------------------- |
| **Bypass**   | Em branco                | Opcional. Quando fornecido, GPT-Voice passa o valor de bypass para CloakBrowser com o proxy. |
| **Username** | Em branco                | Nome de usuário proxy opcional para autenticação de proxy HTTP ou HTTPS.                     |
| **Password** | Nenhuma senha armazenada | Senha de proxy opcional para autenticação de proxy HTTP ou HTTPS.                            |

A senha é armazenada separadamente através de Electron safe storage. Após salvar, seu valor não retorna às Configurações; o campo mostra que uma senha foi salva. Deixar o campo em branco mantém uma senha existente. Escolha **Clear** para removê-lo. Se o armazenamento seguro não estiver disponível, GPT-Voice não poderá salvar uma nova senha de proxy.

Não coloque um nome de usuário ou senha na URL do servidor proxy, cole credenciais em uma solicitação de suporte ou as exponha em uma captura de tela.

### SOCKS5 credenciais não são suportadas

CloakBrowser não suporta um nome de usuário ou senha para um proxy SOCKS5. Quando um proxy SOCKS5 habilitado tem uma das credenciais, Configurações exibe um aviso e bloqueia o salvamento até que você remova o nome de usuário e limpe a senha. GPT-Voice não passa credenciais de SOCKS5 para CloakBrowser.

## Deixe o proxy GeoIP possuir a identidade do navegador

**GeoIP** está desativado por padrão e está disponível somente quando o proxy está ativado. Ative-o quando o proxy configurado determinar a localidade e o fuso horário do navegador. Embora o proxy e o GeoIP estejam ativos, o GPT-Voice passa o proxy com o GeoIP ativado e não passa o local ou fuso horário salvo separadamente.Consequentemente, os campos **Locale** e **Timezone** em [Configurações do navegador](browser.md) são desabilitados e mostram **Proxy GeoIP controls locale and timezone**. Desligue GeoIP para editar e usar os valores de identidade do navegador salvos novamente.

## Salvar e solucionar problemas

Os valores de rede fazem parte do formulário Configurações. Escolha **Save changes** após a validação ser bem-sucedida; a configuração de proxy salva será usada na próxima vez que GPT-Voice criar o contexto de navegador aplicável. Se o salvamento falhar, as Configurações permanecerão abertas e identificarão o campo inválido.

Para uma falha de conexão, confirme se a URL do servidor inclui `http`, `https` ou `socks5`, se o proxy está acessível e se as credenciais HTTP/HTTPS estão em seus campos dedicados. Não insira credenciais SOCKS5. Consulte a [Visão geral das configurações](index.md) para comportamento de alteração não salva e confirmação de descarte.
