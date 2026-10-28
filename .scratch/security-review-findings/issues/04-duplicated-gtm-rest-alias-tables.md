# Duplicated GTM REST alias tables between change-plan and Google client

Delivery mode: implementation
Status: resolved

## Production outcome

Semantic change planning and outgoing Google Tag Manager REST requests use one shared
definition for import-notation aliases, so a supported alias cannot drift between
comparison and application.

## Non-goals

- Changing supported GTM entities, alias values, or user-visible behavior.
- Accessing a live Google account or container.
- Publishing, pushing, merging, or changing repository settings.

## Authorization

Christopher explicitly authorized this issue as the first supervised workflow pilot
on 2026-09-30.

## Context

`packages/core/src/change-plan.ts:56-83` (`propertyAliases`, `parameterKeyAliases`,
`gtmValueAliases`) and `apps/api/src/google.ts:1320-1347`
(`googleRestPropertyAliases`, `googleRestParameterKeyAliases`,
`googleRestStringAliases`) define the same GTM import-notation-to-REST-notation
alias tables twice, with identical keys and values (e.g.
`PAGE_URL`/`pageUrl`, `JUST_LINKS`/`linkClick`, `measurementId`/
`measurementIdOverride`, `eventParameters`/`eventSettingsTable`,
`autoEventFilter`/`filter`).

`git blame` shows both copies were authored in the same commit
(`f386fd97`, 2026-08-23 00:22:59, "Build semantic GTM change planner"), by the
same author, and have not been reconciled since — this is a copy-paste at
authoring time, not a documented or intentional split.
`docs/engineering/tracking-change-plan.md` documents that "Generated container
imports and GTM REST responses use different notation for the same values"
and that entity writes must use the REST representation, but it never states
the alias data itself is deliberately kept as two separate copies.

The two tables serve different purposes today (one feeds
`canonicalize()`'s semantic-equivalence comparison used to decide
`create`/`reuse`/`no_op`/`conflict`; the other feeds `googleRestValue()`'s
construction of the literal REST body sent to Google), but the underlying
alias data — which GTM enum spelling maps to which REST spelling — is the
same fact and must always be. If a future GTM API change adds or renames an
alias and only one table is updated, the two sides go out of sync silently:
the change-plan could compute `no_op` (nothing to apply) for an entity whose
REST body construction would in fact produce different field values than
what's live, or the reverse — a spurious `create`/`update` action for an
entity that Google would already consider equivalent. Either way the drift
is undetectable by inspection of either file alone, since each looks
internally consistent.

## Regression contract

Required test level: deterministic unit test under the ordinary `npm test`
gate.

Required invariants:

- Positive: the alias tables used by `packages/core`'s semantic comparison
  and `apps/api/src/google.ts`'s outgoing REST body construction are the same
  values, verified by importing both from one shared source rather than by a
  test that merely compares two independently-maintained literals.
- Regression: adding a new alias to the shared table is automatically
  reflected on both the comparison side and the REST-construction side with
  no second edit required — provable by a test that adds a canary alias
  mapping and asserts both `canonicalize()` (or its semantic-signature output)
  and `googleRestValue()`/`googleRestString()` honor it identically.

## Work

- Move `propertyAliases`, `parameterKeyAliases`, and `gtmValueAliases` out of
  `packages/core/src/change-plan.ts` into one exported location in
  `packages/core` (e.g. alongside the existing `change-plan.ts` exports, or a
  new small module if that reads better).
- Delete `googleRestPropertyAliases`, `googleRestParameterKeyAliases`, and
  `googleRestStringAliases` from `apps/api/src/google.ts`; import the shared
  tables from `@gtm-observability/core` instead, keeping `googleRestValue()`
  and `googleRestString()`'s own logic (they apply the tables differently
  from `canonicalize()`, which is fine — only the alias *data* needs to be
  shared).
- Add the regression test above.
- Add a concise change record.

## Done when

- Exactly one definition of each alias table exists in the codebase.
- `apps/api/src/google.ts` has no locally-defined alias `Map`s of its own.
- The regression contract runs in `npm test`.
- `npm run verify` passes.

## Comments

- 2026-09-30: Claimed as the first supervised workflow pilot. Added a failing
  regression for a missing shared alias export, consolidated the three tables into
  `packages/core/src/gtm-rest-aliases.ts`, and passed 19 focused planning/application
  tests. Full verification remains pending.
- 2026-09-30: The canary regression now proves one added string alias controls both
  semantic reuse and the outgoing REST body. `npm run verify` passed 483 deterministic
  tests and all 95 Chromium journeys. No live Google resource was accessed.
