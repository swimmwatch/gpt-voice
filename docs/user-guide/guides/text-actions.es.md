# Traducir y embellecer el texto seleccionado

GPT-Voice puede actuar sobre el texto seleccionado en otra aplicación. **Translate** envía la selección a Google Translate en el
idioma de destino que usted elija. **Prettify** lo envía a su proveedor de procesamiento de texto configurado para mejorar el texto.
según su indicación. Ninguna acción se pega en la otra aplicación: si tiene éxito, copie el resultado del sistema
portapapeles y pégalo donde lo necesites.

## Habilita una acción y elige su acceso directo

Abra **Settings** y seleccione **Shortcuts**. Las filas **Translate** y **Prettify** tienen cada una un interruptor de habilitación y un
**Change** control para su acceso directo global. Ambas acciones están habilitadas de forma predeterminada; sus atajos predeterminados son `F11`
para Traducir y `F12` para Embellecer. Guarde la configuración después de realizar un cambio.

Elija un acceso directo que no entre en conflicto con otro acceso directo GPT-Voice o con el software que utiliza. Una acción deshabilitada
no se ejecuta cuando se presiona su acceso directo. Una acción también espera hasta que finalice una grabación activa y se ejecuta GPT-Voice.
sólo una acción de texto seleccionado a la vez.

## Traducir una selección

1. En la aplicación que contiene el texto, seleccione el texto que desea traducir.
2. En GPT-Voice Command Dock, elija **Target language**: inglés, ruso, ucraniano o bielorruso.
3. Presione el acceso directo de Traducir habilitado (por defecto, `F11`).
4. Espere la notificación de éxito y luego pegue el texto traducido desde su portapapeles.

GPT-Voice copia el texto seleccionado utilizando la acción de copia normal del sistema operativo y luego lo envía a Google.
Traducir. La traducción es un servicio externo: el texto seleccionado se envía a Google Translate, así que no uses esta acción
para mensajes de texto no se le permite compartir con ese servicio.

Si no hay ningún texto seleccionado, la copia no se puede automatizar o el servicio no puede devolver un resultado, GPT-Voice informa un
mensaje de error seguro y restaura el valor del portapapeles que estaba presente antes de la acción. En Linux, también puede usar el
portapapeles de selección cuando falla la acción de copia normal. Una traducción exitosa reemplaza el portapapeles del sistema con el
resultado traducido.

## Embellecer una selección

Antes de usar Prettify, abra **Settings** y seleccione **Prettify**. Elija **Ollama** o **vLLM**, configure el proveedor
dirección y modelo, y guarde una configuración válida. vLLM también puede requerir una clave API.

1. Seleccione hasta 16.000 caracteres en la aplicación que está editando.
2. Presione el acceso directo de Prettify habilitado (por defecto, `F12`).
3. Espere la notificación **Text prettified**, luego pegue el resultado desde su portapapeles.

Ollama y vLLM son ​​dependencias operadas por el usuario: GPT-Voice no instala, aloja ni administra ninguno de los servicios. un local
El punto final de loopback mantiene la solicitud en la máquina que ejecuta ese servicio. Un punto final remoto recibe el texto seleccionado;
utilice un proveedor de confianza, siga su política de manejo de datos y utilice HTTPS para un punto final no local.Si no se selecciona ningún texto, la selección supera los 16.000 caracteres, no se puede contactar al proveedor configurado o
no devuelve ningún resultado utilizable, GPT-Voice informa el error y restaura el contenido anterior del portapapeles. mientras que un embellecer
La solicitud se está ejecutando, el acceso directo de cancelación configurado (predeterminado `Escape`) la cancela y restaura ese valor del portapapeles.

## Portapapeles y acciones concurrentes

Translation y Prettify se excluyen intencionalmente entre sí. Iniciar uno mientras el otro ya está funcionando salta
la nueva solicitud, así que espere el estado o la notificación antes de volver a intentarlo. Si tiene éxito, el resultado reemplaza el
portapapeles; en una solicitud fallida o cancelada, GPT-Voice restaura el valor del portapapeles que capturó antes de leer el
selección. Compruebe siempre el resultado pegado, especialmente cuando el texto fuente contiene nombres, códigos u otros valores exactos.
