# Product Plan

This folder describes how GTM Observability should grow from the current event-setup
MVP into a conversion setup, debugging, and observability product.

The core thesis:

> Agencies and marketing teams do not only need a faster way to create GTM tags. They
> need evidence that one exact measurement change works before publication and remains
> correct after websites, campaigns, consent banners, and GTM containers change.

## Product shape

The launch wedge is lead-generation websites, not every possible analytics use case. The durable domain is conversion measurement: the product distinguishes browser-visible interactions from the business outcomes they are intended to represent.

The customer should experience one continuous conversation:

```text
Define what counts as a conversion
    -> discover relevant website interactions
    -> confirm scope
    -> implement
    -> verify
    -> present evidence
```

The injected site-aware agent is the product surface for this workflow. One compact
workbench should preserve the active task, plan, action receipts, approval checkpoints,
and evidence while conversion capabilities are added; new technical capabilities
should advance that task rather than introduce another customer-facing layer or a
scripted chat transcript.

GTM Observability follows one measurement lifecycle with three stages:

1. **Setup and verification**
   Turn a tracking intent into a reviewable GTM change and browser-side proof.

2. **Debugging**
   Explain why tracking failed by correlating page behavior, dataLayer events, GTM configuration, tag firing, analytics requests, consent state, and destination evidence.

3. **Ongoing observability**
   Run scheduled scans across client sites and alert teams when critical events stop firing, duplicate, lose parameters, or drift from their baseline.

The agent UX is the delight layer. The recurring scans and evidence history are the retention layer.

These are stages of one evidence chain, not separate products or interfaces. The
tracking specification establishes expected behavior. Tracking checks record observed
behavior. Deterministic verdicts decide whether the evidence passes, and later checks
reuse the same specification as their baseline.

The launch product is the first stage carried through an exact version boundary:

```text
tracking intent
    -> confirmed tracking specification
    -> tracking setup
    -> tracking change plan
    -> managed-workspace draft
    -> exact draft preview
    -> deterministic verdict
    -> verified version
    -> human publication approval
```

A browser run against the current live container cannot qualify a different,
unpublished draft. Closing that evidence boundary takes priority over broad static
linting, scheduled monitoring, or an MCP interface. Internally, the browser overlay,
extension service worker, backend, shared tracking logic, and GTM integration remain
separate security and reliability boundaries. Customers should not need a proprietary
SDK for browser-observable conversion setup and verification.

## Documents

- [August 24 Pause Handoff](./2026-08-24-pause-handoff.md) - Current checkpoint,
  source-of-truth decision, and the next unresolved product choice. Read this first.
- [MVP Build Handoff](./2026-08-23-mvp-handoff.md) - Current code map, scope audit,
  honest gaps, and earlier implementation decisions.
- [What Exists Today](./current-capabilities.md) - Plain-language inventory of working behavior, safety boundaries, verification coverage, and remaining work.
- [August 24 Roadmap](./2026-08-24-roadmap.md) - Historical language and evidence plan; superseded for active MVP priorities by the handoff above.
- [Build Stages](./build-stages.md) - MVP-to-full-product sequence.
- [Technical Architecture](./technical-architecture.md) - System components and agent/workflow design.
- [Go-To-Market Timing](./go-to-market.md) - When to build the website, market, sell, and narrow positioning.
