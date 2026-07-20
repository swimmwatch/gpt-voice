# Privacidad y datos

GPT-Voice maneja la voz, el texto seleccionado, las credenciales y la configuración del navegador. Esta página explica las rutas de datos actuales.
y los controles disponibles para eliminar datos. No reemplaza la política de privacidad ni los términos de ningún servicio que elija.
uso.

## Flujos de datos

GPT-Voice envía datos fuera de tu computadora solo cuando usas una función respaldada por un servicio externo:

| Característica                    | Datos enviados                                                   | Destino                                             |
| --------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| Transcripción con **ChatGPT Web** | La grabación preparada                                           | ChatGPT a través de tu sesión de navegador iniciada |
| Transcripción con **OpenAI API**  | Las opciones de grabación preparada y transcripción configuradas | Punto final de transcripciones de audio de OpenAI   |
| **Translate**                     | El texto seleccionado                                            | Google Translate                                    |
| **Prettify**                      | El texto seleccionado y su mensaje Prettify configurado          | Su punto final Ollama o vLLM configurado            |

Utilice cuentas y puntos finales en los que confíe y revise sus términos de manejo de datos. Un punto final de bucle invertido local Ollama o vLLM
mantiene la solicitud en la máquina que ejecuta ese servicio; un punto final remoto recibe el texto. Utilice HTTPS para un
Punto final Prettify sin bucle invertido. Los servicios basados ​​en navegador pueden utilizar el proxy configurado en [Configuración de red](settings/network.md).

GPT-Voice escribe resultados exitosos de transcripción, traducción y Prettify en el portapapeles del sistema. El operativo
el sistema y otras aplicaciones con acceso al portapapeles pueden retener o leer ese valor; borrarlo o reemplazarlo después de pegar
salida sensible.

## Datos locales y memoria temporal

| Datos                                   | Dónde y cuánto tiempo se conserva                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Historial de transcripción exitosa      | Datos SQLite locales en `gpt-voice.sqlite3`, con la hora de la solicitud, el ID y el nombre del proveedor y el texto de la transcripción. No almacena el audio grabado.                                |
| Grabación reintentable                  | El audio preparado más reciente se conserva únicamente en la memoria de la aplicación en ejecución después de una transcripción fallida. Iniciar una nueva grabación o reiniciar GPT-Voice la elimina. |     | Embellecer la caché de resultados | Se guardan en la memoria hasta 20 resultados durante un máximo de 60 segundos. El contexto de la caché depende del texto seleccionado, el mensaje y la configuración del proveedor; se elimina cuando GPT-Voice sale. |
| Configuración e identidad del navegador | Almacenado en los datos de la aplicación local de GPT-Voice y utilizado para lanzamientos posteriores.                                                                                                 |
| ChatGPT Web autenticación               | Datos de autenticación y sesión del navegador local. Utilice el control del proveedor para borrarlo.                                                                                                   |

Las acciones de texto seleccionado leen y reemplazan temporalmente el contenido del portapapeles mientras recopilan una selección. Si la traducción o
Prettify falla o se cancela, GPT-Voice restaura el valor del portapapeles que capturó antes de la acción. En caso de éxito, el
El resultado permanece en el portapapeles para que puedas pegarlo.

## Credenciales y calificaciones de cifrado

Las claves OpenAI API, las claves API vLLM y las contraseñas de proxy HTTP/HTTPS se almacenan a través de Electron safe storage cuando eso
La protección está disponible. GPT-Voice no devuelve esos valores guardados a sus vistas de configuración. Si el almacenamiento seguro es
no disponible, GPT-Voice no puede guardar un nuevo secreto a través de ese control.

Esta no es una afirmación general de cifrado para cada archivo en el directorio de datos de la aplicación. En particular, la transcripción
El historial, la configuración normal y los datos de la sesión ChatGPT Web tienen su propio comportamiento de almacenamiento local. No comparta claves API,
contraseñas de proxy, información de sesión, texto dictado o capturas de pantalla que los contengan.

## Eliminar o restablecer datos

Elija el control más estrecho que satisfaga sus necesidades:

1. En la ventana Historial, use **Clear history** para eliminar permanentemente todas las entradas de transcripción guardadas. Ver
   [historial y bandeja](guides/history-and-tray.md).
2. En los controles del proveedor de transcripción, utilice **Clear session** para ChatGPT Web o **Clear API key** para OpenAI API.
   Consulte [configuración del proveedor](settings/providers.md).
3. Utilice el control **Clear API key** en [Configuración de Prettify](settings/prettify.md) y el control de contraseña **Clear**.
   en [Configuración de red](settings/network.md), cuando corresponda.
4. Reemplace o borre el portapapeles del sistema por separado si contiene resultados que ya no desea que estén disponibles para pegar.
5. Para un reinicio local completo, salga de GPT-Voice de la bandeja y elimine el directorio de datos de aplicación retenido:
   `%APPDATA%\GPT-Voice` en Windows o `~/.config/GPT-Voice` en Linux. Esto elimina las aplicaciones locales administradas.
   configuración, historial y datos del proveedor guardados, y requiere configuración nuevamente después de reinstalar o reiniciar.

La eliminación de datos locales es irreversible. La desinstalación de la aplicación por sí sola conserva intencionalmente esos directorios; ver
[instalar, actualizar o eliminar](install.md) para conocer el comportamiento de desinstalación específico de la plataforma.

## Guías relacionadas

- [Grabar y transcribir](guides/transcription.md) explica el audio reintentable temporal y el envío del proveedor.- [Traducir y embellecer el texto seleccionado](guides/text-actions.md) explica la restauración del portapapeles y las acciones de texto remotas.
- [Elegir y administrar un proveedor de transcripción](guides/providers.md) explica las cuentas y sesiones del proveedor.
