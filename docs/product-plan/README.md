# Product Plan

This folder describes how Trimtale should grow from the current navigation-tracking MVP into a conversion setup, debugging, and observability product.

The core thesis:

> Agencies and marketing teams do not only need a faster way to create GTM tags. They need a reliable way to know whether tracking still works after websites, campaigns, consent banners, and GTM containers change.

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

The existing injected assistant is the product surface for this workflow. Its current interaction and visual design should remain stable while conversion capabilities are added; new technical capabilities should appear inside the existing conversation rather than introduce another customer-facing layer.

Trimtale has three layers:

1. **Setup and verification**
   Turn a tracking intent into a reviewable GTM change and browser-side proof.

2. **Debugging**
   Explain why tracking failed by correlating page behavior, dataLayer events, GTM configuration, tag firing, analytics requests, consent state, and destination evidence.

3. **Ongoing observability**
   Run scheduled scans across client sites and alert teams when critical events stop firing, duplicate, lose parameters, or drift from their baseline.

The agent UX is the delight layer. The recurring scans and evidence history are the retention layer.

The future product direction is captured as **Tracking Proof**: an owner-only overlay that proves each critical conversion through an evidence path from the real interaction to data layer, GTM, browser request, server-side routing, and destination receipt. Tracking Proof should remain contract-driven: a conversion is verified only when the expected proof chain passes, not merely because a tag exists or fires.

These are product capabilities, not three separate interfaces. Internally, the browser overlay, extension service worker, backend, shared tracking logic, and GTM integration remain separate security and reliability boundaries. Customers should not need a proprietary SDK for browser-observable conversion setup and verification.

## Documents

- [What Exists Today](./current-capabilities.md) - Plain-language inventory of working behavior, safety boundaries, verification coverage, and remaining work.
- [August 24 Roadmap](./2026-08-24-roadmap.md) - Next-session plan for a real post-publication journey and weighted shadow-mode language evaluation.
- [Build Stages](./build-stages.md) - MVP-to-full-product sequence.
- [Technical Architecture](./technical-architecture.md) - System components and agent/workflow design.
- [Go-To-Market Timing](./go-to-market.md) - When to build the website, market, sell, and narrow positioning.
- [Tracking Proof Product Concept](./tracking-proof.md) - Future owner-only proof overlay, conversion contracts, evidence trails, status model, WordPress/WooCommerce wedge, positioning, and validation plan.
