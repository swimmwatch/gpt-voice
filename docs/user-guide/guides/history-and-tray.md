# Transcription history and tray

GPT-Voice keeps a local history of successful transcriptions so you can reuse a result after it has left the clipboard.
The tray provides access to the application when its main window is hidden.

## Reuse transcription history

Open the tray menu and choose **History**. Each successful transcription is stored locally with its request time,
provider name, and text. The history is stored in the application's local SQLite data; it does not store the recorded
audio. Because entries can contain sensitive dictated text, treat the history as you would any other local document.

The newest entries appear first. History loads progressively as you scroll, so a long history does not need to load in
one request. The window shows loading, retry, and safe error messages if it cannot fetch the next page.

To reuse an entry, select its text card. GPT-Voice copies that entry's stored text to the system clipboard and briefly
shows **Copied**. It does not submit the text for transcription again. If copying fails or an entry has already been
removed, the history window reports the failure instead of changing the clipboard.

## Clear local history

Use **Clear history** in the History window and confirm the dialog to delete every saved transcription entry. This
action clears the local history; it cannot be undone from GPT-Voice. New successful transcriptions create new entries
afterward.

If you want to remove all retained application data as part of uninstalling GPT-Voice, follow the platform-specific
instructions in [install, update, or remove](../install.md).

## Use the tray

Closing the main GPT-Voice window hides it instead of quitting the application. The application continues to run in the
system tray, so its configured global shortcuts remain available. Select the tray icon to focus the visible main window
or show it if it is hidden.

The tray menu provides these actions:

| Menu action        | Result                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| **Show GPT-Voice** | Shows and focuses the main window, or creates it if necessary.                                      |
| **Settings**       | Opens the Settings window.                                                                          |
| **History**        | Opens the local transcription history.                                                              |
| **About**          | Opens the About window.                                                                             |
| **Quit**           | Exits GPT-Voice. Use this when you want to stop the application rather than merely hide its window. |

The tray icon reflects the current activity: idle, recording, paused, transcription processing, or Prettify. It is an
indicator and navigation point; recording controls remain available through the Command Dock and their configured
shortcuts.
