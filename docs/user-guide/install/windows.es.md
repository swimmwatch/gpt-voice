# ventanas

1. Descargue `GPT-Voice Setup *.exe` de la última versión y ábralo.
2. Elija una ubicación de instalación si se le solicita.
3. Mantenga habilitados los accesos directos del escritorio y del menú Inicio a menos que prefiera iniciar la aplicación manualmente.
4. Complete el instalador, luego abra **GPT-Voice** desde el menú Inicio, el acceso directo del escritorio o la pantalla final del instalador.

El paquete de Windows es un instalador de NSIS. Instala GPT-Voice, su tiempo de ejecución de navegador incluido, íconos, accesos directos y un
entrada del desinstalador en la configuración de Windows.

### Actualizar o eliminar en Windows

Para actualizar, descargue el `GPT-Voice Setup *.exe` más nuevo y ejecútelo sobre la instalación existente.

Para eliminar la aplicación:

1. Abra **Settings** > **Apps** > **Installed apps**.
2. Busque **GPT-Voice**.
3. Seleccione **Uninstall**.

Al eliminar la aplicación, se eliminan los archivos instalados y los accesos directos, pero se mantienen y guardan deliberadamente la configuración local.
sesión de proveedor en `%APPDATA%\GPT-Voice`. Esto permite que una reinstalación los reutilice. Elimine esa carpeta manualmente sólo cuando
También quiero eliminar esos datos locales.
