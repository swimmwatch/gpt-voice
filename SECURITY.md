# Security Policy

## Supported Versions

Security updates are provided for the latest stable GPT-Voice release. Older releases may not receive security fixes.

## Reporting a Vulnerability

If you discover a security vulnerability, report it privately. Do not disclose security issues publicly until they have been reviewed and patched.

- GitHub private advisory: <https://github.com/swimmwatch/gpt-voice/security/advisories/new>
- Email: <contact.vasiliev.dmitry@gmail.com>
- Telegram: <https://t.me/contact_vasiliev_dmitry>

Please include:

- A clear description of the vulnerability
- Steps to reproduce
- Affected version or commit
- Operating system and install method
- Any logs, screenshots, or proof of concept with secrets removed

## Security-Sensitive Areas

GPT-Voice is a desktop app that controls a browser session and handles voice input. The following areas are especially sensitive:

- ChatGPT session cookies and profile data stored locally under `~/.gpt-voice`
- CloakBrowser executable and cache bundled into packaged releases
- IPC messages between Electron main, preload, and renderer processes
- Audio recording, temporary audio files, and transcription content
- Clipboard writes
- Hotkey handling
- Release artifacts and installer scripts
- GitHub Actions secrets and release permissions

## Security Practices

- All code changes should be reviewed before merging into `main`.
- Pull requests run linting, type checking, build checks, dependency validation, and package smoke checks.
- Release builds are produced through GitHub Actions or local `electron-builder` commands.
- Dependencies are monitored with Dependabot.
- Production dependency audits run with `npm run audit:prod`.
- Sensitive files, session data, browser caches, credentials, and local release artifacts must not be committed.

## Disclosure Policy

We follow a responsible disclosure process. After a vulnerability is confirmed, maintainers will work on a fix, prepare a release when needed, and disclose the issue publicly only after a patch is available.

## Questions

For security-related questions, contact the maintainers using the email above.
