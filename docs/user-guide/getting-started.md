# First use: connect a provider and transcribe speech

After [installing GPT-Voice](install.md), connect one transcription provider, allow microphone access, and make a
short recording. GPT-Voice copies a successful transcription to the clipboard; it does not automatically type into the
application you were using.

## 1. Choose a transcription provider

Open GPT-Voice and choose **ChatGPT Web** or **OpenAI API** in the **Provider** selector in the Command Dock.

| Provider        | What you need                                               | First-time action                                                    |
| --------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| **ChatGPT Web** | A ChatGPT account that you can sign in to.                  | Select it, then choose **Connect** and complete the browser sign-in. |
| **OpenAI API**  | Your own OpenAI API key and available API billing or quota. | Select it, then choose **Configure** to open the provider settings.  |

Provider availability, limits, billing, and terms are controlled by the account you use. GPT-Voice does not bypass
those limits.

### Connect ChatGPT Web

1. Select **ChatGPT Web**.
2. Choose **Connect**.
3. Complete the ChatGPT sign-in in the browser window that opens.
4. After ChatGPT is ready, close that login window and return to GPT-Voice.

The provider state changes to **Connected** when the session is ready. GPT-Voice saves the browser session in your
local app data and starts its background browser automatically on later launches. If the session expires, choose
**Connect** again to sign in again.

### Configure OpenAI API

1. Select **OpenAI API**.
2. Choose **Configure**. You can also use the provider-settings control beside the provider selector.
3. Paste your OpenAI API key.
4. Optionally choose a transcription language, prompt, or temperature.
5. Choose **Save**.

The transcription model is fixed to `whisper-1`. After a successful save, GPT-Voice shows the provider as
**Connected** and reports that the provider is configured. The application stores the API key locally using Electron
safe storage when it is available; the key is not shown back in the interface. OpenAI API transcription does not use a
browser.

## 2. Allow microphone access

The first recording asks your operating system for microphone permission. Allow access for GPT-Voice, then return to
the Command Dock. If access is denied or no microphone is available, the status shows **Error: Could not access
microphone** and no audio is sent. Enable the permission in your operating system's privacy controls before trying
again.

## 3. Make a first recording

1. Select a provider that shows **Connected**.
2. Choose **Start recording** or press the displayed recording shortcut (the default is `F9`).
3. Speak a short sentence. The status changes to **Recording**.
4. Choose **Stop recording** (default `F10`). GPT-Voice changes the status to **Transcribing** while it sends the
   captured audio to the selected provider.
5. Wait for **Copied to clipboard**, then paste into any text field to confirm the result.

You can also pause, resume, or cancel an active recording from the Command Dock. Cancelling discards the active
recording instead of sending it for transcription.

## If the first transcription does not work

- If **Connected** is not shown, reopen the provider controls and complete sign-in or save a valid API key. For
  ChatGPT Web, the status may instead say that browser initialization failed or that the session expired.
- If the status reports a microphone error, allow GPT-Voice to use your microphone in the operating system and make a
  new recording.
- If the status reports **Transcription failed** or **Transcription error**, check the selected provider's account,
  connection, and limits, then try again. A failed transcription is not copied to the clipboard.

The next guide pages cover recording controls, provider behavior, shortcuts, and troubleshooting in more detail. For
now, a **Connected** provider and a **Copied to clipboard** result confirm that the basic path is working.
