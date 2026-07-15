# Solución de problemas

Comience con el mensaje de estado visible y la función que estaba utilizando. No pegue claves API, contraseñas de proxy,
ChatGPT datos de sesión, texto dictado, texto seleccionado o capturas de pantalla que los contengan en una solicitud de soporte. Un útil
El informe seguro incluye la versión de GPT-Voice, el sistema operativo, el tipo de paquete, la característica, el mensaje no confidencial exacto y
pasos que reproducen el problema.

## El micrófono no puede iniciarse

Si el Command Dock muestra **Could not access microphone**:

1. Confirme que haya un micrófono conectado y disponible para otras aplicaciones.
2. Permita que GPT-Voice use el micrófono en los controles de privacidad de su sistema operativo.
3. Cierre otro software que tenga control exclusivo del dispositivo y luego inicie una nueva grabación.
4. Si el dispositivo cambió mientras GPT-Voice estaba abierto, vuelva a conectarlo y reinicie GPT-Voice antes de volver a intentarlo.

No se envía ningún audio hasta que GPT-Voice haya iniciado una grabación y usted la detenga. Para los controles de grabación y el límite de reintentos,
consulte [grabar y transcribir](guides/transcription.md).

## ChatGPT Web sesión desconectada

Si **ChatGPT Web** no es **Connected**, la ventana de inicio de sesión del navegador no finaliza o la sesión ha caducado:

1. Verifique que la computadora pueda acceder a ChatGPT y que la cuenta tenga permiso para utilizar el servicio.
2. Seleccione **Connect** y complete el inicio de sesión en la ventana del navegador GPT-Voice.
3. Si la sesión almacenada ya no es válida, use **Clear session**, confírmela e inicie sesión nuevamente.
4. Si la inicialización o la conexión del navegador aún falla, pruebe temporalmente sin un proxy y luego revise el navegador.
   y configuración de red a continuación.

Borrar una sesión elimina la sesión local guardada de GPT-Voice; no cambia la cuenta o sesiones en otros
navegadores. Consulte [configuración del proveedor](settings/providers.md).

## OpenAI API la transcripción falla

Para **OpenAI API**, verifique que el proveedor esté seleccionado y configurado con su propia clave API válida. Confirma el
facturación, cuota, límites de uso y estado del servicio de la cuenta del proveedor, luego guarde cualquier corrección y vuelva a intentar la versión preparada.
grabación si todavía está disponible. GPT-Voice utiliza el modelo de transcripción fijo `whisper-1`; no hay modelo
selección para reparar para este proveedor.

Deje una clave guardada existente fuera de los informes y capturas de pantalla. Si necesita reemplazarla, ingrese la nueva clave y guárdela; usar
**Clear API key** cuando quieras que GPT-Voice lo olvide. Consulte [configuración del proveedor](settings/providers.md) y
[proveedores](guides/providers.md).

## Prettify no puede contactar con un modelo

Antes de que Prettify pueda procesar el texto seleccionado, su proveedor, punto final y modelo deben ser válidos:

1. En **Settings** > **Prettify**, seleccione el proveedor deseado: Ollama o vLLM.
2. Confirme que el servicio local o remoto se esté ejecutando y sea accesible desde esta computadora.
3. Verifique la dirección del proveedor y el nombre del modelo, luego use **Load model** cuando el modelo seleccionado no esté listo.
4. Para vLLM, proporcione una clave API solo cuando ese punto final la requiera. Para un punto final remoto, use HTTPS y confirmeque se le permite enviar el texto seleccionado allí.
5. Guarde la configuración válida antes de volver a ejecutar el acceso directo.

GPT-Voice no instala ni opera Ollama o vLLM. Consulte [Configuración de embellecer](settings/prettify.md) para el campo
requisitos y [acciones de texto](guides/text-actions.md) para límites de texto seleccionado y cancelación.

## El servicio de proxy o navegador no puede conectarse

ChatGPT Web y Traducción utilizan contextos de navegador GPT-Voice. Si alguno de los servicios funciona sin el proxy pero no con él:

1. Desactive **Proxy enabled** temporalmente y guarde la configuración para aislar el proxy del servicio.
2. Al volver a habilitarlo, use una URL del servidor `http://`, `https://` o `socks5://` accesible y coloque HTTP/HTTPS.
   credenciales en sus campos dedicados.
3. Elimine las credenciales de SOCKS5: CloakBrowser no las admite.
4. Si **GeoIP** está habilitado, recuerde que controla la configuración regional y la zona horaria del navegador. Desactive GeoIP para probar el guardado
   Valores de identidad del navegador directamente.

En caso de un error de ejecución del navegador, primero vuelva a intentarlo después de que la red esté estable y luego pruebe el proxy como se indicó anteriormente. Establecer **Fondo
navegador** to **Visible** temporalmente si necesita observar el contexto del navegador mientras reproduce el problema; restaurar
la configuración habitual **Hidden** después. Consulte [Configuración del navegador](settings/browser.md) y
[Configuración de red](settings/network.md).

## Un acceso directo no se ejecuta

Abre **Settings** > **Shortcuts** y confirma que la acción está habilitada, el acceso directo que se muestra es el que presionas,
y el cambio fue guardado. GPT-Voice rechaza conflictos entre sus propios atajos, pero otra aplicación o el
El sistema operativo aún puede reservar la misma combinación.

Elija un acceso directo diferente, guárdelo y vuelva a intentarlo mientras GPT-Voice está inactivo. Las acciones de texto seleccionado también esperan hasta que
La grabación activa finaliza y Translation y Prettify no pueden ejecutarse al mismo tiempo. Ver
[configuración de acceso directo](settings/shortcuts.md).

## El portapapeles o el texto seleccionado no apareció

Para una transcripción, espere **Copied to clipboard** antes de pegar. Una transcripción fallida no se copia. Para
Traducción o Prettify, seleccione el texto en la aplicación de origen antes de presionar el acceso directo a la acción; Prettify acepta
hasta 16.000 caracteres.

En caso de falla o cancelación, GPT-Voice restaura el valor del portapapeles que capturó antes de la acción del texto seleccionado. un
El resultado exitoso reemplaza el portapapeles. Confirme que la aplicación de origen permite operaciones de copia normales; en Linux,
GPT-Voice también puede usar el portapapeles de selección cuando falla la automatización de copia normal. Ver
[Traducir y embellecer el texto seleccionado](guides/text-actions.md).

## Problema de instalación, actualización o inicio

Descargue solo el paquete que coincida con su plataforma desde la versión oficial de GitHub y compare su valor SHA-256.
con el archivo de suma de comprobación adjunto. Ejecute el instalador de Windows nuevamente para actualizar una instalación existente. En Linux, use
el comando documentado del administrador de paquetes para paquetes deb o rpm, o haga que AppImage sea ejecutable antes de ejecutarlo.No hay ningún paquete de macOS compatible mientras la firma y la certificación notarial están en pausa. Si GPT-Voice no se inicia después de un
instalación o actualización, reinicie la computadora, vuelva a intentar el paquete verificado y verifique que el tiempo de ejecución normal del escritorio
Las dependencias están disponibles. No elimine los datos retenidos de la aplicación como primer paso; contiene configuraciones y guardadas
datos del proveedor. Siga [instalar, actualizar o eliminar](install.md) para conocer el paquete exacto y el procedimiento de eliminación.

## Si el problema persiste

Pruebe la reproducción segura más pequeña: una grabación breve no confidencial, una muestra de texto seleccionado no confidencial o una
verificación de desactivación temporal del proxy. Registre la versión, plataforma, paquete, área de configuración y error visible sin copiar
credenciales o contenido privado. Las guías relacionadas anteriores describen el comportamiento admitido y la recuperación disponible.
controles.
