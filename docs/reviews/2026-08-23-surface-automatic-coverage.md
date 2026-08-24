# Automatic coverage task review

Date: 2026-08-23

Build: `feat/semantic-navigation-scopes` before commit.

## Scenarios

1. Primary: requested navigation tracking with automatic outbound clicks active. The
   main task showed `Partially covered`, explained the boundary, and offered only
   `Choose links` or `Cancel`.
2. Confirmed lead: requested lead tracking with automatic form interactions active.
   The task showed `Needs custom setup` and explained that starts/submits do not prove
   a confirmed lead.
3. Negative: disabled the enhanced-measurement master switch. The task showed
   `Needs setup` before any generation action.
4. Adversarial: supplied malformed markup-bearing audit data. No provider text entered
   the task and the existing unaudited behavior remained usable.

## Evidence

- The built Chromium task snapshot was visually inspected.
- Automatic outbound coverage removes `Track all` and opens link selection with zero
  preselected links.
- Focused core tests passed four task cases.
- Focused Chromium tests passed 14 connection and confirmed-lead journeys.
- No Google API mutation or new scope was used.

## Findings

- Medium, resolved: the first task draft said outbound clicks were covered but still
  offered `Track all`. The shortcut was removed and selection now begins empty.
- No blocker, high, medium, or low finding remains.
