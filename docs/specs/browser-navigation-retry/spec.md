# Spec: Browser Navigation Retry

## Objective

Recover automatically when the persistent CloakBrowser context loses or changes network connectivity while opening ChatGPT Web or Google Translate. Users receive concise localized connection guidance rather than raw Playwright call logs and do not need to restart the app for transient network failures.

## Scope

- Retry only transient `page.goto` failures for ChatGPT Web and Google Translate.
- Use four total attempts with exponential backoff: 500 ms, 1 s, and 2 s before retries. Add bounded jitter to avoid synchronized retries.
- Do not retry authentication failures, invalid navigation, or non-network errors.
- Log safe retry metadata: destination service, attempt, maximum attempts, delay, and sanitized error metadata. Never log URLs, page content, cookies, access tokens, prompts, transcripts, or raw stack traces.
- Convert terminal browser-navigation failures to the existing localized connection-failure presentation.

## Commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run validate:dependabot
npm run audit:prod
npm run build:prod
```

## Project Structure

- `src/main/browser.ts`: persistent ChatGPT and Google Translate page navigation.
- `src/main/browserNavigationRetry.ts`: deterministic retry classification, delay calculation, and execution seam.
- `src/shared/notifications.ts`: user-safe error presentation.
- `src/main/i18n/*.ts`: localized browser connection copy.
- `tests/main/browserNavigationRetry.test.ts`: retry behavior and safe logging tests.

## Code Style

```ts
const result = await retryBrowserNavigation({
  navigate: () => page.goto(url, { waitUntil: 'domcontentloaded' }),
  service: BrowserNavigationService.ChatGPT,
});

if (!result.success) {
  throw new Error(result.userMessage);
}
```

Use explicit types, small pure helpers, scoped `electron-log`, and the existing `presentNotificationError` formatter. Keep retry state local to one navigation call.

## Testing Strategy

- Unit-test transient classification, exponential delay bounds, success after a retry, terminal failure, and non-retryable failure.
- Verify retry logs contain metadata but not raw error messages, URLs, or page contents.
- Extend notification tests to classify `ERR_NETWORK_CHANGED` as a readable connection failure.
- Run the full Node test, type, lint, formatting, audit, and production-build gates.

## Boundaries

- Always: preserve Electron/main-process ownership, sanitize user-facing and logged errors, and retry with bounded delays only.
- Ask first: add dependencies, change session persistence, alter global retry settings, or retry authentication/authorization errors.
- Never: expose browser internals, cookies, tokens, raw Playwright call logs, or user content in logs or notifications.

## Success Criteria

- `net::ERR_NETWORK_CHANGED` during ChatGPT or Google Translate navigation retries automatically and succeeds when a later attempt succeeds.
- A terminal transient failure yields a localized, human-readable connection error without a Playwright traceback.
- Retry logs are structured, sanitized, and identify service, attempt, and scheduled delay.
- Existing browser startup and translation behavior remains unchanged for non-network failures.

## Open Questions

None. Four attempts and a 3.5-second nominal retry budget balance recovery with fast feedback for a desktop background browser.
