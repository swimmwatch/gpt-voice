# Shortcut settings

GPT-Voice uses global shortcuts, so they can work while you are in another application. Open **Settings** and choose **Shortcuts** to view or change them.

| Action                                | Default shortcut | When it works                                                                                                  |
| ------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| **Start, pause, or resume recording** | `F9`             | Starts recording when idle, pauses an active recording, or resumes a paused recording.                         |
| **Stop recording**                    | `F10`            | Stops a recording or paused recording and begins transcription.                                                |
| **Cancel**                            | `Escape`         | Cancels an active recording. When no recording is active, it cancels a running Prettify request.               |
| **Translate selected text**           | `F11`            | Translates selected text when Translation is enabled and no recording or other selected-text action is active. |
| **Prettify selected text**            | `F12`            | Prettifies selected text when Prettify is enabled and no recording or other selected-text action is active.    |
| **Retry transcription**               | `Ctrl+F8`        | Retries the latest retryable transcription only when GPT-Voice is idle.                                        |

The retry shortcut is unavailable until there is a retryable transcription. See [record and transcribe](../guides/transcription.md) for when retry becomes available and [translate and Prettify selected text](../guides/text-actions.md) for the selected-text workflows.

## Change a shortcut

1. Select **Change** on the action's row.
2. In the capture dialog, press the full key combination you want to use.
3. Check the combination shown in the dialog, then choose **Apply**. Choose **Cancel** to leave the current shortcut unchanged.

GPT-Voice temporarily suspends all of its global shortcuts while the capture dialog is open, then registers them again when you apply or cancel. Press a non-modifier key as part of the combination; pressing only `Ctrl`, `Alt`, `Shift`, or the platform's command key does not create a shortcut.

## Avoid conflicts

Use a different shortcut for each GPT-Voice action and choose combinations that do not collide with your operating system or other software. GPT-Voice rejects conflicting GPT-Voice assignments. An unmodified key conflicts with the same base key even if the other assignment includes modifiers, so do not pair, for example, F9 with Ctrl+F9.

If a new assignment cannot be registered, GPT-Voice keeps the current shortcut and shows the reason. On macOS, a captured Command key is represented as `Command`; on other supported platforms, the platform equivalent is used.

## Enable or disable selected-text actions

The **Translate** and **Prettify** rows each have an enable switch. Both are enabled by default. Turn a switch off to prevent that action from running even if its shortcut is pressed; turn it on to make the configured shortcut available again when the action's normal conditions are met.

These switches are part of the Settings form, so choose **Save changes** after changing them. Changing a shortcut through the capture dialog applies that shortcut independently; use the unsaved-changes indicator in the Settings overview to distinguish pending form edits from an already applied shortcut.
