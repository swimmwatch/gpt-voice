# Translate and Prettify selected text

GPT-Voice can act on text selected in another application. **Translate** sends the selection to Google Translate in the
target language you choose. **Prettify** sends it to your configured text-processing provider to improve the text
according to its prompt. Neither action pastes into the other application: on success, copy the result from the system
clipboard and paste it where you need it.

## Enable an action and choose its shortcut

Open **Settings** and select **Shortcuts**. The **Translate** and **Prettify** rows each have an enable switch and a
**Change** control for their global shortcut. Both actions are enabled by default; their default shortcuts are `F11`
for Translate and `F12` for Prettify. Save the settings after making a change.

Choose a shortcut that does not conflict with another GPT-Voice shortcut or with software you use. A disabled action
does not run when its shortcut is pressed. An action also waits until an active recording has ended, and GPT-Voice runs
only one selected-text action at a time.

## Translate a selection

1. In the application containing the text, select the text you want to translate.
2. In the GPT-Voice Command Dock, choose **Target language**: English, Russian, Ukrainian, or Belarusian.
3. Press the enabled Translate shortcut (by default, `F11`).
4. Wait for the success notification, then paste the translated text from your clipboard.

GPT-Voice copies the selected text by using the operating system's normal copy action, then submits it to Google
Translate. Translation is an external service: the selected text is sent to Google Translate, so do not use this action
for text you are not permitted to share with that service.

If there is no selected text, copying cannot be automated, or the service cannot return a result, GPT-Voice reports a
safe error message and restores the clipboard value that was present before the action. On Linux, it can also use the
selection clipboard when the normal copy action fails. A successful translation replaces the system clipboard with the
translated result.

## Prettify a selection

Before using Prettify, open **Settings** and select **Prettify**. Choose either **Ollama** or **vLLM**, set the provider
address and model, and save a valid configuration. vLLM can also require an API key.

1. Select up to 16,000 characters in the application you are editing.
2. Press the enabled Prettify shortcut (by default, `F12`).
3. Wait for the **Text prettified** notification, then paste the result from your clipboard.

Ollama and vLLM are user-operated dependencies: GPT-Voice does not install, host, or manage either service. A local
loopback endpoint keeps the request on the machine running that service. A remote endpoint receives the selected text;
use a provider you trust, follow its data-handling policy, and use HTTPS for a non-local endpoint.

If no text is selected, the selection exceeds 16,000 characters, the configured provider cannot be reached, or it
returns no usable result, GPT-Voice reports the failure and restores the previous clipboard contents. While a Prettify
request is running, the configured cancel shortcut (default `Escape`) cancels it and restores that clipboard value.

## Clipboard and concurrent actions

Translation and Prettify are intentionally mutually exclusive. Starting one while the other is already working skips
the new request, so wait for the status or notification before trying again. On success, the result replaces the
clipboard; on a failed or cancelled request, GPT-Voice restores the clipboard value it captured before reading the
selection. Always check the pasted result, especially when the source text contains names, code, or other exact values.
