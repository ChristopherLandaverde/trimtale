# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: open the repository's **Security**
tab and choose **Report a vulnerability**. Don't open a public issue for a security problem.

Include what you did, what happened, and the commit or build you tested. You'll get a reply
once the report has been read; a fix is coordinated with you before anything is disclosed.

## Scope

- The Chrome extension in `apps/extension`, including the page observer and the bridge
  between page scripts and the extension.
- The API in `apps/api`, including Google OAuth, token storage and the workflow routes.
- The GTM publication path: approval, publish and rollback.

Publishing to a live GTM container is disabled by default and needs separate approval and
publish steps by a verified Google account. A way to publish, roll back or change a
container without those steps is in scope and is treated as the highest severity.

## Out of scope

- Findings that need a modified extension build or an already-compromised browser profile.
- Missing hardening headers on the local development servers.
