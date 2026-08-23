# Add the read-only intake evaluation report API

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/18-intake-evaluation-report-api.md`

## Summary

The loopback API now exposes extension-origin-protected GET routes for newest-first
intake evaluation summaries and one complete validated compact report.

## Why

The frontend needs stable report evidence without receiving credentials or gaining a
network path that can trigger model spend or mutate the owner-operated report store.

## Behavior

`GET /api/intake-evaluations` returns a versioned list of aggregate provider outcomes,
scores, latency, and usage with case rows omitted. `GET
/api/intake-evaluations/:reportId` returns the selected validated compact report.

The route reopens the collection per request, treats missing storage as empty, returns
404 for unknown IDs and 405 for recognized non-GET methods, and reduces all corrupted,
unsupported, invalid, or duplicate collection failures to one generic 503 response.
Reads do not change the file.

Report routes now share the exact configured extension-origin CORS boundary. No
provider, runner, command, credential, report write, GTM mutation, publication behavior,
or extension UI is added.

## Regression coverage

`apps/api/src/intake-evaluation-api.test.ts` protects empty storage, newest-first
summary shape, case omission, complete detail, privacy exclusions, no-write reads,
per-request refresh, unknown IDs, invalid shapes, read-only methods, and generic
corrupted, unsupported, invalid, and duplicate collection failures.

`apps/api/src/cors.test.ts` protects exact extension-origin behavior for list and
detail paths, including missing, wildcard, null, attacker, prefix, suffix, and
originless cases.

`tests/e2e/intake-evaluation-api.spec.ts` exercises the built loopback server with the
configured browser origin, an originless local read, an attacker origin, a rejected
write, and byte-for-byte unchanged fixture storage.

## Verification

Focused API and CORS coverage passed 10 tests, and API strict TypeScript checking
passed. `npm run verify` passed local preflight, change documentation, every workspace
build and strict check, all 264 deterministic tests across 37 files, and all 27
Chromium workflows including the built-server report boundary. No provider command or
external request ran.

## Exploratory review

Not applicable. This slice adds a local read-only JSON API but no visible browser
surface. The next frontend slice will receive automated and exploratory visual review.

## Documentation

The accepted conversational tracking specification, intake interpretation engineering
guide, current capabilities, and issue 18 document the routes, response split, refresh,
privacy, failure, CORS, and no-execution boundaries.
