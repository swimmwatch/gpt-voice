# Grabar y transcribir

Antes de grabar, conecte un proveedor que muestre **Connected** y permita que GPT-Voice use su micrófono. Ver
[primer uso](../getting-started.md) si no ha completado esa configuración, o revise la [guía del proveedor](providers.md)
para obtener detalles de conexión y cuenta.

## Ciclo de vida de grabación

Inicie una grabación desde Command Dock o con el acceso directo de grabación configurado (el valor predeterminado es `F9`). el estado
cambia de **Ready** a **Recording** una vez que se ha iniciado la captura del micrófono. Durante la grabación, la acción principal es
**Stop recording** (predeterminado `F10`).

| Acción              | Cuando esté disponible                         | ¿Qué pasa?                                                                                                                              |
| ------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Start recording** | GPT-Voice está inactivo.                       | Solicita acceso al micrófono y comienza una nueva captura. Iniciar una nueva captura borra cualquier audio reintentable de la anterior. |
| **Pause**           | Se está grabando una captura.                  | Pausa la captura actual sin enviarla.                                                                                                   |
| **Resume**          | Una captura está en pausa.                     | Continúa la misma captura.                                                                                                              |
| **Stop recording**  | Una captura se está grabando o en pausa.       | Finaliza la captura, prepara el audio y lo envía al proveedor seleccionado.                                                             |
| **Cancel**          | GPT-Voice está iniciando, grabando o en pausa. | Detiene y descarta la captura activa; no se envía para transcripción.                                                                   |

Mientras GPT-Voice se detiene, prepara el audio, transcribe o vuelve a intentarlo, espere a que finalice la operación actual
antes de iniciar otra grabación. El Command Dock muestra un estado de procesamiento durante este tiempo.

## ¿Qué pasa después de parar?

Después de **Stop recording**, GPT-Voice prepara el audio capturado y muestra **Transcribing**. Se envía el preparado
audio al proveedor seleccionado en el Command Dock:

- **ChatGPT Web** envía el audio a través de la sesión del navegador ChatGPT iniciada.
- **OpenAI API** envía el audio al punto final de transcripción de OpenAI utilizando la clave API que configuraste.

La cuenta del proveedor controla la disponibilidad del proveedor, el acceso a la cuenta, la facturación, las cuotas y los términos del servicio.
GPT-Voice no omite esos controles.

Si tiene éxito, GPT-Voice copia el texto devuelto al portapapeles de su sistema, cambia el estado a **Copiado a
portapapeles** y solicita una notificación de éxito. Pega el texto en la aplicación que estabas usando. GPT-Voice tambiénguarda el texto, el nombre del proveedor y la hora de la solicitud en su historial de transcripción local; los controles del historial son
documentado por separado.

## Reintentar una transcripción fallida

Después de que GPT-Voice haya preparado una captura no vacía, mantiene ese audio preparado en la memoria como el reintentable más reciente.
grabación. Si la solicitud de transcripción falla, utilice la acción de reintento de transcripción configurada cuando GPT-Voice esté inactivo para
enviar el mismo audio preparado nuevamente. Al volver a intentarlo, no se vuelve a grabar el micrófono.

Este reintento de copia es deliberadamente temporal:

- Se borra antes de comenzar una nueva grabación.
- No está disponible durante la grabación, el procesamiento o el reintento.
- Se conserva únicamente en la memoria de la aplicación en ejecución; reiniciar GPT-Voice lo elimina.

Reintentar es una forma de repetir un envío fallido después de corregir un problema de conexión, sesión o proveedor. no lo hace
cambiar los límites del proveedor, restaurar una sesión de cuenta vencida o garantizar que un proveedor aceptará la solicitud.

## Si falla la grabación o transcripción

- **Could not access microphone** significa que GPT-Voice no pudo obtener una transmisión de audio. Verifique el sistema operativo
  permiso de privacidad del micrófono, confirme que hay un micrófono conectado y luego comience una nueva grabación.
- **Transcription failed** significa que el proveedor devolvió un resultado incorrecto. Verifique la cuenta del proveedor, la red,
  disponibilidad del servicio y límites aplicables antes de volver a intentarlo.
- **Transcription error** significa que GPT-Voice no pudo completar la preparación o la solicitud. La notificación de falla y
  El estado Command Dock proporciona el mensaje de error seguro para el usuario; El texto fallido no se copia al portapapeles.
- Si una sesión ChatGPT Web ha caducado, vuelva a conectarla antes de volver a intentarlo. Si falta una clave OpenAI API o se rechaza,
  corríjalo en la configuración del proveedor antes de volver a intentarlo.

Cancelar una grabación activa es diferente a un envío fallido: cancelar descarta la captura antes de que sea
preparada o enviada, por lo que no existe una transcripción reintentable para esa grabación.
