# Real Google Testing Lane

This lane exercises the Phase 1 workflow against disposable Google Tag Manager
resources. It is separate from ordinary CI and `npm run verify`.

## Boundaries

- Use only disposable GTM containers and disposable site fixtures.
- Keep real Google writes out of ordinary local verification and CI.
- Treat publication OAuth consent and publication execution as separate controls.
- Treat browser-observed Google collection requests as browser verification only.
- Do not claim GA4, Google Ads, reporting, attribution, or downstream platform
  confirmation from extension/network evidence.
- Never paste OAuth client secrets, refresh tokens, access tokens, cookies, or raw
  credential payloads into issues, specs, logs, commits, or screenshots.

## Credential Readiness

Run these checks before any credentialed dry run:

```bash
npm run preflight:google
npm run preflight:publication
```

Required local settings for read/discovery sessions:

```bash
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:18787/api/google/oauth/callback
```

Required local setting for guarded container-write sessions:

```bash
GOOGLE_GTM_CONTAINER_WRITES_ENABLED=true
```

Optional owner-only token persistence:

```bash
GOOGLE_OAUTH_TOKEN_STORE=.data/google-oauth-token.json
```

Publication consent and execution are intentionally independent:

```bash
GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED=true
GOOGLE_GTM_PUBLICATION_ENABLED=true
```

`GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED=true` may include Google's publish scope in
the OAuth consent session. It does not by itself allow the product to publish.
`GOOGLE_GTM_PUBLICATION_ENABLED=true` should be present only for the approved
disposable publication or rollback session.

## Disposable Dry Run

Use this lane before any real publication.

1. Start from a disposable fixture page that loads the disposable GTM container.
2. Open the assistant and confirm the tracking specification.
3. Check GTM access from the visible assistant.
4. Prepare or reuse the managed workspace.
5. Start the setup operation.
6. Let the operation apply owned entities, validate the workspace, and create an
   immutable version.
7. Stop at `versioned`.

Record:

- disposable container public ID;
- operation ID;
- managed workspace path and fingerprint;
- immutable version fingerprint;
- prior live version fingerprint;
- any blocked reason and recovery step.

Pass condition:

- The operation reaches `versioned`.
- No publication route is called.
- The assistant displays exact fingerprint approval as the next step.

## Approved Publication Smoke

Use this lane only after the dry run reaches `versioned`.

1. Confirm `GOOGLE_GTM_PUBLICATION_ENABLED=true` for this approved session.
2. Compare the assistant's immutable version fingerprint to the recorded value.
3. Approve publication only for that exact fingerprint.
4. Publish from the visible assistant.
5. Start browser verification from the visible assistant.
6. Perform the confirmed page interaction once.
7. Confirm the operation reaches `completed`.

Record:

- approved immutable version fingerprint;
- publication timestamp or returned publication evidence;
- browser evidence run ID;
- sanitized Google collection request URL;
- confirmation that the assistant says `Platform confirmation unavailable`.

Pass condition:

- Exactly one expected Google collection request is observed.
- The operation reaches `completed`.
- No private form values, cookies, credentials, arbitrary page labels, or hostile URLs
  enter persisted evidence or assistant messages.
- No platform-confirmation claim appears.

## Rollback Drill

Use this lane with a controlled failed browser-verification setup.

1. Publish an approved disposable version.
2. Run browser verification against a controlled failing fixture.
3. Confirm the operation reaches `rollback_required`.
4. Compare the assistant's rollback target to the recorded prior live fingerprint.
5. Approve rollback only for that exact target fingerprint.
6. Confirm the operation reaches `rolled_back`.

Pass condition:

- No autonomous rollback occurs.
- Rollback restores the recorded prior live fingerprint.
- The operation records `rolled_back`.
- Platform confirmation remains unavailable.

## Stop Conditions

Stop and create or update an issue when any of these occurs:

- the observed container is not uniquely recognized;
- the managed workspace is unavailable, human-owned, over capacity, stale, or in sync
  conflict;
- validation fails;
- the immutable version fingerprint does not match the approval target;
- the live container fingerprint changes unexpectedly before publication or rollback;
- browser verification is inconclusive;
- any credential, cookie, private form value, or raw secret-bearing error appears in
  logs, persisted evidence, screenshots, or assistant messages.

## Platform Confirmation Decision

Platform confirmation cannot be accepted from this lane. A separate decision must
choose and verify a destination-side evidence source before the product can claim
platform receipt.

Candidate sources to evaluate separately:

- GA4 DebugView;
- GA4 reporting or Data API;
- BigQuery export;
- Google Ads diagnostics;
- another platform-owned receipt API.
