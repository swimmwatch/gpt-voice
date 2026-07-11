# Task List: Browser Navigation Retry

## Task 1: Add Bounded Navigation Retry

**Acceptance criteria:**

- [x] Four total navigation attempts use 500 ms, 1 s, and 2 s exponential delays with bounded jitter.
- [x] Only classified transient network failures retry.
- [x] Tests prove safe retry metadata and deterministic delays.

**Files likely touched:**

- `src/main/browserNavigationRetry.ts`
- `tests/main/browserNavigationRetry.test.ts`

## Task 2: Present Network Failures Safely

**Acceptance criteria:**

- [x] `ERR_NETWORK_CHANGED` becomes the existing localized connection-failure message.
- [x] Browser terminal errors do not expose Playwright call logs or URLs.

**Files likely touched:**

- `src/shared/notifications.ts`
- `src/main/i18n/en.ts`
- `src/main/i18n/ru.ts`
- `src/main/i18n/uk.ts`
- `src/main/i18n/be.ts`
- `tests/shared/notifications.test.ts`

## Task 3: Apply Retry To Browser Pages

**Acceptance criteria:**

- [x] ChatGPT Web and Google Translate navigation recover from a transient network change without restarting.
- [x] Logs identify retry attempts with safe metadata.
- [x] Existing browser status semantics remain unchanged after success or terminal failure.

**Files likely touched:**

- `src/main/browser.ts`
- `tests/main/browserNavigationRetry.test.ts`

## Verification

- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test:types`
- [x] `npm test`
- [x] `npm run validate:dependabot`
- [x] `npm run audit:prod`
- [x] `npm run build:prod`
