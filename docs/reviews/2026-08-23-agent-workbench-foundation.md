# Agent workbench foundation exploratory review

Date: 2026-08-23

## Environment

- Linux workspace with the production extension build loaded unpacked in managed
  Chromium.
- Deterministic API, Northstar fixture site, and disposable verification target on the
  repository-owned loopback ports.
- 380px-wide floating workbench expanded to its 520px active-task height.
- Google/GTM/GA4 responses supplied only by strict local route fixtures; no real
  credential, workspace mutation, Analytics write, or publication action was used.

## Scenarios reviewed

### Supported task and approval

Entered `Track leads from the contact form`, inspected both highlighted forms, selected
Contact sales, reviewed the structured `generate_lead` setup, and approved it. One
`Agent task` region remained throughout. The plan advanced from target selection to the
approval checkpoint and then browser verification. Page inspection and connected
measurement context appeared as receipts; no account or container question was asked.

Downloaded the reviewable container import and confirmed that the task said nothing
was applied or published. A successful fixture submission ended with `Completed`, a
passed browser result, an unverified platform boundary when Analytics reads were not
available, and no submitted field value inside the workbench.

### Connected GA4 confirmation

Repeated the form task with exact Agency / Lead site / `GTM-TEST123` /
`G-EXACT123` context. Browser verification passed from one observed `generate_lead`
request. A separately mocked pre-run Realtime baseline increased from four to five and
the task/evidence path reported platform confirmation as passed with aggregate-only
correlation language.

### Negative and unsupported paths

Ran the validation fixture. The task ended `Blocked`, kept the failed attempt out of
the lead count, displayed the corrective next action, and offered a bounded retry
instead of claiming success. Sent `Track phone calls`; the same task surface reported
`Not supported`, exposed no setup approval, and left the composer usable. Also reviewed
the offline GTM card: it clearly separated unavailable account/container proof from an
otherwise usable agent.

### Ambiguous and adversarial input

Reviewed two target candidates and ambiguous, duplicate, and ID-less success signals.
The agent requested the missing business decision or stopped with an honest blocker;
it did not invent a selector or success signal. Provider fixtures supplied markup-shaped
account/container names and a private raw-error sentinel. Names rendered as inert text,
no `img` or `script` node appeared, and the raw error, submitted email value, selectors,
and success-signal internals were absent from the agent turn.

## Visual review

- `form-candidate-highlights-linux.png` shows both numbered page targets and one compact
  task with the current decision.
- `form-confirmed-highlight-linux.png` shows the full goal, status, plan, receipts, and
  review action after the selected target turns green.
- `gtm-context-matched-linux.png` and `gtm-context-offline-linux.png` show usable
  pre-task states with exact connected or unavailable context.
- `connected-verification-evidence-linux.png` keeps browser and aggregate platform
  confirmation as separate evidence stages and now says `What the agent used`.
- Complete and blocked final screenshots kept the current status and summary visible;
  longer structured receipt detail remains scrollable without horizontal overflow.

## Findings

1. Medium, resolved: the first workbench draft retained the old 420px response height,
   clipping the task goal after target selection. Active tasks now expand to 520px, and
   the reviewed candidate/confirmed baselines protect the full header and plan.
2. Medium, resolved: the shell accessibility label and evidence subtitle still called
   the product an assistant. Visible labels now use `Tracking agent` and
   `What the agent used`; the browser journey asserts the agent label.
3. No blocker or high-severity finding remains. No unresolved finding invalidates the
   accepted task-centered outcome, approval boundary, evidence semantics, or privacy
   boundary.
