# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file
- Specs and issues record `Delivery mode: discovery`, `Delivery mode: specification`,
  or `Delivery mode: implementation` near the top. Missing mode defaults to discovery.
- Triage state is recorded as a `Status:` line near the top of each issue file
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Delivery mode transitions

Delivery mode records the current commitment, not the eventual ambition:

- `discovery` — learn, compare, or demonstrate with the smallest reversible artifact;
- `specification` — agree on behavior, examples, boundaries, and acceptance criteria;
- `implementation` — change supported product behavior and run the production harness.

An accepted spec remains `specification` until the user explicitly authorizes building
it. An agent must not infer that authorization from `Status: accepted`, completed
research, a convincing example, or an available next issue.

Before changing a file to `Delivery mode: implementation`, record these sections:

- `## Production outcome` — the exact behavior intended to ship;
- `## Non-goals` — adjacent behavior that must not be pulled into the slice;
- `## Authorization` — the user request or explicitly selected implementation issue;
- `## Regression contract` — evidence required by the repository harness.

If implementation discovers an unnamed new layer, domain concept, generalized harness,
or adjacent workflow, leave it out or return the issue to specification for an explicit
scope decision. Do not silently widen the current ticket.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/`, creating the directory if needed.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer to the map's Decisions-so-far in `map.md`.
