# Form highlights and GTM runtime exploratory review

Date: 2026-08-22

Build: `fix/form-highlights-gtm-runtime` working tree before final commit.

Environment: Playwright Chromium 1234 on Linux, unpacked extension from `apps/extension/dist`, local fixture and API services only.

## Scenarios exercised

### Ambiguous form target

Entered `Track leads from a form` on the two-form fixture. Both Contact sales and Newsletter signup received numbered candidate highlights that matched the assistant actions. Selecting Contact sales removed the Newsletter highlight and changed Contact sales to the confirmed green state. The highlights contained only form labels and stable target IDs; no field values were rendered.

### Runtime absent

Confirmed navigation scope on the ordinary fixture. The evidence path separately reported that no setup had been generated, no GTM container was detected, browser verification had not run, and platform confirmation remained unverified.

### Runtime detected

Repeated the navigation journey on the deterministic local fixture containing a script URL with `GTM-TEST123`. The evidence path reported `Detected GTM-TEST123` while setup generation remained pending and platform confirmation remained unverified.

### Adversarial target label

Changed a page-owned navigation label to a literal HTML payload before discovery. The highlight displayed the payload as text, created no image or script element, and executed no handler.

## Visual review

- `form-candidate-highlights-linux.png`: both form boundaries and labels are visible; the assistant actions correspond to the numbered page targets.
- `form-confirmed-highlight-linux.png`: only Contact sales remains highlighted and its confirmed treatment is distinct.
- `assistant-evidence-path-linux.png`: generation, runtime observation, browser verification, and platform confirmation are readable as separate stages.

## Findings

No blocker or high-severity findings remain for this slice.

## Review result

Result: passed. EXP-01 and EXP-02 from `2026-08-22-conversation-intake.md` are resolved.
