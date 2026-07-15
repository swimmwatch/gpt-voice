# Historial de transcripción y bandeja.

GPT-Voice mantiene un historial local de transcripciones exitosas para que puedas reutilizar un resultado después de que haya salido del portapapeles.
La bandeja proporciona acceso a la aplicación cuando su ventana principal está oculta.

## Reutilizar el historial de transcripción

Abra el menú de la bandeja y elija **History**. Cada transcripción exitosa se almacena localmente con su hora de solicitud,
nombre del proveedor y texto. El historial se almacena en los datos SQLite locales de la aplicación; no almacena lo grabado
audio. Debido a que las entradas pueden contener texto dictado confidencial, trate el historial como lo haría con cualquier otro documento local.

Las entradas más recientes aparecen primero. El historial se carga progresivamente a medida que se desplaza, por lo que no es necesario cargar un historial largo
una solicitud. La ventana muestra mensajes de error de carga, reintento y seguridad si no puede recuperar la página siguiente.

Para reutilizar una entrada, seleccione su tarjeta de texto. GPT-Voice copia el texto almacenado de esa entrada al portapapeles del sistema y brevemente
muestra **Copied**. No vuelve a enviar el texto para su transcripción. Si la copia falla o ya se ha realizado una entrada
eliminado, la ventana del historial informa el error en lugar de cambiar el portapapeles.

## Borrar historial local

Utilice **Clear history** en la ventana Historial y confirme el cuadro de diálogo para eliminar todas las entradas de transcripción guardadas. esto
la acción aclara la historia local; no se puede deshacer desde GPT-Voice. Nuevas transcripciones exitosas crean nuevas entradas
después.

Si desea eliminar todos los datos retenidos de la aplicación como parte de la desinstalación de GPT-Voice, siga las instrucciones específicas de la plataforma.
instrucciones en [instalar, actualizar o eliminar](../install.md).

## Usa la bandeja

Cerrar la ventana principal GPT-Voice la oculta en lugar de salir de la aplicación. La aplicación continúa ejecutándose en el
bandeja del sistema, por lo que sus accesos directos globales configurados permanecen disponibles. Seleccione el icono de la bandeja para enfocar la ventana principal visible
o mostrarlo si está oculto.

El menú de la bandeja proporciona estas acciones:

| Acción del menú    | Resultado                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| **Show GPT-Voice** | Muestra y enfoca la ventana principal, o la crea si es necesario.                                       |
| **Settings**       | Abre la ventana Configuración.                                                                          |
| **History**        | Abre el historial de transcripción local.                                                               |
| **About**          | Abre la ventana Acerca de.                                                                              |
| **Quit**           | Sale de GPT-Voice. Úselo cuando desee detener la aplicación en lugar de simplemente ocultar su ventana. |

El icono de la bandeja refleja la actividad actual: inactiva, grabación, pausada, procesamiento de transcripción o Prettify. es unindicador y punto de navegación; Los controles de grabación permanecen disponibles a través del Command Dock y su configuración
atajos.
