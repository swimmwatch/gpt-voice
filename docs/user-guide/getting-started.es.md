# Primer uso: conectar un proveedor y transcribir voz

Después de [instalar GPT-Voice](install.md), conecte un proveedor de transcripción, permita el acceso al micrófono y realice una
grabación corta. GPT-Voice copia una transcripción exitosa al portapapeles; no escribe automáticamente en el
aplicación que estaba utilizando.

## 1. Elija un proveedor de transcripción

Abra GPT-Voice y elija **ChatGPT Web** o **OpenAI API** en el selector **Provider** en el Command Dock.

| Proveedor       | Lo que necesitas                                                 | Acción por primera vez                                                                |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **ChatGPT Web** | Una cuenta ChatGPT en la que puedes iniciar sesión.              | Selecciónelo, luego elija **Connect** y complete el inicio de sesión en el navegador. |
| **OpenAI API**  | Tu propia clave OpenAI API y cuota o facturación API disponible. | Selecciónelo, luego elija **Configure** para abrir la configuración del proveedor.    |

La disponibilidad, los límites, la facturación y los términos del proveedor están controlados por la cuenta que utiliza. GPT-Voice no omite
esos límites.

### Conectar ChatGPT Web

1. Seleccione **ChatGPT Web**.
2. Elija **Connect**.
3. Complete el inicio de sesión ChatGPT en la ventana del navegador que se abre.
4. Una vez que ChatGPT esté listo, cierre la ventana de inicio de sesión y regrese a GPT-Voice.

El estado del proveedor cambia a **Connected** cuando la sesión está lista. GPT-Voice guarda la sesión del navegador en tu
datos de la aplicación local e inicia su navegador en segundo plano automáticamente en lanzamientos posteriores. Si la sesión expira, elija
**Connect** nuevamente para iniciar sesión nuevamente.

### Configurar OpenAI API

1. Seleccione **OpenAI API**.
2. Elija **Configure**. También puede utilizar el control de configuración del proveedor al lado del selector de proveedores.
3. Pega tu clave OpenAI API.
4. Opcionalmente, elija un idioma de transcripción, una indicación o una temperatura.
5. Elija **Save**.

El modelo de transcripción está fijado en `whisper-1`. Después de guardar exitosamente, GPT-Voice muestra el proveedor como
**Connected** e informa que el proveedor está configurado. La aplicación almacena la clave API localmente usando Electron
almacenamiento seguro cuando esté disponible; la clave no se muestra nuevamente en la interfaz. OpenAI API la transcripción no utiliza un
navegador.

## 2. Permitir el acceso al micrófono

La primera grabación le pide permiso al micrófono a su sistema operativo. Permita el acceso a GPT-Voice y luego regrese a
el Command Dock. Si se deniega el acceso o no hay micrófono disponible, el estado muestra **Error: No se pudo acceder
micrófono** y no se envía audio. Habilite el permiso en los controles de privacidad de su sistema operativo antes de intentarlo.
otra vez.

## 3. Haz una primera grabación

1. Seleccione un proveedor que muestre **Connected**.
2. Elija **Start recording** o presione el acceso directo de grabación que se muestra (el valor predeterminado es `F9`).3. Di una frase corta. El estado cambia a **Recording**.
3. Elija **Stop recording** (predeterminado `F10`). GPT-Voice cambia el estado a **Transcribing** mientras envía el
   audio capturado al proveedor seleccionado.
4. Espere a **Copied to clipboard**, luego péguelo en cualquier campo de texto para confirmar el resultado.

También puede pausar, reanudar o cancelar una grabación activa desde el Command Dock. Al cancelar se descarta el activo
grabarlo en lugar de enviarlo para su transcripción.

## Si la primera transcripción no funciona

- Si no se muestra **Connected**, vuelva a abrir los controles del proveedor y complete el inicio de sesión o guarde una clave API válida. Para
  ChatGPT Web, el estado puede indicar que la inicialización del navegador falló o que la sesión expiró.
- Si el estado informa un error de micrófono, permita que GPT-Voice use su micrófono en el sistema operativo y realice una
  nueva grabación.
- Si el estado informa **Transcription failed** o **Transcription error**, verifique la cuenta del proveedor seleccionado,
  conexión y límites, luego inténtelo nuevamente. Una transcripción fallida no se copia al portapapeles.

Las siguientes páginas de la guía cubren con más detalle los controles de grabación, el comportamiento del proveedor, los accesos directos y la solución de problemas. Para
ahora, un proveedor **Connected** y un resultado **Copied to clipboard** confirman que la ruta básica está funcionando.
