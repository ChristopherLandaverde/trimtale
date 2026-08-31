# Add a closed `commit` command (staging stays manual)

Status: resolved

## Objective

`git commit` currently sits outside `npm run agent`, so it re-triggers
authorization every time, even for routine commits on a feature branch during
the accepted delivery loop (`docs/engineering/delivery-harness.md`'s
"accepted spec -> ... -> implementation plus permanent regression -> change
record and issue update -> ..." cycle already expects frequent commits).

This adds exactly one new closed command, `commit`, scoped deliberately
narrower than "add and commit":

- **Staging stays out of the harness.** `git add` is not added here. A fixed
  `git add -A` would blindly stage whatever happens to be sitting in the
  working tree — including, concretely, `apps/verification-target/.env.local`
  and `apps/verification-target/.vercel/project.json`, which are untracked
  debris in this very repo right now (see
  `.scratch/security-review-findings/issues/01-api-cors-wildcard-default.md`'s
  context). Staging is exactly the point where a human or agent should look
  at what's about to enter history, so `git add <specific paths>` keeps
  requiring its own authorization, same as today.
- **`commit` only commits what is already staged**, using a fixed message
  source rather than a free-form CLI argument, so the command still takes no
  arguments and the allowlist stays closed.

## Regression contract

Required test level: deterministic unit/behavioral test under the ordinary
`npm test` gate, extending `scripts/agent-harness.test.ts`.

Required invariants:

- Positive: `commit` resolves to a fixed invocation that commits the current
  index using a message read from a fixed, repo-relative path (e.g.
  `.scratch/commit-message.md`), not from a shell argument.
- Negative: the command refuses (non-zero exit, no commit created) when the
  message file is missing or empty.
- Negative: the command refuses when the current branch is `main` — commits
  land on feature branches only, matching this repo's actual history (every
  existing commit under `git log` was made on a `feature/*` branch and merged
  via PR).
- Negative: the command refuses when nothing is staged (`git diff --cached
  --quiet` is non-empty), so it cannot silently create an empty commit or
  accidentally commit an unrelated stray stage.
- The existing "keeps risky executable surfaces outside the allowlist" test
  continues to pass with the new entry included; `git push` must not appear
  anywhere in the allowlist.

## Work

- Add a `commit` entry to the `commands` map in `scripts/agent-harness.mjs`.
  Because this command has real preconditions (message file present, index
  non-empty, not on `main`) rather than a single fixed argument list like the
  other entries, it likely needs its own small wrapper function rather than
  reusing the plain `spawnSync(executable, args)` shape the other commands
  use — keep that wrapper's checks in `agent-harness.mjs` itself so they stay
  covered by the same test file.
- Document the fixed message-file convention (path, and that it is deleted or
  must be rewritten before the next commit) in the README's "Agent command
  harness" section.
- Extend `scripts/agent-harness.test.ts` per the regression contract above.
- Add a concise change record.

## Done when

- The regression contract runs in `npm test`.
- `npm run verify` passes.
- README documents the fixed message-file convention and that staging
  (`git add`) remains outside the harness by design.

## Resolution Notes

- Added `npm run agent -- commit`, which commits only the already-staged index with
  message file `.scratch/commit-message.md`.
- The harness refuses to commit when the message file is missing or empty, the branch
  is `main`, or no staged diff exists.
- A successful harness commit deletes `.scratch/commit-message.md`; the file is
  ignored so it does not become a tracked scratch artifact.
- `git add` and `git push` remain outside the harness.
- `scripts/agent-harness.test.ts` covers the exact command mapping, missing/empty
  message file failures, main-branch refusal, no-staged-diff refusal, argument
  rejection, and post-commit message-file cleanup.
