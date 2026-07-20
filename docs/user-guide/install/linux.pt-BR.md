# Linux

## Pacote deb Linux

Para Ubuntu, Debian, Linux Mint, Pop!_OS e distribuições semelhantes, instale o pacote baixado:

```bash
sudo apt install ./gpt-voice_*_amd64.deb
```

Se o seu sistema não puder instalar um deb local através de `apt`, use:

```bash
sudo dpkg -i ./gpt-voice_*_amd64.deb
sudo apt-get install -f
```

O pacote instala GPT-Voice em `/opt/GPT-Voice`, registra um inicializador de desktop e ícones e fornece o
Comando `gpt-voice`. Inicie-o no menu do seu aplicativo ou com `gpt-voice`.

Para atualizar, instale o deb mais recente com o mesmo comando `apt install`. Para remover o pacote, use`sudo apt remove gpt-voice`; use `sudo apt purge gpt-voice` se você também deseja que a configuração do pacote seja removida.

## Pacote Linux rpm

Para Fedora, RHEL, CentOS, openSUSE e distribuições similares, use seu gerenciador de pacotes de distribuição para que ele possa resolver
as dependências do pacote. Não use `rpm -i` simples para uma instalação normal.

```bash
# Fedora, RHEL, CentOS, and compatible distributions
sudo dnf install ./gpt-voice-*.x86_64.rpm

# Older CentOS or RHEL systems
sudo yum install ./gpt-voice-*.x86_64.rpm

# openSUSE
sudo zypper install ./gpt-voice-*.x86_64.rpm
```

O pacote rpm instala o mesmo inicializador, ícones e comando `gpt-voice` que o pacote deb. Seu ativo de lançamento é
para sistemas desktop `x86_64`. Em uma instalação mínima do Linux, habilite os repositórios normais de desktop/tempo de execução antes
instalando para que seu gerenciador de pacotes possa obter suas dependências.

Para atualizar, instale o rpm mais recente com o mesmo comando do gerenciador de pacotes. Para removê-lo, use
`sudo dnf remove gpt-voice` no Fedora/RHEL/CentOS ou `sudo zypper remove gpt-voice` no openSUSE.

## Linux AppImage

Use o AppImage quando preferir uma cópia portátil em vez de um pacote de sistema.

1. Baixe `GPT-Voice-*.AppImage`.
2. Torne-o executável e execute-o:

   ```bash
   chmod +x GPT-Voice-*.AppImage
   ./GPT-Voice-*.AppImage
   ```

Em sua primeira inicialização, GPT-Voice registra um inicializador de área de trabalho local e um ícone para seu usuário, quando possível. Para atualizar,
baixe o AppImage mais recente, torne-o executável e execute-o em vez do arquivo antigo.

Para remover uma instalação do AppImage, saia de GPT-Voice, execute o comando de remoção de integração de desktop desse AppImage,
em seguida, exclua o arquivo:

```bash
./GPT-Voice-*.AppImage --remove-linux-appimage-desktop-integration
```

## Dados retidos do Linux

Remover um pacote deb ou rpm, ou excluir um AppImage, não remove suas configurações ou sessão salva do provedor. Eles
permanecer em `~/.config/GPT-Voice`. Exclua esse diretório manualmente apenas quando desejar uma redefinição limpa.

Quando a instalação for concluída, continue com [primeiro uso](../getting-started.md) para conectar um provedor de transcrição e
faça sua primeira gravação.
