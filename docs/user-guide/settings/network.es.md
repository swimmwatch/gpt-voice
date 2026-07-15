# Configuración de red

Abra **Settings** y seleccione **Network** para configurar el proxy GPT-Voice pasa a los contextos CloakBrowser. Estas configuraciones afectan los servicios basados ​​en navegador como ChatGPT Web y la traducción de texto seleccionado. Para conocer la configuración de identidad afectada por el proxy GeoIP, consulte [Configuración del navegador](browser.md).

## Habilitar un proxy

**Proxy enabled** está desactivado de forma predeterminada. Cuando está desactivado, GPT-Voice no pasa un proxy a CloakBrowser y los campos de red restantes están deshabilitados. Desactivarlo no borra los valores que ingresó, por lo que puede habilitar el proxy nuevamente más tarde.

Cuando lo habilita, se requiere **Proxy server**. Ingrese una URL completa usando uno de estos protocolos:

- `http://`
- `https://`
- `socks5://`

Por ejemplo, `http://proxy.example.com:8080` es un formato de servidor válido. GPT-Voice elimina los espacios en blanco circundantes cuando guarda el valor. Rechaza un servidor faltante o con formato incorrecto, protocolos no compatibles y URL que contengan un nombre de usuario o contraseña. En su lugar, coloque las credenciales en campos separados.

## Bypass y credenciales

| Campo        | Predeterminado               | Comportamiento                                                                                   |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| **Bypass**   | En blanco                    | Opcional. Cuando se proporciona, GPT-Voice pasa el valor de omisión a CloakBrowser con el proxy. |
| **Username** | En blanco                    | Nombre de usuario de proxy opcional para autenticación de proxy HTTP o HTTPS.                    |
| **Password** | No hay contraseña almacenada | Contraseña de proxy opcional para autenticación de proxy HTTP o HTTPS.                           |

La contraseña se almacena por separado a través de Electron safe storage. Después de guardar, su valor no regresa a Configuración; el campo muestra que en su lugar se guarda una contraseña. Dejar el campo en blanco mantiene la contraseña existente. Elija **Clear** para eliminarlo. Si el almacenamiento seguro no está disponible, GPT-Voice no puede guardar una nueva contraseña de proxy.

No coloque un nombre de usuario o contraseña en la URL del servidor proxy, no pegue credenciales en una solicitud de soporte ni las exponga en una captura de pantalla.

### SOCKS5 las credenciales no son compatibles

CloakBrowser no admite un nombre de usuario o contraseña para un proxy SOCKS5. Cuando un proxy SOCKS5 habilitado tiene cualquiera de las credenciales, Configuración muestra una advertencia y bloquea el guardado hasta que elimine el nombre de usuario y borre la contraseña. GPT-Voice no pasa las credenciales de SOCKS5 a CloakBrowser.

## Permitir que el proxy GeoIP posea la identidad del navegador

**GeoIP** está desactivado de forma predeterminada y está disponible solo cuando el proxy está habilitado. Actívelo cuando el proxy configurado deba determinar la configuración regional y la zona horaria del navegador. Mientras tanto el proxy como GeoIP están activos, GPT-Voice pasa el proxy con GeoIP habilitado y no pasa su configuración regional o zona horaria guardada por separado.En consecuencia, los campos **Locale** y **Timezone** en [Configuración del navegador](browser.md) están deshabilitados y muestran **Proxy GeoIP controls locale and timezone**. Desactive GeoIP para editar y utilizar los valores de identidad del navegador guardados nuevamente.

## Guardar y solucionar problemas

Los valores de red son parte del formulario de Configuración. Elija **Save changes** después de que la validación sea exitosa; la configuración de proxy guardada se utiliza la próxima vez que GPT-Voice cree el contexto del navegador aplicable. Si no se puede guardar, la Configuración permanece abierta e identifica el campo no válido.

En caso de error de conexión, confirme que la URL del servidor incluya `http`, `https` o `socks5`, que se pueda acceder al proxy y que las credenciales HTTP/HTTPS estén en sus campos dedicados. No ingrese SOCKS5 credenciales. Consulte la [Descripción general de la configuración](index.md) para conocer el comportamiento de confirmación de descarte y cambios no guardados.
