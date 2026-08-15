# Deployment-Assisted Verification

Status: in progress

## Product insight

Preparing a website to receive and exercise a tracking setup is part of the time to verified setup. Connecting deployment automation to the tracking setup can remove manual snippet installation, environment configuration, and deployment handoffs from the critical path.

## User outcome

A tracking practitioner selects a verification target, connects its deployment provider, and receives a preview deployment containing the isolated GTM container needed for a tracking check. The practitioner can move from tracking intent to browser evidence without manually editing or deploying the website.

## Proposed workflow

```text
Choose verification target
    -> create or select disposable GTM container
    -> configure the container ID for the target
    -> create preview deployment
    -> confirm GTM loads on the preview URL
    -> run tracking check
    -> retain or remove disposable resources by policy
```

## First provider slice

- Use an authenticated Vercel connection to create a preview deployment.
- Configure the GTM container ID without hard-coding it in source.
- Keep the existing production deployment unchanged.
- Return the preview URL as the verification target for GTM Preview and browser evidence.

## Product boundary

- Deployment access does not imply permission to alter production.
- GTM write access does not imply permission to publish a container version.
- Preview deployment evidence remains browser verification, not platform confirmation.
- Provider-specific automation should serve the provider-neutral verification-target workflow.

## Friction reduced

- No manual GTM snippet editing for each tracking check.
- No manual preview deployment handoff.
- Fewer opportunities to pair the wrong website and GTM container.
- Shorter time to verified setup.

## Open decisions

- Whether the product modifies a temporary source checkout or injects configuration at build time.
- How preview deployments and disposable GTM workspaces are paired and named.
- Default retention period for preview deployments and GTM workspaces.
- Recovery behavior when one disposable resource is created but the other fails.

## Implemented first slice

- A deterministic verification-target app installs a configured GTM container in script and noscript positions.
- The target exposes a machine-checkable container marker and reproducible navigation and button interactions.
- A Vercel command creates preview deployments only; it never promotes a deployment to production.
- Deployment verification uses Vercel's authenticated fetch path so protected previews remain testable.
- Local builds use a non-production placeholder while live deployment requires an explicit container ID.
- GTM container creation is available only behind an explicit backend flag and additional narrow OAuth scope.
- The creation route accepts only a named HTTPS verification target and creates a web container; existing-container mutation and publishing remain unavailable.
- Isolated workspace creation has a separate backend flag and exact-container path allowlist.
- Workspace creation returns the resource identifier before status inspection or entity writes and retains the workspace for evidence by default.
- No workspace deletion, container-version creation, quick preview, or publishing route exists in this slice.

## Live integration evidence

- Created dedicated web container `ConsentFlow Verification` (`GTM-PCJ3Q5RK`) in the designated test GTM account.
- Created protected Vercel preview `https://consentflow-j98gp45fr-christopherlandaverdes-projects.vercel.app`.
- Authenticated deployment verification confirmed the preview contains the expected container marker, GTM script, and noscript fallback.
- The production ConsentFlow alias was not changed and no GTM container version was published.
