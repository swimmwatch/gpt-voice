# Instalar, actualizar o eliminar GPT-Voice

GPT-Voice tiene versiones listas para ejecutarse para Windows y Linux. No necesita Node.js, npm, un modelo local, CUDA o
Whisper se instala por separado.

Descargue el paquete para su computadora desde [GitHub Releases](https://github.com/swimmwatch/gpt-voice/releases).
Cada versión también incluye archivos `SHA256SUMS-*.txt` específicos de la plataforma. Para verificar una descarga, compare el valor SHA-256
informado por la herramienta de suma de verificación de su sistema operativo con la entrada del recurso de versión que descargó.

> Las versiones de macOS se pausan mientras se prepara la firma y la certificación notarial del ID del desarrollador. No instales un DMG no oficial
> como GPT-Voice; No hay ningún paquete de macOS compatible en las versiones actuales.

## Elija un recurso de lanzamiento

| Plataforma                 | Liberar activo           | Úselo cuando                                                            |
| -------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| Ventanas                   | `GPT-Voice Setup *.exe`  | Quiere una instalación normal de Windows.                               |
| Linux de la familia Debian | `gpt-voice_*_amd64.deb`  | Utiliza Ubuntu, Debian, Linux Mint, Pop!_OS o una distribución similar. |
| Linux de la familia RPM    | `gpt-voice-*.x86_64.rpm` | Utiliza Fedora, RHEL, CentOS, openSUSE o una distribución similar.      |
| Linux                      | `GPT-Voice-*.AppImage`   | Quiere una compilación portátil sin instalar un paquete de sistema.     |

## ventanas

1. Descargue `GPT-Voice Setup *.exe` de la última versión y ábralo.
2. Elija una ubicación de instalación si se le solicita.
3. Mantenga habilitados los accesos directos del escritorio y del menú Inicio a menos que prefiera iniciar la aplicación manualmente.
4. Complete el instalador, luego abra **GPT-Voice** desde el menú Inicio, el acceso directo del escritorio o la pantalla final del instalador.

El paquete de Windows es un instalador de NSIS. Instala GPT-Voice, su tiempo de ejecución de navegador incluido, íconos, accesos directos y un
entrada del desinstalador en la configuración de Windows.

### Actualizar o eliminar en Windows

Para actualizar, descargue el `GPT-Voice Setup *.exe` más nuevo y ejecútelo sobre la instalación existente.

Para eliminar la aplicación:

1. Abra **Settings** > **Apps** > **Installed apps**.
2. Busque **GPT-Voice**.
3. Seleccione **Uninstall**.

Al eliminar la aplicación, se eliminan los archivos instalados y los accesos directos, pero se mantienen y guardan deliberadamente la configuración local.
sesión de proveedor en `%APPDATA%\GPT-Voice`. Esto permite que una reinstalación los reutilice. Elimine esa carpeta manualmente sólo cuando
También quiero eliminar esos datos locales.

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

Cuando se complete la instalación, continúe con [primer uso](getting-started.md) para conectar un proveedor de transcripción y
Haz tu primera grabación.
