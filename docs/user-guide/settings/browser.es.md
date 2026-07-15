# Configuración del navegador

GPT-Voice utiliza CloakBrowser para servicios basados en navegador como ChatGPT Web y traducción de texto seleccionado. Abra **Settings** y seleccione **Browser** para establecer el comportamiento y los valores de identidad utilizados cuando GPT-Voice crea esos contextos de navegador. Configure un proxy en [Configuración de red](network.md).

## Comportamiento del navegador

| Configuración          | Predeterminado | Valores disponibles        | Efecto                                                                                           |
| ---------------------- | -------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| **Humanize input**     | Habilitado     | Habilitado o deshabilitado | Pasa la configuración de entrada Humanizar a CloakBrowser.                                       |
| **Human preset**       | **Careful**    | **Default** o **Careful**  | Elige el preajuste de humanización CloakBrowser.                                                 |
| **Background browser** | **Hidden**     | **Hidden** o **Visible**   | Controla si el navegador en segundo plano persistente de GPT-Voice no tiene cabeza o se muestra. |

La configuración **Background browser** se aplica al navegador en segundo plano persistente. Una ventana de inicio de sesión ChatGPT Web siempre está visible para que puedas completar la autenticación. Elija **Visible** cuando necesite observar el navegador en segundo plano; de lo contrario, deje seleccionado el modo predeterminado **Hidden**.

## Identidad del navegador

Abra **Identity** para ver o cambiar los valores que GPT-Voice pasa al contexto del navegador.

| Configuración        | Predeterminado                                                   | Requisito y acción                                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fingerprint seed** | Semilla numérica generada por GPT-Voice                          | Sólo dígitos requeridos. Elija **Reset** para generar una nueva semilla numérica de cinco dígitos.                                                                                                                          |
| **Locale**           | `en-US`                                                          | Seleccione una de las configuraciones regionales del navegador admitidas: `en-US`, `en-GB`, `ru-RU`, `uk-UA`, `be-BY`, `de-DE`, `fr-FR`, `es-ES`, `it-IT`, `pt-BR`, `pl-PL`, `tr-TR`, `ja-JP`, `ko-KR`, `zh-CN`, o `zh-TW`. |
| **Timezone**         | La zona horaria de su sistema, o `UTC` cuando no esté disponible | Seleccione una zona horaria compatible con la IANA.                                                                                                                                                                         | Se requieren semilla de huellas dactilares, ubicación y zona horaria. La configuración rechaza una semilla que contenga algo más que dígitos, una configuración regional que no sea una configuración regional BCP 47 válida o una zona horaria que no sea una zona horaria válida de IANA. GPT-Voice elimina los espacios en blanco circundantes cuando guarda estos valores. |

### Proxy GeoIP controla la configuración regional y la zona horaria

Cuando el proxy está habilitado con **GeoIP** en [Configuración de red](network.md), el proxy determina la configuración regional y la zona horaria del navegador. GPT-Voice desactiva esos dos campos en **Identity** y muestra el mensaje **Proxy GeoIP controls locale and timezone**. La configuración regional y la zona horaria guardadas permanecen disponibles si luego desactivas GeoIP, pero no se envían a un contexto de navegador mientras el proxy activo GeoIP sea propietario de ellas.

## Guardar cambios

La configuración del navegador es parte del formulario de Configuración. Cambiar un valor crea **Unsaved changes**; elija **Save changes** después de que la validación sea exitosa. La configuración normal del navegador se almacena en la configuración local de GPT-Voice y se utiliza la próxima vez que GPT-Voice cree el contexto del navegador aplicable. Consulte la [Descripción general de la configuración](index.md) para conocer los errores de guardado y el comportamiento de confirmación de descarte.
