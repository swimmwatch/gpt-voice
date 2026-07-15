# Provider settings

Choose the transcription provider in the GPT-Voice Command Dock. To configure the currently selected provider, open its **Connect** or **Configure** control in the header. The provider dialog shows only the controls that apply to that provider.

## ChatGPT Web

ChatGPT Web uses a browser session rather than an API key. Its provider dialog displays whether a session is saved.

1. Select **ChatGPT Web** in the Command Dock.
2. Open its provider dialog and choose **Log in** when no session is saved, or **Log in again** to replace a saved session.
3. Complete sign-in in the GPT-Voice browser window, then return to the Command Dock when the provider shows **Connected**.

Use **Clear session** when you want GPT-Voice to forget the saved ChatGPT Web authentication. GPT-Voice asks for confirmation before clearing it. Clearing the session disconnects this provider; sign in again before using it for transcription.

For account ownership, browser-session, and provider-limit details, see [providers](../guides/providers.md).

## OpenAI API

Select **OpenAI API** and open its provider dialog to configure these fields. Use your own OpenAI API key and account; GPT-Voice does not supply a key, credits, or access to OpenAI services.

| Field           | Current behavior                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **API key**     | Enter a new key to save it. The field is blank when reopened even if a key is stored, and a blank save does not replace that stored key. |
| **Model**       | `whisper-1` is the only available transcription model. It is shown as a read-only field.                                                 |
| **Language**    | Choose automatic detection (the default), English, Russian, Ukrainian, or Belarusian.                                                    |
| **Prompt**      | Optional transcription guidance. The default is empty; leading and trailing whitespace is removed when saved.                            |
| **Temperature** | Controls transcription variation from 0 to 1. The default is 0; the control changes in 0.05 steps.                                       |

Choose **Save** to validate and store the changes. A successful save closes the dialog. Invalid model, language, or temperature values are rejected; if saving fails, the dialog shows a safe error message and remains open.

## Stored credentials and clearing authentication

GPT-Voice stores an OpenAI API key only through Electron safe storage. The key itself is not shown back in the dialog; the dialog instead indicates that an API key is stored. If secure storage is unavailable, GPT-Voice cannot save a new key.

Use **Clear API key** and confirm the dialog to remove the stored key while keeping the other OpenAI API settings. The button is available only when a key is stored. You must enter and save a new key before OpenAI API can transcribe again.

Provider credentials and service usage remain under the provider account's terms, billing, quotas, and privacy policy. Do not paste keys into support requests, screenshots, or documentation.
