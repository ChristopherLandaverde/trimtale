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
    const result = evaluateEvidence(expected, evidence(["https://www.google-analytics.com/g/collect?v=2&en=navigation_click&ep.link_text=Contact&ep.link_url=https%3A%2F%2Fexample.test%2Fcontact"]));
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
    const url = "https://www.google-analytics.com/g/collect?v=2&en=navigation_click&ep.link_text=Contact&ep.link_url=https%3A%2F%2Fexample.test%2Fcontact";
    const result = evaluateEvidence(expected, evidence([url, url]));
    expect(result.status).toBe("failed");
    expect(result.runEvidence?.verdict.code).toBe("duplicate_fire");
  });

  it("ignores a permitted automatic request when counting navigation delivery", () => {
    const navigation = "https://www.google-analytics.com/g/collect?v=2&en=navigation_click&ep.link_text=Contact&ep.link_url=https%3A%2F%2Fexample.test%2Fcontact";
    const pageView = "https://www.google-analytics.com/g/collect?v=2&en=page_view";
    const result = evaluateEvidence(expected, evidence([pageView, navigation]));

    expect(result.status).toBe("passed");
    expect(result.runEvidence?.verdict.code).toBe("browser_verified");
    expect(result.checks.find(({ name }) => name === "Single GA4 request observed")?.passed).toBe(true);
  });

  it("stays incomplete before a guided click", () => {
    expect(evaluateEvidence(expected).status).toBe("incomplete");
  });

  it("keeps a different navigation target insufficient rather than a non-conversion", () => {
    const request = "https://www.google-analytics.com/g/collect?v=2&en=navigation_click&ep.link_text=Pricing&ep.link_url=https%3A%2F%2Fexample.test%2Fpricing";
    const wrongTarget = { ...evidence([request]), linkUrl: "https://example.test/pricing" };

    expect(evaluateEvidence(expected, wrongTarget).runEvidence?.verdict).toMatchObject({
      code: "insufficient_observable_evidence",
      browserVerification: "inconclusive",
    });
  });
});
