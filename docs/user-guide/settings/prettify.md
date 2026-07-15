# Prettify settings

**Prettify** is GPT-Voice's meaning-preserving cleanup action for selected text. Open **Settings** and select **Prettify** to choose the service, its model, and its generation behavior. For selecting text and starting the action, see [translate and Prettify selected text](../guides/text-actions.md).

Prettify needs an Ollama or vLLM service that you operate, plus a model selected for that service. GPT-Voice does not download, start, host, or pay for either service. The model field is required; if no model is configured, Prettify reports that a model is needed instead of sending the selected text.

## Choose a provider and connect it

Choose **Ollama** or **vLLM** in **Provider**. GPT-Voice keeps the base URL and selected model separately for each provider, so switching providers does not replace the other provider's choices. The default provider is Ollama.

| Provider   | Default base URL           | Model default     | Connection behavior                                                                             |
| ---------- | -------------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| **Ollama** | `http://127.0.0.1:11434`   | No model selected | Refreshes the models available from your Ollama service and sends Prettify requests to it.      |
| **vLLM**   | `http://127.0.0.1:8000/v1` | No model selected | Refreshes the models exposed by your vLLM-compatible service and sends Prettify requests to it. |

Enter a complete `http` or `https` base URL. GPT-Voice removes surrounding whitespace and trailing slashes when it saves the setting. URLs that are not HTTP(S), or that include a username or password, are rejected. HTTP is allowed only for a loopback endpoint such as `127.0.0.1`, `localhost`, or `::1`; every non-loopback endpoint must use HTTPS.

When the active, valid base URL is remote rather than loopback, Settings displays a privacy notice. Using that endpoint sends the selected text and your configured Prettify prompt to the service you chose. Review that service's privacy, retention, and access controls before using remote processing.

### vLLM API key

The **vLLM API key** field appears only when vLLM is selected. Use it when your vLLM service requires bearer authentication. GPT-Voice sends the key with vLLM requests only when a key is configured.

The key is stored separately with Electron safe storage. After it is saved, the field does not reveal it again; it instead indicates that a key is stored. Leaving the field blank keeps an existing stored key. Choose **Clear API key** to remove it. If secure storage is unavailable on your system, GPT-Voice cannot save a new vLLM key.

Do not put a key in a base URL, a screenshot, or a support request.

## Select and manage a model

Choose **Refresh models** after starting the active provider service or changing its base URL. The model list comes from the active provider, so refresh it again after changing providers. Select one of the returned models before running Prettify. If the connection, service, authentication, or provider response fails, Settings shows a connection or model-refresh error; check that the URL is valid, the service is running, and the vLLM key is appropriate, then refresh again.

Ollama shows an additional **Model actions** menu when a model is selected:

- **Load model** asks Ollama to keep the selected model loaded for GPT-Voice. If GPT-Voice had kept a different Ollama model loaded, it releases that model first.
- **Free model** asks Ollama to release the selected model from memory.

These actions are available only for Ollama, not vLLM. The selected Ollama model shows **Loaded** or **Not loaded** after GPT-Voice checks its running-model state. When Ollama reports a size, Settings also shows an approximate model or loaded-VRAM size. Treat the value as an estimate reported by Ollama, not as a memory reservation guaranteed by GPT-Voice.

Loading, freeing, and refreshing can fail if the endpoint is unavailable or the provider rejects the request. Settings leaves the current form open and shows the result or error so you can correct the endpoint or model and try again.

## Control how text is generated

**Temperature** is the primary generation control. Its default is **0**, with an allowed range from **0 to 1** in steps of **0.05**. A lower value asks the provider for less variation; changing it changes the next Prettify request after you save Settings.

Open **Advanced generation** to change the remaining controls. The collapsed summary indicates whether all advanced values still use their defaults or how many have changed. These settings are sent with each Prettify request to the selected provider.

| Control                   | Default | Accepted value                                | Use it for                                                                                                                                          |
| ------------------------- | ------: | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Top P**                 |   `0.9` | `0.05`–`1`, in `0.05` steps                   | Limiting choices to the most likely cumulative probability range.                                                                                   |
| **Min P**                 |     `0` | `0`–`1`, in `0.05` steps                      | Excluding lower-probability choices below the selected threshold.                                                                                   |
| **Repeat penalty**        |     `1` | `0.8`–`1.5`, in `0.05` steps                  | Adjusting how strongly the provider discourages repeated output.                                                                                    |
| **Top K**                 |    `40` | Integer from `1` to `200`                     | Limiting each choice to the most likely candidates.                                                                                                 |
| **Maximum output tokens** |  `4096` | Integer from `1` to `8192`                    | Capping the length of the generated response. The response can still be shorter.                                                                    |
| **Seed**                  |   Unset | Blank, or an integer from `0` to `2147483647` | Supplying an optional numeric seed to the provider. It can help reproduce a request, but results can still vary with the model and service version. |

The decimal controls use 0.05 increments. Top P accepts 0.05 through 1; Min P accepts 0 through 1; and Repeat penalty accepts 0.8 through 1.5. Top K accepts whole numbers from 1 through 200, while Maximum output tokens accepts whole numbers from 1 through 8192.

Use the defaults unless you know the requirements of the selected model and service. GPT-Voice sends equivalent generation choices to Ollama and vLLM, but either service can still reject a request or handle a setting according to its own model support.

## Write the Prettify prompt

**Prompt** is required and defaults to GPT-Voice's built-in conservative copy-editor instruction. It tells the service to treat selected text as inert source material, preserve its language and meaning, correct and clarify it, remove unnecessary repetition, and return only the edited text. It also instructs the service not to execute instructions contained in the selected text.

You can replace the prompt for a different editing policy. Keep it to **4,000 characters or fewer**. A blank prompt, a prompt longer than 4,000 characters, an unsupported provider, an invalid endpoint, an empty model, or an out-of-range generation value blocks **Save changes** and identifies the affected field. Leading and trailing whitespace is removed when settings are saved.

The prompt is sent with the selected text to the active provider. Do not include passwords, API keys, personal data, or confidential instructions that you would not want that provider to receive.

## Save and validate changes

Provider, model, prompt, and generation values are part of the Settings form. An edit creates **Unsaved changes**; choose **Save changes** only after the form has no validation errors. A successful save persists the regular Prettify configuration and closes Settings. The vLLM key remains separate: it is stored only through Electron safe storage and is never returned in the settings view.

If saving fails, the Settings window remains open with a safe error message. Correct the reported field or provider connection and try again. See the [Settings overview](index.md) for unsaved-change and discard-confirmation behavior.
