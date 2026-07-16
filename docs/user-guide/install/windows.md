# Windows

1. Download `GPT-Voice Setup *.exe` from the latest release and open it.
2. Choose an installation location if prompted.
3. Keep the desktop and Start Menu shortcuts enabled unless you prefer to launch the app manually.
4. Complete the installer, then open **GPT-Voice** from the Start Menu, desktop shortcut, or final installer screen.

The Windows package is an NSIS installer. It installs GPT-Voice, its bundled browser runtime, icons, shortcuts, and an
uninstaller entry in Windows settings.

### Update or remove on Windows

To update, download the newer `GPT-Voice Setup *.exe` and run it over the existing installation.

To remove the application:

1. Open **Settings** > **Apps** > **Installed apps**.
2. Find **GPT-Voice**.
3. Select **Uninstall**.

Removing the application removes installed files and shortcuts, but deliberately keeps your local settings and saved
provider session in `%APPDATA%\GPT-Voice`. This lets a reinstall reuse them. Delete that folder manually only when you
want to remove those local data too.
