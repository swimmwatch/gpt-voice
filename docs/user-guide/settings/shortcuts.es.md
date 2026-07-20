# Configuración de acceso directo

GPT-Voice utiliza atajos globales, por lo que pueden funcionar mientras estás en otra aplicación. Abra **Settings** y elija **Shortcuts** para verlos o cambiarlos.

| Acción                                | Acceso directo predeterminado | Cuando funciona                                                                                                                           |
| ------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Start, pause, or resume recording** | `F9`                          | Comienza a grabar cuando está inactivo, pausa una grabación activa o reanuda una grabación en pausa.                                      |
| **Stop recording**                    | `F10`                         | Detiene una grabación o una grabación en pausa y comienza la transcripción.                                                               |
| **Cancel**                            | `Escape`                      | Cancela una grabación activa. Cuando no hay ninguna grabación activa, cancela una solicitud de Prettify en ejecución.                     |
| **Translate selected text**           | `F11`                         | Traduce el texto seleccionado cuando la traducción está habilitada y no hay ninguna grabación u otra acción de texto seleccionado activa. |
| **Prettify selected text**            | `F12`                         | Embellece el texto seleccionado cuando Prettify está habilitado y no hay ninguna grabación u otra acción de texto seleccionado activa.    |
| **Retry transcription**               | `Ctrl+F8`                     | Vuelve a intentar la última transcripción reintentable solo cuando GPT-Voice está inactivo.                                               |

El acceso directo de reintento no está disponible hasta que haya una transcripción que se pueda reintentar. Consulte [grabar y transcribir](../guides/transcription.md) para saber cuándo está disponible el reintento y [traducir y embellecer el texto seleccionado](../guides/text-actions.md) para los flujos de trabajo de texto seleccionado.

## Cambiar un atajo

1. Seleccione **Change** en la fila de la acción.
2. En el cuadro de diálogo de captura, presione la combinación de teclas completa que desea utilizar.
3. Verifique la combinación que se muestra en el cuadro de diálogo, luego elija **Apply**. Elija **Cancel** para dejar el acceso directo actual sin cambios.

GPT-Voice suspende temporalmente todos sus accesos directos globales mientras el cuadro de diálogo de captura está abierto, luego los registra nuevamente cuando los aplica o cancela. Presione una tecla que no sea modificadora como parte de la combinación; presionar solo `Ctrl`, `Alt`, `Shift`, o la tecla de comando de la plataforma no crea un acceso directo.

##Evitar conflictos

Utilice un atajo diferente para cada acción GPT-Voice y elija combinaciones que no choquen con su sistema operativo u otro software. GPT-Voice rechaza asignaciones GPT-Voice conflictivas. Una clave no modificada entra en conflicto con la misma clave base incluso si la otra asignación incluye modificadores, así que no empareje, por ejemplo, F9 con Ctrl+F9.

Si no se puede registrar una nueva asignación, GPT-Voice mantiene el acceso directo actual y muestra el motivo. En macOS, una tecla Comando capturada se representa como `Command`; en otras plataformas compatibles, se utiliza la plataforma equivalente.## Activar o desactivar acciones de texto seleccionado

Las filas **Translate** y **Prettify** tienen cada una un interruptor de habilitación. Ambos están habilitados de forma predeterminada. Apague un interruptor para evitar que esa acción se ejecute incluso si se presiona su acceso directo; actívelo para que el acceso directo configurado esté disponible nuevamente cuando se cumplan las condiciones normales de la acción.

Estos interruptores son parte del formulario de Configuración, así que elija **Save changes** después de cambiarlos. Cambiar un atajo a través del cuadro de diálogo de captura aplica ese atajo de forma independiente; use el indicador de cambios no guardados en la descripción general de Configuración para distinguir las ediciones de formulario pendientes de un acceso directo ya aplicado.
