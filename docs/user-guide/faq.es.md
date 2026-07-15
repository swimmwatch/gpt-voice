# Preguntas frecuentes

## ¿GPT-Voice transcribe el habla por sí solo?

No. GPT-Voice es una aplicación de escritorio que envía una grabación al proveedor de transcripción que selecciones: ChatGPT Web
a través de su sesión de navegador iniciada, o OpenAI API a través de su propia clave API. Disponibilidad de proveedores, facturación,
las cuotas y los términos están controlados por ese proveedor. Consulte [elegir y administrar un proveedor de transcripción](guides/providers.md).

## ¿Qué sale de mi computadora?

Al detener una grabación, se envía el audio preparado al proveedor de transcripción seleccionado. La traducción envía el texto seleccionado a
Google Translate. Prettify envía el texto seleccionado y su mensaje configurado a su punto final Ollama o vLLM. Ver
[privacidad y datos](privacy.md) para obtener detalles completos sobre el flujo de datos y la retención local.

## ¿GPT-Voice escribe el resultado en mi aplicación?

No. Los resultados exitosos de transcripción, traducción y Prettify se copian al portapapeles del sistema. Pega el resultado
donde lo necesitas. Consulte [grabar y transcribir](guides/transcription.md) y
[Traducir y embellecer el texto seleccionado](guides/text-actions.md).

## ¿Puedo usar GPT-Voice sin una clave OpenAI API?

Sí. ChatGPT Web utiliza una sesión de navegador ChatGPT iniciada en lugar de una clave API. Está separado del OpenAI API
proveedor y los requisitos de su cuenta. Consulte [configuración del proveedor](settings/providers.md).

## ¿Puede GPT-Voice funcionar completamente sin conexión?

No para transcripción o traducción: esas funciones utilizan el servicio remoto seleccionado. Prettify puede usar un local
Ollama o vLLM punto final cuando ejecuta ese servicio en la misma computadora, pero GPT-Voice no instala ni opera el
punto final para usted. Consulte [Configuración de embellecimiento](settings/prettify.md).

## ¿Qué plataformas son compatibles?

Las versiones actuales son compatibles con Windows y Linux a través de los paquetes de instalación de Windows, deb, rpm y AppImage. macos
los comunicados se pausan mientras se preparan la firma y la certificación notarial. Consulte [instalar, actualizar o eliminar](install.md).

## ¿Una actualización o desinstalación borra mi configuración?

No. Las rutas de desinstalación normales retienen intencionalmente datos de aplicaciones locales, incluidas configuraciones y datos guardados del proveedor.
Utilice las instrucciones de eliminación en [privacidad y datos](privacy.md) cuando desee restablecer esos datos deliberadamente.

## ¿Por qué no se ejecutó mi acceso directo o acción de texto seleccionado?

Confirme que la acción está habilitada, su acceso directo está guardado y otra aplicación no ha reservado la misma clave
combinación. Translation y Prettify se ejecutan uno a la vez y esperan hasta que finalice la grabación. Ver
[configuración de accesos directos](settings/shortcuts.md) y [solución de problemas](troubleshooting.md).

## ¿Puedo usar un proxy?

Sí. GPT-Voice puede pasar un proxy HTTP, HTTPS o SOCKS5 a los contextos de su navegador. SOCKS5 las credenciales no son compatibles,
y el proxy GeoIP puede tomar el control de la configuración regional y la zona horaria del navegador. Consulte [Configuración de red](settings/network.md).

## ¿Cómo borro una transcripción, una sesión o una clave?Utilice **Clear history** en la ventana Historial para transcripciones guardadas. Utilice el control claro del proveedor correspondiente para una

ChatGPT sesión, OpenAI API clave, vLLM clave o contraseña de proxy. Consulte [privacidad y datos](privacy.md) para conocer el alcance preciso
de cada reinicio.
