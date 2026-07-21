## Summary

The dashboard Test panel's model-list fetch (`GET /api/v1/providers/{id}/models`) returns `invalid_provider` for local self-hosted providers (Ollama, LM Studio, vLLM, etc.), making the provider Test panel unusable for them — even though `/v1/models` serves those same models fine.

Root cause: the route resolves the provider ID through `getRegistryEntry()` from the open-sse provider registry, which doesn't include `LOCAL_PROVIDERS`. Local providers are defined in `src/shared/constants/providers/local.ts` and never appear in the open-sse `REGISTRY`.

Fix: after `getRegistryEntry()` misses, fall back to the dashboard-facing provider catalog (`getProviderById` / `getProviderByAlias` from `@/shared/constants/providers`), which covers `LOCAL_PROVIDERS` (and all other dashboard provider categories). Registry hits retain their current precedence.

## Related Issues

- Closes #7910

## Validation

- [x] `npm run lint` — clean on both touched files (eslint)
- [x] `npm run test:unit` — 13/13 tests pass across both related test files
- [ ] `npm run test:coverage` — timed out on this VM (full suite too heavy), but c8 on affected file shows 90.43% stmts / 75% branch — well above 60% gate
- [x] Coverage is still `>= 60%` for statements, lines, functions, and branches
- [ ] SonarQube PR analysis is green or any remaining issues are explicitly documented below

## Tests Added Or Updated

- `tests/unit/provider-scoped-models-route.test.ts` — 3 new test cases:
  - `ollama-local` (canonical ID) — asserts NOT 400, NOT `invalid_provider`
  - `ollama` (alias) — same assertions
  - `lm-studio` (another local provider by ID) — same assertions

## Coverage Notes

- Only `src/app/api/v1/providers/[provider]/models/route.ts` changed. c8 on the affected file: 90.43% statements, 75% branches, 66.66% functions — all above the 60% gate.
- Uncovered lines (10-17: OPTIONS handler, 77-78: null payload guard, 88: dedup loop continue) are pre-existing, not introduced by this change.

## Reviewer Notes

- Low risk: purely additive fallback in the `else` branch when `getRegistryEntry()` misses. The existing registry path is completely unchanged. All 5 pre-existing tests pass without modification.
- The catalog fallback (`getProviderById ?? getProviderByAlias`) implicitly resolves any provider in the dashboard catalog (local, search, audio-only, etc.). Downstream filtering (`owned_by === providerId`) returns empty model lists for non-model-serving providers, so this is harmless — but worth noting.
