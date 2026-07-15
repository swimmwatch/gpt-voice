# Record and transcribe

Before recording, connect a provider that shows **Connected** and allow GPT-Voice to use your microphone. See
[first use](../getting-started.md) if you have not completed that setup, or review the [provider guide](providers.md)
for connection and account details.

## Recording lifecycle

Start a recording from the Command Dock or with the configured recording shortcut (the default is `F9`). The status
changes from **Ready** to **Recording** once microphone capture has started. While recording, the primary action is
**Stop recording** (default `F10`).

| Action              | When it is available                         | What happens                                                                                                                  |
| ------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Start recording** | GPT-Voice is idle.                           | Requests microphone access and begins a new capture. Starting a new capture clears any retryable audio from the previous one. |
| **Pause**           | A capture is recording.                      | Pauses the current capture without submitting it.                                                                             |
| **Resume**          | A capture is paused.                         | Continues the same capture.                                                                                                   |
| **Stop recording**  | A capture is recording or paused.            | Ends capture, prepares the audio, and sends it to the selected provider.                                                      |
| **Cancel**          | GPT-Voice is starting, recording, or paused. | Stops and discards the active capture; it is not sent for transcription.                                                      |

While GPT-Voice is stopping, preparing audio, transcribing, or retrying, wait for the current operation to finish
before starting another recording. The Command Dock shows a processing state during this time.

## What happens after you stop

After **Stop recording**, GPT-Voice prepares the captured audio and shows **Transcribing**. It sends the prepared
audio to the provider selected in the Command Dock:

- **ChatGPT Web** sends the audio through the signed-in ChatGPT browser session.
- **OpenAI API** sends the audio to OpenAI's transcription endpoint using the API key you configured.

Provider availability, account access, billing, quotas, and service terms are controlled by that provider account.
GPT-Voice does not bypass those controls.

On success, GPT-Voice copies the returned text to your system clipboard, changes the status to **Copied to
clipboard**, and requests a success notification. Paste the text into the application you were using. GPT-Voice also
saves the text, the provider name, and the request time in its local transcription history; the history controls are
documented separately.

## Retry a failed transcription

After GPT-Voice has prepared a non-empty capture, it keeps that prepared audio in memory as the most recent retryable
recording. If the transcription request fails, use the configured retry-transcription action when GPT-Voice is idle to
send the same prepared audio again. Retrying does not record the microphone again.

This retry copy is deliberately temporary:

- It is cleared before you begin a new recording.
- It is unavailable while recording, processing, or retrying.
- It is kept only in the running application's memory; restarting GPT-Voice removes it.

Retry is a way to repeat one failed submission after you correct a connection, session, or provider issue. It does not
change provider limits, restore an expired account session, or guarantee that a provider will accept the request.

## If recording or transcription fails

- **Could not access microphone** means GPT-Voice could not get an audio stream. Check the operating system's
  microphone privacy permission, confirm that a microphone is connected, then start a new recording.
- **Transcription failed** means the provider returned an unsuccessful result. Check the provider account, network,
  service availability, and applicable limits before retrying.
- **Transcription error** means GPT-Voice could not complete preparation or the request. The failure notification and
  Command Dock status provide the safe user-facing error message; failed text is not copied to the clipboard.
- If a ChatGPT Web session has expired, reconnect it before retrying. If an OpenAI API key is missing or rejected,
  correct it in provider settings before retrying.

Cancelling an active recording is different from a failed submission: cancelling discards the capture before it is
prepared or sent, so there is no retryable transcription for that recording.
