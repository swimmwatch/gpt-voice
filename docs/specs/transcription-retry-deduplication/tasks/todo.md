# Tasks: Transcription Retry Deduplication

## Task 1: Build the binary-aware successful-result cache

**Description:** Create a transcription-specific cache/key module that hashes exact audio bytes and composes provider context with the existing bounded LRU/TTL cache conventions. This establishes privacy, capacity, and expiry behavior before provider integration.

**Acceptance criteria:**

- [ ] Separate `ArrayBuffer` objects with identical bytes and context produce the same opaque key; byte, MIME, provider, or context changes produce different keys.
- [ ] Only non-empty successful text can be stored, with capacity 10 and TTL 5 minutes using deterministic clock fixtures.
- [ ] Raw audio, transcript text, prompt text, digest, and cache keys are neither persisted nor logged.

**Verification:**

- [ ] Tests pass: `node --import tsx --test tests/main/transcriptionResultCache.test.ts`
- [ ] Types pass: `npm run typecheck`
- [ ] Lint passes: `npm run lint`

**Dependencies:** Approved cache-policy defaults.

**Files likely touched:**

- `src/main/services/transcriptionResultCache.ts`
- `tests/main/transcriptionResultCache.test.ts`

**Estimated scope:** Small: 2 files.

## Task 2: Add provider-specific transcription cache context

**Description:** Define the provider contract that describes result-affecting settings without exposing credentials, then implement and test the OpenAI context while preserving the fixed ChatGPT context.

**Acceptance criteria:**

- [ ] `BaseVoiceProvider` exposes a stable default transcription cache context suitable for fixed providers.
- [ ] OpenAI context changes with model, language, prompt, or temperature and never contains the API key.
- [ ] Existing provider lifecycle and transcription behavior remain unchanged.

**Verification:**

- [ ] Tests pass: `node --import tsx --test tests/main/providers/BaseVoiceProvider.test.ts tests/main/providers/OpenAIApiVoiceProvider.test.ts`
- [ ] Types pass: `npm run typecheck`
- [ ] Lint passes: `npm run lint`

**Dependencies:** Task 1.

**Files likely touched:**

- `src/main/providers/BaseVoiceProvider.ts`
- `src/main/providers/OpenAIApiVoiceProvider.ts`
- `tests/main/providers/BaseVoiceProvider.test.ts`
- `tests/main/providers/OpenAIApiVoiceProvider.test.ts`

**Estimated scope:** Medium: 4 files.

## Task 3: Deduplicate completed transcription requests

**Description:** Integrate cache lookup and insertion into the main transcription service. Preserve provider readiness, safe errors, clipboard writes, and history recording while proving that an identical successful retry avoids the provider call.

**Acceptance criteria:**

- [ ] First success calls the provider once and caches non-empty text; a sequential identical request returns the text without another provider call.
- [ ] Cache hits preserve clipboard and history side effects, while failures, thrown errors, and empty results never populate the cache.
- [ ] Cache/key errors fall back to the provider path, and logs contain no transcript, prompt, credential, digest, key, raw audio, or full response.

**Verification:**

- [ ] Tests pass: `node --import tsx --test tests/main/transcriptionResultCache.test.ts tests/main/transcription.test.ts`
- [ ] Existing retry-state tests pass: `node --import tsx --test tests/renderer/recordingRetryState.test.ts`
- [ ] Types and lint pass: `npm run typecheck && npm run lint`

**Dependencies:** Tasks 1 and 2.

**Files likely touched:**

- `src/main/services/transcription.ts`
- `tests/main/transcription.test.ts`

**Estimated scope:** Small: 2 files.

## Checkpoint: After Tasks 1-3

- [ ] Focused cache, provider, transcription, and retry tests pass.
- [ ] Exactly one provider call is observed for two sequential identical successful requests.
- [ ] IPC request/result types and renderer retry behavior are unchanged.
- [ ] Review the core behavior before documentation and final verification.

## Task 4: Document privacy and cache policy

**Description:** Document the approved memory-only cache behavior, retention limits, and non-persistence guarantee in timeless user-facing language, then update the specification if any planning defaults changed.

**Acceptance criteria:**

- [ ] README states that successful retry results may be retained only in process memory for the approved TTL/capacity.
- [ ] Documentation states that audio is hashed for lookup but never retained by the cache, and entries disappear on restart.
- [ ] The spec reflects the final history, readiness, and in-flight decisions with no unresolved implementation ambiguity.

**Verification:**

- [ ] Documentation review confirms no promises beyond implemented behavior.
- [ ] Formatting passes: `npx prettier --check README.md docs/specs/transcription-retry-deduplication/**/*.md`

**Dependencies:** Task 3 and approved policy decisions.

**Files likely touched:**

- `README.md`
- `docs/specs/transcription-retry-deduplication/spec.md`

**Estimated scope:** Small: 2 files.

## Task 5: Complete integration verification and handoff

**Description:** Apply the project Definition of Done, record evidence and residual platform risk, and prepare the feature for human review without pushing or publishing.

**Acceptance criteria:**

- [ ] All specification success criteria and Definition of Done correctness, quality, integration, documentation, security, and observability checks are satisfied.
- [ ] Manual retry smoke test confirms that the second identical request succeeds without a provider transcription call.
- [ ] Handoff records completed tasks, changed files, checks, manual verification, and remaining blockers only.

**Verification:**

- [ ] Full gate passes: `npm run format:check && npm run lint && npm run typecheck && npm run test:types && npm test`
- [ ] Supply chain/build gate passes: `npm run audit:prod && npm run build:prod`
- [ ] Diff check passes: `git diff --check`

**Dependencies:** Task 4.

**Files likely touched:**

- `docs/specs/transcription-retry-deduplication/tasks/handoff.md`

**Estimated scope:** Extra small: 1 file plus verification.

## Checkpoint: Complete

- [ ] All five tasks are complete.
- [ ] No secrets, sessions, audio, transcripts, prompts, cache keys, or digests appear in logs or repository artifacts.
- [ ] No dependency, IPC, packaging, or release change was introduced outside approved scope.
- [ ] Human review completed before merge or deployment.
