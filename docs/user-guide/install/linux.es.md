# Linux

## paquete deb de Linux

Para Ubuntu, Debian, Linux Mint, Pop!_OS y distribuciones similares, instale el paquete descargado:

```bash
sudo apt install ./gpt-voice_*_amd64.deb
```

Si su sistema no puede instalar una deb local a través de `apt`, use:

```bash
sudo dpkg -i ./gpt-voice_*_amd64.deb
sudo apt-get install -f
```

El paquete instala GPT-Voice en `/opt/GPT-Voice`, registra un iniciador de escritorio e íconos y proporciona la
Comando `gpt-voice`. Ejecútalo desde el menú de tu aplicación o con `gpt-voice`.

Para actualizar, instale el deb más nuevo con el mismo comando `apt install`. Para quitar el paquete, utilice`sudo apt remove gpt-voice`; use `sudo apt purge gpt-voice` si también desea eliminar la configuración del paquete.

## paquete rpm de Linux

Para Fedora, RHEL, CentOS, openSUSE y distribuciones similares, use su administrador de paquetes de distribución para que pueda resolver
las dependencias del paquete. No utilice `rpm -i` simple para una instalación normal.

```bash
# Fedora, RHEL, CentOS, and compatible distributions
sudo dnf install ./gpt-voice-*.x86_64.rpm

# Older CentOS or RHEL systems
sudo yum install ./gpt-voice-*.x86_64.rpm

# openSUSE
sudo zypper install ./gpt-voice-*.x86_64.rpm
```

El paquete rpm instala el mismo iniciador, iconos y comando `gpt-voice` que el paquete deb. Su activo de lanzamiento es
para sistemas de escritorio `x86_64`. En una instalación mínima de Linux, habilite los repositorios de escritorio/tiempo de ejecución normales antes
instalando para que su administrador de paquetes pueda obtener sus dependencias.

Para actualizar, instale el rpm más nuevo con el mismo comando del administrador de paquetes. Para eliminarlo, utilice
`sudo dnf remove gpt-voice` en Fedora/RHEL/CentOS o `sudo zypper remove gpt-voice` en openSUSE.

## Imagen de aplicación de Linux

Utilice AppImage cuando prefiera una copia portátil en lugar de un paquete del sistema.

1. Descargue `GPT-Voice-*.AppImage`.
2. Hazlo ejecutable y ejecútalo:

   ```bash
   chmod +x GPT-Voice-*.AppImage
   ./GPT-Voice-*.AppImage
   ```

En su primer inicio, GPT-Voice registra un iniciador de escritorio local y un ícono para su usuario cuando sea posible. Para actualizar,
descargue la AppImage más nueva, hágala ejecutable y ejecútela en lugar del archivo anterior.

Para eliminar una instalación de AppImage, salga de GPT-Voice, ejecute el comando de eliminación de integración de escritorio desde esa AppImage,
luego borre el archivo:

```bash
./GPT-Voice-*.AppImage --remove-linux-appimage-desktop-integration
```

## Datos de Linux retenidos

Eliminar un paquete deb o rpm, o eliminar una AppImage, no elimina su configuración ni la sesión guardada del proveedor. ellos
permanecer en `~/.config/GPT-Voice`. Elimine ese directorio manualmente solo cuando desee un reinicio limpio.

Cuando se complete la instalación, continúe con [primer uso](../getting-started.md) para conectar un proveedor de transcripción y
Haz tu primera grabación.
