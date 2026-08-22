import { describe, expect, it } from "vitest";
import { evaluateEvidence } from "./verification.js";
import type { BrowserEvidence, NavigationElement } from "./types.js";

const expected: NavigationElement = {
  id: "nav_contact",
  text: "Contact",
  href: "https://example.test/contact",
  area: "header",
  selector: "header a.contact",
};

function evidence(requests: string[]): BrowserEvidence {
  return {
    navigationId: expected.id,
    clickedAt: "2026-08-15T12:00:00.000Z",
    pageUrl: "https://example.test/",
    linkText: expected.text,
    linkUrl: expected.href,
    requests: requests.map((url) => ({ url, observedAt: "2026-08-15T12:00:01.000Z" })),
  };
}

describe("browser evidence", () => {
  it("passes with one GA4 request and keeps platform confirmation unverified", () => {
    const result = evaluateEvidence(expected, evidence(["https://www.google-analytics.com/g/collect?v=2"]));
    expect(result.status).toBe("passed");
    expect(result.browserVerification).toBe("verified");
    expect(result.platformConfirmation).toBe("unverified");
    expect(result.runEvidence).toMatchObject({
      schemaVersion: 1,
      specificationId: "spec_navigation",
      verdict: { code: "browser_verified", browserVerification: "passed" },
      observations: { tagFired: true },
    });
  });

  it("fails duplicate GA4 delivery", () => {
    const url = "https://www.google-analytics.com/g/collect?v=2";
    const result = evaluateEvidence(expected, evidence([url, url]));
    expect(result.status).toBe("failed");
    expect(result.runEvidence?.verdict.code).toBe("duplicate_fire");
  });

  it("stays incomplete before a guided click", () => {
    expect(evaluateEvidence(expected).status).toBe("incomplete");
  });
});
