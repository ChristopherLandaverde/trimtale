# Bind publication and rollback to verified versions

Status: open

Blocked by: 05

## Objective

Require publication approval for one exact version fingerprint, publish only while it
remains current, collect post-publication evidence, and retain a verified rollback path
to the prior live version.

## Regression contract

Cover approved publication, missing/expired/wrong-fingerprint approval, live-version
drift, publication failure, passing and failing post-publication checks, and explicit
rollback evidence. Ordinary CI must never call the real publication endpoint.
