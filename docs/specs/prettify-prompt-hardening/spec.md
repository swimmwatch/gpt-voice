# Spec: Prettify Prompt Hardening

Status: Approved for implementation
Date: 2026-07-12
Scope owner: Prettify selected-text flow

## Objective

Keep Prettify a conservative selected-text editor while preventing silent formatting loss, bounding local and remote inference consumption, and making external-provider privacy explicit.

## Requirements

- Preserve non-empty provider output exactly, including leading/trailing whitespace.
- Treat all selected-text message content as source data without relying on user-controlled XML-like delimiters.
- Update the built-in prompt to preserve formatting-sensitive content and return the source unchanged when no safe edit is possible. Migrate the previous built-in prompt automatically.
- Limit selected text and custom prompt size in the main process. Use a nonzero default output-token limit while retaining the existing absolute maximum.
- Validate provider URLs in shared code and before main-process persistence or network use: reject credentials, accept HTTP only for loopback endpoints, and require HTTPS elsewhere.
- Warn in Settings when a provider endpoint is non-loopback because selected text is transmitted to that endpoint.
- Do not retain raw selected text in cache keys; expire Prettify cache entries promptly.
- Preserve the existing hotkey-to-clipboard interaction; do not add a confirmation or preview workflow in this scope.

## Security Decisions

- Selected text and LLM output are untrusted data. The model receives no application tools or secrets.
- URL validation is defense in depth for the trusted renderer-to-main boundary; it does not attempt DNS-based endpoint allowlisting because users configure self-hosted providers.
- The local Ollama and vLLM defaults remain loopback HTTP endpoints.
- API-key encryption and trusted IPC sender checks remain unchanged.

## Acceptance Criteria

- Provider result extraction preserves meaningful boundary whitespace and rejects whitespace-only results.
- Provider request tests prove source text is supplied as a dedicated user message and cannot close an application delimiter.
- Over-limit selected text fails before a provider call and restores the previous clipboard value.
- Invalid, credential-bearing, and remote HTTP URLs are rejected by the shared and main-process paths; loopback HTTP and remote HTTPS are accepted.
- Settings disclose non-loopback data transmission.
- Prettify cache keys do not include source text and entries expire after the configured TTL.
- Focused tests, type checks, formatting, lint, the full test suite, production audit, and production build pass.

## Out of Scope

- New providers, model APIs, preview/diff UI, remote endpoint DNS allowlists, and changes to clipboard semantics.
