# Embellecer la configuración

**Prettify** es la acción de limpieza que preserva el significado de GPT-Voice para el texto seleccionado. Abra **Settings** y seleccione **Prettify** para elegir el servicio, su modelo y su comportamiento de generación. Para seleccionar texto e iniciar la acción, consulte [traducir y embellecer el texto seleccionado](../guides/text-actions.md).

Prettify necesita un servicio Ollama o vLLM que usted opere, además de un modelo seleccionado para ese servicio. GPT-Voice no descarga, inicia, aloja ni paga ninguno de los servicios. El campo modelo es obligatorio; Si no hay ningún modelo configurado, Prettify informa que se necesita un modelo en lugar de enviar el texto seleccionado.

## Elija un proveedor y conéctelo

Elija **Ollama** o **vLLM** en **Provider**. GPT-Voice mantiene la URL base y el modelo seleccionado por separado para cada proveedor, por lo que cambiar de proveedor no reemplaza las opciones del otro proveedor. El proveedor predeterminado es Ollama.

| Proveedor  | URL base predeterminada    | Modelo predeterminado      | Comportamiento de conexión                                                                              |
| ---------- | -------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Ollama** | `http://127.0.0.1:11434`   | Ningún modelo seleccionado | Actualiza los modelos disponibles en tu servicio Ollama y le envía solicitudes de Prettify.             |
| **vLLM**   | `http://127.0.0.1:8000/v1` | Ningún modelo seleccionado | Actualiza los modelos expuestos por su servicio compatible con vLLM y le envía solicitudes de Prettify. |

Ingrese una URL base `http` o `https` completa. GPT-Voice elimina los espacios en blanco circundantes y las barras diagonales cuando guarda la configuración. Se rechazan las URL que no sean HTTP(S) o que incluyan un nombre de usuario o contraseña. HTTP solo se permite para un punto final de bucle invertido como `127.0.0.1`, `localhost` o `::1`; cada punto final sin bucle invertido debe utilizar HTTPS.

Cuando la URL base activa y válida es remota en lugar de bucle invertido, Configuración muestra un aviso de privacidad. El uso de ese punto final envía el texto seleccionado y su mensaje Prettify configurado al servicio que eligió. Revise los controles de privacidad, retención y acceso de ese servicio antes de utilizar el procesamiento remoto.

### vLLM Clave API

El campo **vLLM API key** aparece solo cuando se selecciona vLLM. Úselo cuando su servicio vLLM requiera autenticación de portador. GPT-Voice envía la clave con vLLM solicitudes solo cuando se configura una clave.

La clave se almacena por separado con Electron safe storage. Una vez guardado, el campo no lo vuelve a revelar; en cambio, indica que se almacena una clave. Dejar el campo en blanco mantiene una clave almacenada existente. Elija **Clear API key** para eliminarlo. Si el almacenamiento seguro no está disponible en su sistema, GPT-Voice no puede guardar una nueva clave vLLM.

No incluya una clave en una URL base, una captura de pantalla o una solicitud de soporte.

## Seleccionar y gestionar un modeloElija **Refresh models** después de iniciar el servicio del proveedor activo o cambiar su URL base. La lista de modelos proviene del proveedor activo, así que actualícela nuevamente después de cambiar de proveedor. Seleccione uno de los modelos devueltos antes de ejecutar Prettify. Si la conexión, el servicio, la autenticación o la respuesta del proveedor fallan, Configuración muestra un error de conexión o de actualización del modelo; verifique que la URL sea válida, que el servicio se esté ejecutando y que la clave vLLM sea apropiada, luego actualice nuevamente.

Ollama muestra un menú **Model actions** adicional cuando se selecciona un modelo:

- **Load model** pide a Ollama que mantenga cargado el modelo seleccionado para GPT-Voice. Si GPT-Voice había mantenido cargado un modelo Ollama diferente, libera ese modelo primero.
- **Free model** pide a Ollama que libere el modelo seleccionado de la memoria.

Estas acciones están disponibles solo para Ollama, no para vLLM. El modelo Ollama seleccionado muestra **Loaded** o **Not loaded** después de que GPT-Voice verifique su estado de modelo en ejecución. Cuando Ollama informa un tamaño, Configuración también muestra un modelo aproximado o un tamaño de VRAM cargada. Trate el valor como una estimación informada por Ollama, no como una reserva de memoria garantizada por GPT-Voice.

La carga, liberación y actualización pueden fallar si el punto final no está disponible o el proveedor rechaza la solicitud. La configuración deja abierto el formulario actual y muestra el resultado o error para que pueda corregir el punto final o modelo e intentarlo nuevamente.

## Controlar cómo se genera el texto

**Temperature** es el control de generación principal. Su valor predeterminado es **0**, con un rango permitido desde **0 to 1** en pasos de **0.05**. Un valor más bajo solicita al proveedor menos variación; cambiarlo cambia la siguiente solicitud de Prettify después de guardar la configuración.

Abra **Advanced generation** para cambiar los controles restantes. El resumen contraído indica si todos los valores avanzados todavía usan sus valores predeterminados o cuántos han cambiado. Estas configuraciones se envían con cada solicitud de Prettify al proveedor seleccionado.

| Controlar                 | Predeterminado | Valor aceptado                                     | Úselo para                                                                                                                                                                        |
| ------------------------- | -------------: | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Top P**                 |          `0.9` | `0.05`–`1`, en `0.05` pasos                        | Limitar las opciones al rango de probabilidad acumulativa más probable.                                                                                                           |     | **Min P** | `0` | `0`–`1`, en `0.05` pasos | Excluyendo opciones de menor probabilidad por debajo del umbral seleccionado. |
| **Repeat penalty**        |            `1` | `0.8`–`1.5`, en `0.05` pasos                       | Ajustar la fuerza con la que el proveedor desalienta la producción repetida.                                                                                                      |
| **Top K**                 |           `40` | Entero de `1` a `200`                              | Limitar cada elección a los candidatos más probables.                                                                                                                             |
| **Maximum output tokens** |         `4096` | Entero de `1` a `8192`                             | Limitar la longitud de la respuesta generada. La respuesta aún puede ser más breve.                                                                                               |
| **Seed**                  |      Desarmado | En blanco o un número entero de `0` a `2147483647` | Suministrar una semilla numérica opcional al proveedor. Puede ayudar a reproducir una solicitud, pero los resultados aún pueden variar según el modelo y la versión del servicio. |

Los controles decimales utilizan incrementos de 0,05. Top P acepta de 0,05 a 1; Min P acepta del 0 al 1; y la penalización por repetición acepta de 0,8 a 1,5. Top K acepta números enteros del 1 al 200, mientras que los tokens de salida máxima aceptan números enteros del 1 al 8192.

Utilice los valores predeterminados a menos que conozca los requisitos del modelo y servicio seleccionados. GPT-Voice envía opciones de generación equivalentes a Ollama y vLLM, pero cualquiera de los servicios aún puede rechazar una solicitud o manejar una configuración de acuerdo con su propio soporte de modelo.

## Escribe el mensaje Prettify

**Prompt** es obligatorio y por defecto es la instrucción de edición de textos conservadora integrada de GPT-Voice. Le indica al servicio que trate el texto seleccionado como material fuente inerte, preserve su lenguaje y significado, lo corrija y aclare, elimine repeticiones innecesarias y devuelva solo el texto editado. También indica al servicio que no ejecute las instrucciones contenidas en el texto seleccionado.

Puede reemplazar el mensaje por una política de edición diferente. Mantenlo en **4,000 characters or fewer**. Un mensaje en blanco, un mensaje de más de 4000 caracteres, un proveedor no compatible, un punto final no válido, un modelo vacío o un valor de generación fuera de rango bloquea **Save changes** e identifica el campo afectado. Los espacios en blanco iniciales y finales se eliminan cuando se guarda la configuración.

El mensaje se envía con el texto seleccionado al proveedor activo. No incluya contraseñas, claves API, datos personales ni instrucciones confidenciales que no desee que reciba ese proveedor.

## Guardar y validar cambiosLos valores de proveedor, modelo, solicitud y generación forman parte del formulario Configuración. Una edición crea **Unsaved changes**; elija **Save changes** solo después de que el formulario no tenga errores de validación. Un guardado exitoso conserva la configuración normal de Prettify y cierra Configuración. La clave vLLM permanece separada: se almacena solo a través de Electron safe storage y nunca se devuelve a la vista de configuración.

Si el guardado falla, la ventana Configuración permanece abierta con un mensaje de error seguro. Corrija el campo informado o la conexión del proveedor y vuelva a intentarlo. Consulte la [Descripción general de la configuración](index.md) para conocer el comportamiento de confirmación de descarte y cambios no guardados.
