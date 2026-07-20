# Settings overview

Open **Settings** from the GPT-Voice tray menu. The Settings window opens on **Shortcuts** and has four sections:

| Section                     | Use it to                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Shortcuts**               | Choose the global shortcuts for recording, stopping, cancelling, translation, Prettify, and retrying a transcription. |
| **[Prettify](prettify.md)** | Choose the Ollama or vLLM text-processing provider and configure its model and generation behavior.                   |
| **[Browser](browser.md)**   | Configure the browser identity and background behavior GPT-Voice uses for its browser-based services.                 |
| **[Network](network.md)**   | Configure the proxy used by those browser-based services.                                                             |

The section buttons remain available on narrow windows as icons with accessible labels. Select a section to change its settings; each page describes its own fields and prerequisites.

## Save changes

Settings are loaded from the saved application configuration when the window opens. Changing a value marks the form as having **Unsaved changes**. The **Save changes** button is available only after at least one change is made and all current field values are valid. It remains disabled while GPT-Voice is saving.

When a value does not meet its requirements, the affected field shows a validation message and saving is blocked until you correct it. If a save operation itself fails, Settings remains open and shows an error message so you can correct the problem or try again. A successful save updates the saved configuration and closes the Settings window.

## Close without losing work by accident

Closing Settings with no unsaved changes closes it immediately. If there are unsaved changes, GPT-Voice asks whether you want to discard them. Choose **Keep editing** to return to the form, or **Discard changes** to close Settings without saving the pending edits. While a save is in progress, closing Settings is blocked until the operation ends.

This confirmation applies to the settings form. Capturing a new global shortcut is a separate action: GPT-Voice temporarily suspends global shortcuts while it listens for the key combination, then resumes them when that capture is finished or cancelled.
