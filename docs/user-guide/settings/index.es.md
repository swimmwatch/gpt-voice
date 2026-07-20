# Descripción general de la configuración

Abra **Settings** desde el menú de la bandeja GPT-Voice. La ventana Configuración se abre en **Shortcuts** y tiene cuatro secciones:

| Sección                     | Úselo para                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Shortcuts**               | Elija los atajos globales para grabar, detener, cancelar, traducir, Prettify y volver a intentar una transcripción.                        |
| **[Prettify](prettify.md)** | Elija el proveedor de procesamiento de texto Ollama o vLLM y configure su modelo y comportamiento de generación.                           |
| **[Browser](browser.md)**   | Configure la identidad del navegador y el comportamiento en segundo plano que GPT-Voice utiliza para sus servicios basados ​​en navegador. |
| **[Network](network.md)**   | Configure el proxy utilizado por esos servicios basados ​​en navegador.                                                                    |

Los botones de sección permanecen disponibles en ventanas estrechas como íconos con etiquetas accesibles. Seleccione una sección para cambiar su configuración; cada página describe sus propios campos y requisitos previos.

## Guardar cambios

Las configuraciones se cargan desde la configuración guardada de la aplicación cuando se abre la ventana. Cambiar un valor marca que el formulario tiene **Unsaved changes**. El botón **Save changes** está disponible solo después de que se realiza al menos un cambio y todos los valores de campo actuales son válidos. Permanece deshabilitado mientras se guarda GPT-Voice.

Cuando un valor no cumple con sus requisitos, el campo afectado muestra un mensaje de validación y se bloquea el guardado hasta que lo corrija. Si una operación de guardado falla, la Configuración permanece abierta y muestra un mensaje de error para que pueda corregir el problema o intentarlo nuevamente. Un guardado exitoso actualiza la configuración guardada y cierra la ventana Configuración.

## Cerrar sin perder el trabajo por accidente

Al cerrar Configuración sin cambios no guardados, se cierra inmediatamente. Si hay cambios no guardados, GPT-Voice le pregunta si desea descartarlos. Elija **Keep editing** para volver al formulario, o **Discard changes** para cerrar Configuración sin guardar las ediciones pendientes. Mientras se guarda un archivo, se bloquea el cierre de Configuración hasta que finalice la operación.

Esta confirmación se aplica al formulario de configuración. Capturar un nuevo atajo global es una acción separada: GPT-Voice suspende temporalmente los atajos globales mientras escucha la combinación de teclas, luego los reanuda cuando esa captura finaliza o se cancela.
