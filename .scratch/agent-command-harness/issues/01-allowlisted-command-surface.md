# Add the allowlisted agent command surface

Status: resolved

## Objective

Provide one repository-owned entry point for routine local agent inspection and
verification while preserving explicit authorization boundaries for risky work.

## Regression contract

Required test level: deterministic unit/behavioral test under the ordinary
`npm test` gate.

Behavioral test: `scripts/agent-harness.test.ts`

Required invariants:

- Positive: every documented command resolves to its exact executable and fixed
  argument list, executes from the repository root, and returns the child's exit
  status.
- Negative: unknown commands and all extra user arguments are rejected before
  execution.
- Safety: the allowlist contains no package installation, arbitrary `npx`, remote
  Git, credentialed integration, shell interpreter, or destructive command.
- Usability: help is available without spawning a child process.

## Work

- Add the failing behavioral regression first.
- Implement the typed allowlist and command dispatcher.
- Expose it through `npm run agent` and document its authorization boundary.
- Add a concise change record.

## Done when

- The regression contract runs in `npm test`.
- Focused positive and negative cases pass.
- Documentation describes supported and deliberately excluded behavior.
- `npm run verify` passes.

## Comments

- 2026-08-22: Claimed for implementation. Regression contract defined before
  product code.
- 2026-08-22: The first real CLI smoke test exposed that the `tsx` launcher opens
  an IPC socket blocked by the sandbox. Replaced it with native Node ESM so the
  harness has no runtime launcher or IPC dependency.
- 2026-08-22: Focused harness coverage passed with 7 tests. The first full gate
  encountered a transient 5-pixel pre-existing navigation snapshot mismatch; an
  immediate E2E rerun passed, followed by a clean `npm run verify` with 39 unit,
  scenario, acceptance, and harness tests plus both Chromium E2E workflows.
- 2026-08-22 (external review): The harness code itself (`scripts/agent-harness.mjs`)
  is sound — static executable/args pairs, no shell, arguments closed before a child
  starts. Three items for the next pass:
  1. **Untracked secret-adjacent artifacts in the same working tree.**
     `apps/verification-target/.env.local` (`VERCEL_OIDC_TOKEN`) and
     `apps/verification-target/.vercel/project.json` (linked to an unrelated Vercel
     project, `consentflow`) currently sit untracked on `main` next to this change
     set, with no `.gitignore` rule covering `.vercel/` or `.env*.local` at the repo
     root. The nested `apps/verification-target/.gitignore` that ignored these only
     exists in commit `cb2238b` on `feature/google-gtm-integration`, not here. A
     broad `git add -A` before committing this feature would stage a live token and
     an unrelated project's deployment linkage. Recommend removing both files (or
     restoring the nested `.gitignore`) before this lands, and confirm whether
     `apps/verification-target` is meant to be revived here at all — its presence
     partly undercuts the spec's "no credentialed integrations" boundary even
     though the harness code never touches it.
  2. **`env: process.env` is passed unfiltered to every child process** (build,
     check, test, e2e, verify). Executable + args are a closed allowlist but the
     environment is not — worth a line in the spec's safety invariants either
     accepting this or constraining it.
  3. **Test coverage gap**: `agent-harness.test.ts` asserts the exact resolved
     mapping for only `verify` and `diff`; the other seven commands are checked
     only indirectly (executable is npm/git, args exclude a few risky strings).
     Cheap to close by asserting `resolveAgentCommand` output for all nine names
     against the documented table, so a swapped `args` array between two commands
     would actually fail a test.
- 2026-08-22: Closed the external-review follow-ups. Repository-wide ignore rules now
  protect local environment files, Vercel project linkage, and generated `.build/`
  output without deleting the local verification target. The accepted spec and README
  explicitly document inherited environment behavior: it matches direct `npm`/`git`
  execution, while the harness itself loads no environment file and exposes no
  credentialed command. The mapping regression now asserts the full executable,
  arguments, and description for all nine commands.

## Answer

Routine repository inspection, builds, checks, tests, and verification now share a
closed `npm run agent -- <command>` surface. Fixed mappings, root-scoped execution,
argument rejection, and excluded risky operations are permanently regression-tested;
external, mutating, destructive, and arbitrary package execution still require their
own authorization.
