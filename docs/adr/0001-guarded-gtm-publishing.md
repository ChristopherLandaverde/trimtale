# Guard GTM publishing behind reviewed version evidence

GTM Observability may create and publish a container version only after explicit tracking-practitioner approval, an exact workspace allowlist, a conflict-free workspace preflight, and human-readable version metadata derived from the reviewed tracking setup. Version creation and publishing remain separately gated because creating a version deletes the source workspace, while publishing changes live behavior; compiler errors stop publication and a created-but-unpublished version is retained for recovery evidence.
