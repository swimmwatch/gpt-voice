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

## Guías por sistema operativo

Elija su sistema operativo para ver los pasos detallados de instalación, actualización y eliminación.

- [Windows](install/windows.md)

- [Linux](install/linux.md)

- [macOS](install/macos.md)

Cuando termine la instalación, continúe con el [primer uso](getting-started.md) para conectar un proveedor de transcripción y hacer la primera grabación.
