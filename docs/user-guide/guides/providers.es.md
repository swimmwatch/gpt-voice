# Elija y administre un proveedor de transcripción

GPT-Voice utiliza un proveedor de transcripción activo a la vez. Elíjalo en el selector **Provider** en el Command Dock. Al cambiar el selector se cambia qué proveedor recibe la siguiente grabación; no transfiere sesiones, claves API, facturación ni acceso a cuentas entre proveedores.

| Proveedor       | Autenticación                               | Dónde se envía el audio                            |
| --------------- | ------------------------------------------- | -------------------------------------------------- |
| **ChatGPT Web** | Una sesión de navegador ChatGPT iniciada.   | A través de la sesión iniciada ChatGPT.            |
| **OpenAI API**  | Una clave OpenAI API que usted proporciona. | Punto final de transcripciones de audio de OpenAI. |

Utilice únicamente una cuenta que esté autorizado a utilizar. La disponibilidad, la facturación, las cuotas, los límites de uso y los términos del servicio los establece la cuenta y el servicio del proveedor. GPT-Voice no los omite.

## ChatGPT Web

Seleccione **ChatGPT Web**, luego elija **Connect**. GPT-Voice abre una ventana de inicio de sesión del navegador en ChatGPT. Complete el inicio de sesión allí y luego cierre la página de inicio de sesión. GPT-Voice guarda la sesión del navegador resultante localmente e inicia su navegador en segundo plano en inicios posteriores cuando la sesión aún se puede utilizar.

Cuando la sesión está lista, el proveedor muestra **Connected**. Si la sesión expira, GPT-Voice elimina la sesión almacenada inutilizable y debes elegir **Connect** nuevamente. Una solicitud de transcripción también puede actualizar una vez su token de acceso de corta duración; esto no reemplaza un nuevo inicio de sesión cuando la sesión subyacente ya no es válida.

Para cerrar sesión en GPT-Voice, abra la configuración del proveedor y use **Clear authentication**. Esto elimina los datos de sesión del navegador ChatGPT guardados de GPT-Voice y el token de acceso en caché. No administra su cuenta, suscripción ni ninguna sesión realizada por otros navegadores o dispositivos.

## OpenAI API

Seleccione **OpenAI API** y elija **Configure**, o abra el control de configuración del proveedor al lado del selector. Pegue su propia clave API y guarde el formulario. GPT-Voice utiliza el modelo de transcripción fijo `whisper-1`; no permite que este proveedor seleccione otro modelo de transcripción.

La configuración del proveedor también le permite elegir:

- **Language**: detección automática (valor predeterminado), inglés, ruso, ucraniano o bielorruso.
- **Prompt**: orientación opcional enviada con la solicitud de transcripción.
- **Temperature**: un valor de `0` a `1`; el valor predeterminado es `0`.

GPT-Voice almacena la clave API localmente con Electron safe storage cuando esa protección está disponible y nunca muestra la clave guardada en la interfaz. Si el almacenamiento seguro no está disponible, no se puede guardar una nueva clave en lugar de almacenarla sin esa protección. El proveedor OpenAI API no utiliza la ventana de inicio de sesión del navegador.Utilice **Clear authentication** en la configuración del proveedor para eliminar la clave API guardada. Las opciones de transcripción no secreta permanecen disponibles para la siguiente clave que configure, pero el proveedor no se conecta hasta que se guarda nuevamente una clave válida.

## Cambiar o recuperar un proveedor

Puede cambiar de proveedor antes de iniciar una grabación. Confirme que el proveedor recién seleccionado sea **Connected** antes de grabar; una sesión ChatGPT Web configurada y una clave OpenAI API configurada son independientes.

Si la transcripción falla:

1. Verifique que el proveedor seleccionado todavía esté conectado y que su cuenta pueda utilizar la transcripción.
2. Para **ChatGPT Web**, vuelva a conectarse si la sesión expiró o el navegador no pudo inicializarse.
3. Para **OpenAI API**, confirme la clave API, la facturación o la cuota y el estado del servicio del proveedor, luego guarde cualquier corrección necesaria.
4. Regrese a [grabación y transcripción](transcription.md) para volver a intentar la captura preparada más reciente o iniciar una nueva grabación.

La configuración del proveedor afecta las solicitudes futuras. No pueden recuperar una grabación cancelada ni anular errores de acceso, cuota, política o servicio del lado del proveedor.
