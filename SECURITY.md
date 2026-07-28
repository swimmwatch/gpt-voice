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

- ChatGPT session cookies and profile data stored in the native per-user app data directory
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

## Known production advisory exceptions

| Advisory | Locked production path | Severity | Impact | Override policy | Responsible upstream dependency | Last reviewed | Recheck triggers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GHSA-r292-9mhp-454m` | `cloakbrowser@0.5.2 -> tar@7.5.19` | moderate | Uncontrolled recursion and uncatchable stack-overflow denial of service for crafted long-path tar member selection. | No compatible CloakBrowser resolution has been validated; a forced transitive override can break its archive/runtime behavior. | `cloakbrowser` | `2026-07-29` | Any CloakBrowser or lockfile change, advisory update, or compatible upstream fix. |

The advisory above is separate from the `archiver -> tar-stream -> bare-fs`
archive-creation closure and predates the reviewed six-commit range.
Dependency evidence is kept in three distinct tiers:

1. Host-independent lockfile analysis proves complete production closure for
   Linux x64 and Windows x64.
2. Installed-artifact inspection proves only the current matching host target;
   filename suffixes, mocked platforms, fixtures, and stale unpacked artifacts
   are not cross-platform package evidence.
3. Native installed and packaged-runtime proof for representative Linux and
   Windows environments remains pending in remediation Packet 10.

Mach-O classifier fixtures do not imply current macOS packaging evidence.
macOS distribution remains paused until signing and notarization are
configured.

## Local Diagnostic Capture Exception

Provider audit events are always-on, schema-versioned, and metadata-only. They exclude audio, transcripts, selected text, prompts, results, credentials, URLs, paths, raw provider responses, command output, and exception details.

Translation and Prettify diagnostic text capture is an explicit local plaintext exception:

- Both categories are independently off by default. Voice audio and transcripts are never captured.
- Only successful provider and cache source/result text is eligible. Known credentials are excluded or represented only by non-secret presence metadata; raw provider responses and unrelated logs are not included.
- Eligible text passes through best-effort redaction before plaintext SQLite storage, but arbitrary embedded secrets may not be detected.
- Storage is per-user, permission-restricted, retention- and size-bounded, and can be purged by category or in full from **App settings → Audit Log**.
- Diagnostic ZIP or tar.gz exports are not encrypted and automatically include retained text for categories enabled when the export begins.

The app-owned schema-v1 ZIP and tar.gz producer contract enforces inclusive
ceilings of `64 MiB` per member, `128 MiB` total uncompressed payload, `8 MiB`
per JSONL line excluding its terminator, `100,000` records per JSONL member,
`1 MiB` of archive structure, a `130 MiB` outer archive, and a maximum reported
compression ratio of `1000:1`.

Treat the diagnostic database, exported archive, and any derived analysis
report as local, unencrypted, private, best-effort-redacted data. Review and
redact them before sharing. Repository analysis is instruction-only,
selective, best-effort, and tool-dependent. The repository supplies no parser,
validator, extractor, launcher, process adapter, report writer, or portable
analysis runtime. The workflow proves neither archive authenticity nor
hostile-input safety, complete schema validation, prompt-injection isolation,
stable-file handling, resource containment, or absence of tool-created
temporary data. Report publication is capability-dependent, refuses an
existing target by default, and requires separate explicit authorization and
revalidation before replacement. GPT-Voice never uploads these artifacts or
opens them automatically.

## Disclosure Policy

We follow a responsible disclosure process. After a vulnerability is confirmed, maintainers will work on a fix, prepare a release when needed, and disclose the issue publicly only after a patch is available.

## Questions

For security-related questions, contact the maintainers using the email above.
