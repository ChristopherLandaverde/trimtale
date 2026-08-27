# Run the credentialed Calendly production pilot

Delivery mode: external validation
Status: deferred by user

## Production outcome

Prove the completed Calendly adapter on one authorized real website, one real Calendly
inline booking, one disposable or explicitly approved GTM workspace, and the intended
GA4 property without weakening any review, Preview, version, publication, or privacy
gate.

## Entry criteria

- The user chooses the authorized website, GTM container, GA4 property, and Calendly
  event used for the pilot.
- The page contains exactly one supported `https://calendly.com` inline embed with
  `embed_type=Inline`.
- Google edit access, Analytics access, and any publication authority are explicitly
  enabled only for the pilot identities and targets.
- A test booking may be created without affecting a customer or production reporting
  process, or the user explicitly accepts that effect.

## Evidence checklist

1. The website agent recognizes the one supported embed and displays the exact origin,
   source, provider event, normalized event, scope, consent, and privacy boundary.
2. The reviewed listener and GA4 tag are applied only to the approved managed
   workspace and pass provider validation.
3. Exact Tag Assistant Preview is bound to the approved container, workspace draft,
   and target page.
4. One real Calendly test booking emits one `calendly_booking_complete` data-layer
   event and one matching GA4 request without retaining callback payload fields.
5. An immutable version is created only from the passing exact draft. Publication,
   if included in the pilot, requires its own version-bound approval and a passing live
   run; otherwise the version remains unpublished.
6. The run records timestamps, fingerprints, visible screenshots, provider receipts,
   browser evidence, and any discrepancy without storing invitee details.

## Failure and cleanup

- Any origin, source, event, target, container, workspace, or fingerprint mismatch
  stops the pilot without a success claim.
- Failed or inconclusive Preview evidence creates no version.
- Failed live evidence follows the existing explicit rollback gate; it never rolls
  back automatically.
- Test booking cleanup and any unpublished managed-workspace residue are reviewed with
  the user after the run. No unrelated Calendly, GTM, or GA4 state is changed.

## Non-goals

- Treating deterministic local callback fixtures as real-provider proof.
- Expanding support to direct iframes, popup widgets, multiple embeds, or other
  scheduling providers during the pilot.
- Publishing merely because Preview passed.
- Collecting invitee email, event URI, scheduled time, or arbitrary callback payload.

## Authorization state

On 2026-08-27 the user chose to defer this credentialed pilot and return to it later.
This records the gate but does not authorize a booking, GTM/GA4 mutation, version
publication, or external cleanup operation.
