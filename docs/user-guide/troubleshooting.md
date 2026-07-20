# Troubleshooting

Start with the visible status message and the feature you were using. Do not paste API keys, proxy passwords,
ChatGPT session data, dictated text, selected text, or screenshots containing them into a support request. A useful
safe report includes the GPT-Voice version, operating system, package type, feature, exact non-sensitive message, and
steps that reproduce the problem.

## Microphone cannot start

If the Command Dock shows **Could not access microphone**:

1. Confirm that a microphone is connected and available to other applications.
2. Allow GPT-Voice to use the microphone in your operating system's privacy controls.
3. Close other software that has exclusive control of the device, then start a new recording.
4. If the device changed while GPT-Voice was open, reconnect it and restart GPT-Voice before trying again.

No audio is sent until GPT-Voice has started a recording and you stop it. For the recording controls and retry limit,
see [record and transcribe](guides/transcription.md).

## ChatGPT Web session is disconnected

If **ChatGPT Web** is not **Connected**, a browser login window does not finish, or the session has expired:

1. Check that the computer can reach ChatGPT and that the account is allowed to use the service.
2. Select **Connect** and complete sign-in in the GPT-Voice browser window.
3. If the stored session is no longer valid, use **Clear session**, confirm it, and sign in again.
4. If the browser initialization or connection still fails, temporarily test without a proxy, then review the browser
   and network settings below.

Clearing a session removes GPT-Voice's saved local session; it does not change the account or sessions in other
browsers. See [provider settings](settings/providers.md).

## OpenAI API transcription fails

For **OpenAI API**, check that the provider is selected and configured with your own valid API key. Confirm the
provider account's billing, quota, usage limits, and service status, then save any correction and retry the prepared
recording if it is still available. GPT-Voice uses the fixed `whisper-1` transcription model; there is no model
selection to repair for this provider.

Leave an existing saved key out of reports and screenshots. If you need to replace it, enter the new key and save; use
**Clear API key** when you want GPT-Voice to forget it. See [provider settings](settings/providers.md) and
[providers](guides/providers.md).

## Prettify cannot reach a model

Before Prettify can process selected text, its provider, endpoint, and model must be valid:

1. In **Settings** > **Prettify**, select the intended provider: Ollama or vLLM.
2. Confirm that the local or remote service is running and reachable from this computer.
3. Check the provider address and model name, then use **Load model** when the selected model is not ready.
4. For vLLM, provide an API key only when that endpoint requires one. For a remote endpoint, use HTTPS and confirm
   that you are permitted to send the selected text there.
5. Save valid settings before running the shortcut again.

GPT-Voice does not install or operate Ollama or vLLM. See [Prettify settings](settings/prettify.md) for field
requirements and [text actions](guides/text-actions.md) for selected-text limits and cancellation.

## Proxy or browser service cannot connect

ChatGPT Web and Translation use GPT-Voice browser contexts. If either service works without the proxy but not with it:

1. Turn **Proxy enabled** off temporarily and save the setting to isolate the proxy from the service.
2. When re-enabling it, use a reachable `http://`, `https://`, or `socks5://` server URL and put HTTP/HTTPS
   credentials in their dedicated fields.
3. Remove SOCKS5 credentials: CloakBrowser does not support them.
4. If **GeoIP** is enabled, remember that it controls browser locale and timezone. Turn GeoIP off to test the saved
   Browser identity values directly.

For a browser-runtime error, first retry after the network is stable, then test the proxy as above. Set **Background
browser** to **Visible** temporarily if you need to observe the browser context while you reproduce the issue; restore
the usual **Hidden** setting afterward. See [Browser settings](settings/browser.md) and
[Network settings](settings/network.md).

## A shortcut does not run

Open **Settings** > **Shortcuts** and confirm that the action is enabled, the displayed shortcut is the one you press,
and the change was saved. GPT-Voice rejects conflicts between its own shortcuts, but another application or the
operating system can still reserve the same combination.

Choose a different shortcut, save it, and try again while GPT-Voice is idle. Selected-text actions also wait until an
active recording ends, and Translation and Prettify cannot run at the same time. See
[shortcut settings](settings/shortcuts.md).

## Clipboard or selected text did not appear

For a transcription, wait for **Copied to clipboard** before pasting. A failed transcription is not copied. For
Translation or Prettify, select text in the source application before pressing the action shortcut; Prettify accepts
up to 16,000 characters.

On failure or cancellation, GPT-Voice restores the clipboard value it captured before the selected-text action. A
successful result replaces the clipboard. Confirm that the source application permits normal copy operations; on Linux,
GPT-Voice can also use the selection clipboard when normal copy automation fails. See
[Translate and Prettify selected text](guides/text-actions.md).

## Installation, update, or launch problem

Download only the package that matches your platform from the official GitHub Release, and compare its SHA-256 value
with the accompanying checksum file. Run the Windows installer again to update an existing installation. On Linux, use
the documented package-manager command for deb or rpm packages, or make the AppImage executable before running it.

There is no supported macOS package while signing and notarization are paused. If GPT-Voice will not launch after an
installation or update, restart the computer, retry the verified package, and check that the normal desktop runtime
dependencies are available. Do not delete retained application data as a first step; it contains settings and saved
provider data. Follow [install, update, or remove](install.md) for the exact package and removal procedure.

## If the problem remains

Try the smallest safe reproduction: a short non-sensitive recording, a non-sensitive selected-text sample, or a
temporary proxy-off check. Record the version, platform, package, configuration area, and visible error without copying
credentials or private content. The related guides above describe supported behavior and the available recovery
controls.
