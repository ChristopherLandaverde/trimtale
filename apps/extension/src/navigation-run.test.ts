import { describe, expect, it } from "vitest";
import { createSetupProposal, type BrowserEvidence, type SetupRequest } from "@trimtale/core";
import {
  NAVIGATION_RUN_LIFETIME_MS,
  canonicalNavigationRequest,
  isNavigationRun,
  mergeNavigationEvidence,
  navigationRequestsFrom,
  navigationRunRequests,
  navigationRunResumableAt,
  navigationRunSettleDelay,
} from "./navigation-run.js";

const clickedAt = "2026-10-31T12:00:00.000Z";
const evidence: BrowserEvidence = {
  navigationId: "nav_services",
  clickedAt,
  pageUrl: "http://127.0.0.1:14173/",
  linkText: "Services",
  linkUrl: "http://127.0.0.1:14173/services",
  requests: [],
};
const request = { navigation: [] } as unknown as SetupRequest;
const savedAt = Date.parse(clickedAt);

describe("post-publication navigation runs", () => {
  it("counts only requests the clicked document sent, from just before the click", () => {
    const run = { evidence, documentId: "doc-clicked" };
    const click = { url: "https://www.google-analytics.com/g/collect?en=navigation_click", observedAt: "2026-10-31T12:00:00.300Z", documentId: "doc-clicked" };
    const sameDispatch = { ...click, observedAt: "2026-10-31T11:59:59.950Z" };
    const earlier = { ...click, observedAt: "2026-10-31T11:59:59.800Z" };
    const destinationPageView = { url: "https://www.google-analytics.com/g/collect?en=page_view", observedAt: "2026-10-31T12:00:00.400Z", documentId: "doc-destination" };
    const unknownDocument = { url: click.url, observedAt: "2026-10-31T12:00:00.500Z" };
    expect(navigationRunRequests(run, [earlier, sameDispatch, click, destinationPageView, unknownDocument])).toEqual([
      { url: sameDispatch.url, observedAt: sameDispatch.observedAt },
      { url: click.url, observedAt: click.observedAt },
    ]);
    // Without a known clicked document, nothing counts.
    expect(navigationRunRequests({ evidence }, [click])).toEqual([]);
  });

  it("resumes only on a page from the clicked link's origin", () => {
    expect(navigationRunResumableAt({ evidence }, "http://127.0.0.1:14173/services")).toBe(true);
    expect(navigationRunResumableAt({ evidence }, "http://127.0.0.1:14173/other?x=1")).toBe(true);
    expect(navigationRunResumableAt({ evidence }, "https://127.0.0.1:14173/services")).toBe(false);
    expect(navigationRunResumableAt({ evidence }, "http://attacker.example/services")).toBe(false);
    expect(navigationRunResumableAt({ evidence }, undefined)).toBe(false);
    expect(navigationRunResumableAt({ evidence: { ...evidence, linkUrl: "not a url" } }, "http://127.0.0.1:14173/")).toBe(false);
  });

  it("accepts a fresh run and refuses stale or malformed ones", () => {
    const run = { operationId: "operation_1", request, evidence, savedAt };
    expect(isNavigationRun(run, savedAt + 1_000)).toBe(true);
    expect(isNavigationRun(run, savedAt + NAVIGATION_RUN_LIFETIME_MS + 1)).toBe(false);
    expect(isNavigationRun(run, savedAt - 1)).toBe(false);
    expect(isNavigationRun({ ...run, operationId: "" }, savedAt)).toBe(false);
    expect(isNavigationRun({ ...run, request: {} }, savedAt)).toBe(false);
    expect(isNavigationRun({ ...run, evidence: { ...evidence, requests: undefined } }, savedAt)).toBe(false);
    expect(isNavigationRun(undefined, savedAt)).toBe(false);
    expect(isNavigationRun({ ...run, documentId: 7 }, savedAt)).toBe(false);
    expect(isNavigationRun({ ...run, documentId: "doc-clicked" }, savedAt)).toBe(true);
  });

  it("waits until the click has had its full settle time, never longer", () => {
    expect(navigationRunSettleDelay({ evidence }, savedAt + 250)).toBe(950);
    expect(navigationRunSettleDelay({ evidence }, savedAt + 5_000)).toBe(0);
    expect(navigationRunSettleDelay({ evidence }, savedAt - 60_000)).toBe(1_200);
    expect(navigationRunSettleDelay({ evidence: { ...evidence, clickedAt: "not a date" } }, savedAt)).toBe(0);
  });

  it("merges requests that belong to the click once each, dropping earlier ones", () => {
    const first = { url: "https://www.google-analytics.com/g/collect?en=navigation_click", observedAt: "2026-10-31T12:00:00.050Z" };
    // The page's own click listener sent this in the same dispatch, just before the stamp.
    const sameDispatch = { url: "https://www.google-analytics.com/g/collect?en=navigation_click&n=2", observedAt: "2026-10-31T11:59:59.999Z" };
    const before = { url: "https://www.google-analytics.com/g/collect?en=page_view", observedAt: "2026-10-31T11:59:59.000Z" };
    expect(mergeNavigationEvidence({ ...evidence, requests: [first] }, [first, before, sameDispatch], [first]).requests)
      .toEqual([first, sameDispatch]);
    expect(navigationRequestsFrom(clickedAt)).toBe("2026-10-31T11:59:59.900Z");
  });

  it("maps a request whose keys storage reordered back to the same specification", () => {
    const original: SetupRequest = {
      intent: "Track navigation links",
      pageUrl: "http://127.0.0.1:14173/?gtm=GTM-TEST123",
      measurementId: "G-TEST123456",
      container: { accountId: "1", containerId: "10", publicId: "GTM-TEST123", name: "Lead site" },
      navigation: [{ id: "nav_services", text: "Services", href: "http://127.0.0.1:14173/services", area: "header", selector: "nav a[href=\"/services\"]" }],
    };
    // chrome.storage hands objects back with their keys sorted.
    const sorted = JSON.parse(JSON.stringify(original, (_key, value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
        : value)) as SetupRequest;
    const expected = createSetupProposal(original).specification.id;
    expect(createSetupProposal(sorted).specification.id).not.toBe(expected);
    expect(createSetupProposal(canonicalNavigationRequest(sorted)).specification.id).toBe(expected);
  });
});
