# Configuración del proveedor

Elija el proveedor de transcripción en GPT-Voice Command Dock. Para configurar el proveedor seleccionado actualmente, abra su control **Connect** o **Configure** en el encabezado. El cuadro de diálogo del proveedor muestra solo los controles que se aplican a ese proveedor.

## ChatGPT Web

ChatGPT Web utiliza una sesión de navegador en lugar de una clave API. Su cuadro de diálogo de proveedor muestra si se guarda una sesión.

1. Seleccione **ChatGPT Web** en Command Dock.
2. Abra el cuadro de diálogo de su proveedor y elija **Log in** cuando no se guarde ninguna sesión, o **Log in again** para reemplazar una sesión guardada.
3. Complete el inicio de sesión en la ventana del navegador GPT-Voice y luego regrese a Command Dock cuando el proveedor muestre **Connected**.

Utilice **Clear session** cuando desee que GPT-Voice olvide la autenticación ChatGPT Web guardada. GPT-Voice solicita confirmación antes de borrarlo. Al borrar la sesión se desconecta este proveedor; inicie sesión nuevamente antes de usarlo para la transcripción.

Para obtener detalles sobre la propiedad de la cuenta, la sesión del navegador y el límite del proveedor, consulte [proveedores](../guides/providers.md).

## OpenAI API

Seleccione **OpenAI API** y abra el cuadro de diálogo de su proveedor para configurar estos campos. Utilice su propia clave y cuenta OpenAI API; GPT-Voice no proporciona una clave, créditos ni acceso a los servicios OpenAI.

| Campo           | Comportamiento actual                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API key**     | Ingrese una nueva clave para guardarla. El campo está en blanco cuando se vuelve a abrir, incluso si se almacena una clave, y un guardado en blanco no reemplaza esa clave almacenada. |
| **Model**       | `whisper-1` es el único modelo de transcripción disponible. Se muestra como un campo de solo lectura.                                                                                  |
| **Language**    | Elija detección automática (la opción predeterminada), inglés, ruso, ucraniano o bielorruso.                                                                                           |
| **Prompt**      | Guía de transcripción opcional. El valor predeterminado está vacío; Los espacios en blanco iniciales y finales se eliminan cuando se guardan.                                          |
| **Temperature** | Controla la variación de la transcripción de 0 a 1. El valor predeterminado es 0; el control cambia en pasos de 0,05.                                                                  |

Elija **Save** para validar y almacenar los cambios. Un guardado exitoso cierra el cuadro de diálogo. Se rechazan los valores de modelo, idioma o temperatura no válidos; Si falla el guardado, el cuadro de diálogo muestra un mensaje de error seguro y permanece abierto.

## Credenciales almacenadas y autenticación de limpieza

GPT-Voice almacena una clave OpenAI API solo a través de Electron safe storage. La clave en sí no se muestra en el cuadro de diálogo; en cambio, el cuadro de diálogo indica que se almacena una clave API. Si el almacenamiento seguro no está disponible, GPT-Voice no puede guardar una clave nueva.Utilice **Clear API key** y confirme el cuadro de diálogo para eliminar la clave almacenada manteniendo las otras configuraciones OpenAI API. El botón está disponible sólo cuando se almacena una clave. Debe ingresar y guardar una nueva clave antes de que OpenAI API pueda transcribir nuevamente.

Las credenciales del proveedor y el uso del servicio permanecen según los términos, la facturación, las cuotas y la política de privacidad de la cuenta del proveedor. No pegue claves en solicitudes de soporte, capturas de pantalla o documentación.
