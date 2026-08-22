# Persist verified resolutions for later retrieval

Status: resolved

Blocked by: 07, 08

## Objective

Create the safe data boundary for future intelligence without implementing automatic rule changes or model training.

## Regression contract

Required test level: API persistence and privacy tests backed by a schema-validated acceptance fixture.

Acceptance fixture: `tests/acceptance/verified-resolution-foundation.json`

Behavioral test target: `apps/api/src/verified-resolutions.test.ts`

Required invariants:

- A resolution cannot be stored without human confirmation, a confirmed cause, a corrective action, and linked before-and-after evidence.
- The before run must be non-passing and the after run must be passing.
- Persisted resolution data must exclude submitted form values, cookies, credentials, and arbitrary page text.
- Saving or retrieving a resolution must not add, remove, or change deterministic verdict rules.
- Unknown schema versions and references to missing evidence must be rejected.

## Work

- Define a versioned verified-resolution contract.
- Require a confirmed cause, corrective action, and linked before-and-after run evidence.
- Store normalized environment attributes without personal information.
- Expose read and write operations suitable for later similarity retrieval.
- Load the committed acceptance fixture in the persistence test rather than duplicating its cases.

## Done when

- An incomplete or unconfirmed diagnosis cannot become a verified resolution.
- A resolution links failing and passing evidence artifacts.
- No production verdict rule changes automatically.
- Persistence and privacy tests pass under `npm run verify`.
- `apps/api/src/verified-resolutions.test.ts` consumes every acceptance case with no skips.

## Comments

- 2026-08-22: Claimed after Issue 08 merged. The behavioral test now consumes ten acceptance cases, including confirmation, missing/mismatched evidence, before/after ordering, schema rejection, and privacy sentinels.
- 2026-08-22: Added a versioned verified-resolution contract and file-backed API repository. Focused acceptance and persistence tests pass; full completion verification remains in progress.
- 2026-08-22: Persistence review added a fail-closed regression for unknown collection schemas. The repository reopens accepted records, ignores arbitrary customer-data fields, and leaves deterministic verdict output unchanged.
- 2026-08-22: Final `npm run verify` passed with 100 deterministic tests and 22 Chromium workflows.

## Answer

A verified resolution is now a versioned, human-confirmed record linking one non-passing run to one passing run through a controlled confirmed cause and corrective action. The API repository writes an atomic, owner-readable JSON collection, exposes save/get/list operations for later retrieval, derives only normalized environment attributes from run evidence, and rejects incomplete, inconsistent, missing, or unsupported-schema inputs. It does not train a model or mutate deterministic verdict rules.
