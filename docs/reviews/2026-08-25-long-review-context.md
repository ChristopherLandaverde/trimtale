# Long-review context review

Date: 2026-08-25

Build: current production extension after `npm run verify`.

Target: deterministic local email-link page in Chromium at the compact overlay's
default size.

## Scenarios

1. Opened the long privacy and firing-scope review for one observable email link.
2. Scrolled within the overlay to the unchanged setup-approval action.
3. Requested email tracking on a page with no observable email link.
4. Used a `mailto:` destination and visible label containing attacker-shaped values.

## Evidence

- The long review opened at the task status, goal, summary, plan, receipts, and review
  heading rather than below them.
- The review body continued below the viewport and the approval remained reachable
  through ordinary overlay scrolling.
- The blocked no-target state kept its current task fully visible and exposed no
  review or approval action.
- The page retained its confirmed email marker. Private destination and attacker-
  shaped text remained absent from the task.

## Findings

- No blocker or high-severity finding remains.
