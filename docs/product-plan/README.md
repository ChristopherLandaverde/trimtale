# Product Plan

This folder describes how GTM Observability should grow from the current navigation-tracking MVP into a full GTM and GA4 observability product.

The core thesis:

> Agencies and marketing teams do not only need a faster way to create GTM tags. They need a reliable way to know whether tracking still works after websites, campaigns, consent banners, and GTM containers change.

## Product shape

GTM Observability has three layers:

1. **Setup and verification**
   Turn a tracking intent into a reviewable GTM change and browser-side proof.

2. **Debugging**
   Explain why tracking failed by correlating page behavior, dataLayer events, GTM configuration, tag firing, analytics requests, consent state, and destination evidence.

3. **Ongoing observability**
   Run scheduled scans across client sites and alert teams when critical events stop firing, duplicate, lose parameters, or drift from their baseline.

The agent UX is the delight layer. The recurring scans and evidence history are the retention layer.

## Documents

- [Build Stages](./build-stages.md) - MVP-to-full-product sequence.
- [Technical Architecture](./technical-architecture.md) - System components and agent/workflow design.
- [Go-To-Market Timing](./go-to-market.md) - When to build the website, market, sell, and narrow positioning.

