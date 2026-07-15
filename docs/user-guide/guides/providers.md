# Choose and manage a transcription provider

GPT-Voice uses one active transcription provider at a time. Choose it from the **Provider** selector in the Command Dock. Switching the selector changes which provider receives the next recording; it does not transfer sessions, API keys, billing, or account access between providers.

| Provider        | Authentication                       | Where audio is sent                     |
| --------------- | ------------------------------------ | --------------------------------------- |
| **ChatGPT Web** | A signed-in ChatGPT browser session. | Through the signed-in ChatGPT session.  |
| **OpenAI API**  | An OpenAI API key you provide.       | OpenAI's audio-transcriptions endpoint. |

Use only an account that you are authorized to use. Availability, billing, quotas, usage limits, and service terms are set by the provider account and service. GPT-Voice does not bypass them.

## ChatGPT Web

Select **ChatGPT Web**, then choose **Connect**. GPT-Voice opens a browser login window at ChatGPT. Complete sign-in there, then close the login page. GPT-Voice saves the resulting browser session locally and starts its background browser on later launches when the session is still usable.

When the session is ready, the provider shows **Connected**. If the session expires, GPT-Voice removes the unusable stored session and you must choose **Connect** again. A transcription request can also refresh its short-lived access token once; this does not replace a new sign-in when the underlying session is no longer valid.

To sign out from GPT-Voice, open the provider settings and use **Clear authentication**. This removes GPT-Voice's saved ChatGPT browser-session data and cached access token. It does not manage your account, subscription, or any sessions held by other browsers or devices.

## OpenAI API

Select **OpenAI API** and choose **Configure**, or open the provider-settings control beside the selector. Paste your own API key and save the form. GPT-Voice uses the fixed transcription model `whisper-1`; it does not let this provider select another transcription model.

The provider settings also let you choose:

- **Language**: automatic detection (the default), English, Russian, Ukrainian, or Belarusian.
- **Prompt**: optional guidance sent with the transcription request.
- **Temperature**: a value from `0` to `1`; the default is `0`.

GPT-Voice stores the API key locally with Electron safe storage when that protection is available and never displays the saved key in the interface. If secure storage is unavailable, saving a new key fails instead of storing it without that protection. The OpenAI API provider does not use the browser login window.

Use **Clear authentication** in provider settings to remove the saved API key. The non-secret transcription options remain available for the next key you configure, but the provider is not connected until a valid key is saved again.

## Switch or recover a provider

You may switch providers before starting a recording. Confirm that the newly selected provider is **Connected** before you record; a configured ChatGPT Web session and a configured OpenAI API key are independent.

If transcription fails:

1. Check that the selected provider is still connected and that its account can use transcription.
2. For **ChatGPT Web**, reconnect if the session expired or the browser could not initialize.
3. For **OpenAI API**, confirm the API key, billing or quota, and the provider's service status, then save any needed correction.
4. Return to [recording and transcription](transcription.md) to retry the most recent prepared capture, or start a new recording.

Provider settings affect future requests. They cannot recover a cancelled recording or override provider-side access, quota, policy, or service errors.
