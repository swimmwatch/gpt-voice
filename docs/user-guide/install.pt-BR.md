# Instale, atualize ou remova GPT-Voice

GPT-Voice tem versões prontas para execução para Windows e Linux. Você não precisa de Node.js, npm, modelo local, CUDA ou
Whisper instalado separadamente.

Baixe o pacote para o seu computador em [GitHub Releases](https://github.com/swimmwatch/gpt-voice/releases).
Cada versão também inclui arquivos `SHA256SUMS-*.txt` específicos da plataforma. Para verificar um download, compare o valor SHA-256
relatado pela ferramenta de soma de verificação do seu sistema operacional com a entrada do ativo de lançamento que você baixou.

> As versões do macOS são pausadas enquanto a assinatura e o reconhecimento de firma do Developer ID são preparados. Não instale um DMG não oficial
> como GPT-Voice; não há pacote macOS compatível nas versões atuais.

## Escolha um ativo de lançamento

| Plataforma              | Liberar ativo            | Use-o quando                                                                 |
| ----------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| Janelas                 | `GPT-Voice Setup *.exe`  | Você deseja uma instalação normal do Windows.                                |
| Linux da família Debian | `gpt-voice_*_amd64.deb`  | Você usa Ubuntu, Debian, Linux Mint, Pop!_OS ou uma distribuição semelhante. |
| Linux da família RPM    | `gpt-voice-*.x86_64.rpm` | Você usa Fedora, RHEL, CentOS, openSUSE ou uma distribuição semelhante.      |
| Linux                   | `GPT-Voice-*.AppImage`   | Você deseja uma compilação portátil sem instalar um pacote de sistema.       |

## Guias por sistema operacional

Escolha seu sistema operacional para ver as etapas detalhadas de instalação, atualização e remoção.

- [Windows](install/windows.md)

- [Linux](install/linux.md)

- [macOS](install/macos.md)

Quando a instalação terminar, continue com o [primeiro uso](getting-started.md) para conectar um provedor de transcrição e fazer a primeira gravação.
