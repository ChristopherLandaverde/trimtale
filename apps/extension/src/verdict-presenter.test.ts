import { describe, expect, it } from "vitest";
import type { ScenarioVerdictCode, TrackingRunEvidenceV1 } from "@trimtale/core";
import { presentVerdict, type FindingEvidenceRow, type FindingStatus } from "./verdict-presenter.js";

type Observations = TrackingRunEvidenceV1["observations"];

const requestUrl = "https://region1.google-analytics.com/g/collect?v=2&en=generate_lead&ep.form_id=contact&ep.form_name=Contact%20sales&dl=https%3A%2F%2Fexample.test%2F";

function formEvidence(
  code: ScenarioVerdictCode,
  browserVerification: TrackingRunEvidenceV1["verdict"]["browserVerification"],
  overrides: Partial<Observations> = {},
): TrackingRunEvidenceV1 {
  return {
    schemaVersion: 1,
    runId: "run_form_1",
    specificationId: "spec_form_contact",
    startedAt: "2026-10-30T12:00:00.000Z",
    observations: {
      interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "success" },
      outcome: { observed: true, observable: true, evidenceType: "visible_element" },
      dataLayer: { matchingEvents: [{ event: "generate_lead" }] },
      tagFired: true,
      network: { ga4Requests: [{ url: requestUrl, observedAt: "2026-10-30T12:00:01.000Z" }] },
      consent: { analyticsStorage: "granted" },
      ...overrides,
    },
    verdict: { code, browserVerification, platformConfirmation: "unverified", nextAction: "Core next action." },
  };
}

function navigationEvidence(code: ScenarioVerdictCode, requests: number): TrackingRunEvidenceV1 {
  return {
    ...formEvidence(code, code === "browser_verified" ? "passed" : "failed"),
    observations: {
      interaction: { type: "navigation_click", targetId: "nav_1", attempted: true, submissionResult: "success" },
      outcome: { observed: code !== "insufficient_observable_evidence", observable: true, evidenceType: "navigation_click" },
      dataLayer: { matchingEvents: [] },
      tagFired: requests > 0 ? true : null,
      network: {
        ga4Requests: Array.from({ length: requests }, () => ({ url: requestUrl, observedAt: "2026-10-30T12:00:01.000Z" })),
      },
      consent: { analyticsStorage: "unknown" },
    },
  };
}

const formCases: Array<[ScenarioVerdictCode, TrackingRunEvidenceV1["verdict"]["browserVerification"], FindingStatus, Partial<Observations>]> = [
  ["browser_verified", "passed", "verified", {}],
  ["expected_non_conversion", "failed", "not_checked", {
    interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "validation_error" },
    outcome: { observed: false, observable: true },
  }],
  ["expected_non_conversion", "failed", "not_checked", { outcome: { observed: false, observable: true } }],
  ["submission_failed", "failed", "broken", {
    interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "server_error" },
  }],
  ["outcome_observed_event_missing", "failed", "broken", { dataLayer: { matchingEvents: [] } }],
  ["datalayer_event_observed_tag_not_firing", "failed", "broken", { tagFired: false }],
  ["tag_fired_request_missing", "failed", "broken", { network: { ga4Requests: [] } }],
  ["missing_parameter", "failed", "broken", {
    network: { ga4Requests: [{ url: "https://www.google-analytics.com/g/collect?en=generate_lead&ep.form_id=contact", observedAt: "x" }] },
  }],
  ["duplicate_fire", "failed", "broken", {
    network: { ga4Requests: [{ url: requestUrl, observedAt: "a" }, { url: requestUrl, observedAt: "b" }] },
  }],
  ["consent_limited", "inconclusive", "review", { consent: { analyticsStorage: "denied" } }],
  ["insufficient_observable_evidence", "inconclusive", "not_checked", { tagFired: null }],
  ["insufficient_observable_evidence", "inconclusive", "not_checked", {
    interaction: { type: "form_submission", targetId: "contact", attempted: false, submissionResult: "unknown" },
    outcome: { observed: false, observable: false },
  }],
];

const sentences = (copy: string): string[] => copy.split(/(?<=[.?])\s+/).filter(Boolean);

describe("presentVerdict", () => {
  for (const [code, browserVerification, status, overrides] of formCases) {
    it(`words ${code} (${status}) as an outcome with a fix, not as a code`, () => {
      const finding = presentVerdict(formEvidence(code, browserVerification, overrides), { targetLabel: "Contact sales" });

      expect(finding.status).toBe(status);
      expect(finding.code).toBe(code);
      for (const copy of [finding.title, finding.observed, finding.consequence, finding.fix, finding.verify]) {
        expect(copy.trim().length).toBeGreaterThan(0);
        expect(copy, "copy starts with a capital or a code span").toMatch(/^[A-Z0-9`]/);
        expect(copy).not.toContain(code);
        expect(copy).not.toMatch(/!|\binvalid\b|\bincorrect\b|\bwrong\b/i);
        for (const sentence of sentences(copy)) {
          expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(18);
        }
      }
      expect(finding.title).not.toMatch(/`/);
      expect(finding.evidence).toEqual(expect.arrayContaining([
        { label: "verdict.code", value: code },
        { label: "verdict.browserVerification", value: browserVerification },
        { label: "verdict.platformConfirmation", value: "unverified" },
      ]));
    });
  }

  it("never claims platform confirmation for a browser-verified lead", () => {
    const finding = presentVerdict(formEvidence("browser_verified", "passed"), { targetLabel: "Contact sales" });
    const copy = [finding.title, finding.observed, finding.consequence, finding.fix, finding.verify].join(" ").toLowerCase();
    expect(copy).toContain("platform confirmation is not available");
    expect(copy).not.toMatch(/ga4 confirmed|platform confirmed|published/);
  });

  it("names exactly the parameters the lead request is missing", () => {
    const finding = presentVerdict(formEvidence("missing_parameter", "failed", {
      network: { ga4Requests: [{ url: "https://www.google-analytics.com/g/collect?en=generate_lead&ep.form_id=contact", observedAt: "x" }] },
    }));
    expect(finding.observed).toBe("The `generate_lead` request was sent without `form_name` and `page_location`.");
    expect(finding.fix).toBe("Add `form_name` and `page_location` to the GA4 `generate_lead` tag.");
  });

  it("counts duplicate lead requests from the evidence", () => {
    const finding = presentVerdict(formEvidence("duplicate_fire", "failed", {
      network: { ga4Requests: [{ url: requestUrl, observedAt: "a" }, { url: requestUrl, observedAt: "b" }, { url: requestUrl, observedAt: "c" }] },
    }));
    expect(finding.title).toBe("One submission sent 3 lead requests");
    expect(finding.evidence).toContainEqual({ label: "network.ga4Requests", value: "3" });
  });

  describe("captured request rows", () => {
    const capturedUrl = "https://region1.google-analytics.com/g/collect?v=2&tid=G-TEST123456&en=generate_lead"
      + "&ep.form_id=contact&ep.form_name=Contact%20sales&ep.page_location=https%3A%2F%2Fexample.test%2Fcontact&dl=https%3A%2F%2Fexample.test%2Fcontact&gcs=G111";
    const rowsFor = (urls: string[]) => presentVerdict(formEvidence("browser_verified", "passed", {
      network: { ga4Requests: urls.map((url) => ({ url, observedAt: "x" })) },
    })).evidence;
    const capturedRows = (rows: FindingEvidenceRow[]) => rows.filter((row) => row.label.startsWith("network.ga4Requests["));

    it("shows the first captured request's host, measurement ID, event and form fields after the count", () => {
      const rows = rowsFor([capturedUrl]);
      const labels = rows.map((row) => row.label);
      expect(capturedRows(rows)).toEqual([
        { label: "network.ga4Requests[0].host", value: "region1.google-analytics.com" },
        { label: "network.ga4Requests[0].tid", value: "G-TEST123456" },
        { label: "network.ga4Requests[0].en", value: "generate_lead" },
        { label: "network.ga4Requests[0].ep.form_id", value: "contact" },
        { label: "network.ga4Requests[0].ep.form_name", value: "Contact sales" },
      ]);
      expect(labels.indexOf("network.ga4Requests[0].host")).toBe(labels.indexOf("network.ga4Requests") + 1);
      expect(labels.at(-1)).toBe("runId");
      expect(rows).toContainEqual({ label: "network.ga4Requests", value: "1" });
    });

    it("never shows page URLs, consent strings or parameters outside the allowlist", () => {
      const rows = rowsFor([`${capturedUrl}&uid=user-42&ep.email=private%40example.com&cid=123.456`]);
      const text = JSON.stringify(rows);
      for (const forbidden of ["example.test", "page_location", "dl", "gcs", "uid", "user-42", "private", "cid", "123.456"]) {
        expect(capturedRows(rows).some((row) => row.label.includes(forbidden) || row.value.includes(forbidden)), forbidden).toBe(false);
      }
      expect(text).not.toContain("private@example.com");
    });

    it("describes only the first request when several were sent", () => {
      const second = capturedUrl.replace("ep.form_id=contact", "ep.form_id=newsletter");
      const rows = presentVerdict(formEvidence("duplicate_fire", "failed", {
        network: { ga4Requests: [{ url: capturedUrl, observedAt: "a" }, { url: second, observedAt: "b" }] },
      })).evidence;
      expect(rows).toContainEqual({ label: "network.ga4Requests", value: "2" });
      expect(capturedRows(rows).filter((row) => row.label.endsWith("form_id"))).toEqual([
        { label: "network.ga4Requests[0].ep.form_id", value: "contact" },
      ]);
    });

    it("shows the local fixture collection host", () => {
      const rows = rowsFor(["http://127.0.0.1:14173/g/collect?v=2&tid=G-TEST123456&en=generate_lead&ep.form_id=contact"]);
      expect(capturedRows(rows)[0]).toEqual({ label: "network.ga4Requests[0].host", value: "127.0.0.1:14173" });
    });

    it("omits parameters the request did not carry", () => {
      const rows = rowsFor(["https://www.google-analytics.com/g/collect?en=generate_lead"]);
      expect(capturedRows(rows).map((row) => row.label)).toEqual([
        "network.ga4Requests[0].host",
        "network.ga4Requests[0].en",
      ]);
    });

    it.each([
      ["a malformed URL", "not a url"],
      ["a non-collection host", "https://attacker.test/g/collect?en=generate_lead&tid=G-EVIL"],
      ["a non-collection path", "https://www.google-analytics.com/other?en=generate_lead"],
    ])("skips the rows for %s without throwing", (_name, url) => {
      const rows = rowsFor([url]);
      expect(capturedRows(rows)).toEqual([]);
      expect(rows).toContainEqual({ label: "network.ga4Requests", value: "1" });
    });

    it("adds no request rows when nothing was sent", () => {
      expect(capturedRows(rowsFor([]))).toEqual([]);
    });

    it("bounds attacker-shaped form values", () => {
      const rows = rowsFor([`https://www.google-analytics.com/g/collect?en=generate_lead&ep.form_name=${encodeURIComponent("<img src=x onerror=alert(1)>" + "x".repeat(200))}`]);
      const name = capturedRows(rows).find((row) => row.label.endsWith("form_name"));
      expect(name?.value.startsWith("<img src=x onerror=alert(1)>")).toBe(true);
      expect(name!.value.length).toBeLessThanOrEqual(80);
    });

    it("applies to navigation evidence, whose request URLs are not pre-sanitized", () => {
      const raw = "https://www.google-analytics.com/g/collect?v=2&tid=G-TEST123456&en=navigation_click&dl=https%3A%2F%2Fexample.test%2F%3Femail%3Dprivate%40example.com&cid=99";
      const rows = presentVerdict({
        ...navigationEvidence("browser_verified", 1),
        observations: {
          ...navigationEvidence("browser_verified", 1).observations,
          network: { ga4Requests: [{ url: raw, observedAt: "x" }] },
        },
      }).evidence;
      expect(capturedRows(rows)).toEqual([
        { label: "network.ga4Requests[0].host", value: "www.google-analytics.com" },
        { label: "network.ga4Requests[0].tid", value: "G-TEST123456" },
        { label: "network.ga4Requests[0].en", value: "navigation_click" },
      ]);
      expect(JSON.stringify(rows)).not.toContain("private");
    });
  });

  it("keeps attacker-shaped page labels as bounded plain text", () => {
    const finding = presentVerdict(formEvidence("duplicate_fire", "failed", {
      network: { ga4Requests: [{ url: requestUrl, observedAt: "a" }, { url: requestUrl, observedAt: "b" }] },
    }), { targetLabel: "<img src=x onerror=alert(1)>`code`" + "x".repeat(200) });
    expect(finding.observed).toContain("<img src=x onerror=alert(1)>'code'");
    expect(finding.observed).not.toContain("`code`");
    expect(finding.observed.length).toBeLessThan(160);
  });

  describe("endpoint failure while the page reported success (#63)", () => {
    type Interaction = Observations["interaction"] & { responseStatus?: number };
    const interaction = (submissionResult: Interaction["submissionResult"], responseStatus?: number): Interaction => ({
      type: "form_submission", targetId: "contact", attempted: true, submissionResult,
      ...(responseStatus === undefined ? {} : { responseStatus }),
    });
    const leadRequest = { network: { ga4Requests: [{ url: requestUrl, observedAt: "x" }] } };
    const noRequest = { network: { ga4Requests: [] } };

    it.each([
      ["submission_failed", "server_error", 503, leadRequest, "The page reported success, but the form endpoint returned HTTP 503. A `generate_lead` request was still sent, so GA4 may count a lead that does not exist."],
      ["submission_failed", "server_error", 503, noRequest, "The page reported success, but the form endpoint returned HTTP 503."],
      ["expected_non_conversion", "validation_error", 422, leadRequest, "The page reported success, but the form endpoint rejected the submission with HTTP 422. A `generate_lead` request was still sent, so GA4 may count a lead that does not exist."],
      ["expected_non_conversion", "validation_error", 422, noRequest, "The page reported success, but the form endpoint rejected the submission with HTTP 422."],
    ] as const)("%s (%s %i) names the conflict and the HTTP status", (code, result, status, network, observed) => {
      const finding = presentVerdict(formEvidence(code, "failed", {
        interaction: interaction(result, status),
        outcome: { observed: true, observable: true, evidenceType: "visible_element" },
        ...network,
      }), { targetLabel: "Contact sales" });
      expect(finding.status).toBe("broken");
      expect(finding.observed).toBe(observed);
      expect(finding.title).toMatch(/but the page showed success$/);
      expect(`${finding.consequence} ${finding.fix}`).not.toMatch(/nothing (is )?sent|stopped by validation/i);
      expect(finding.evidence).toContainEqual({ label: "interaction.responseStatus", value: String(status) });
      for (const copy of [finding.title, finding.observed, finding.consequence, finding.fix, finding.verify]) {
        for (const sentence of sentences(copy)) expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(18);
      }
    });

    it("never says nothing reached GA4 when a lead request was sent for a failed submission", () => {
      const finding = presentVerdict(formEvidence("submission_failed", "failed", {
        interaction: interaction("server_error", 500),
        outcome: { observed: false, observable: true },
        ...leadRequest,
      }));
      expect(finding.observed).toBe("The form endpoint returned HTTP 500 after submit. A `generate_lead` request was still sent, so GA4 may count a lead that does not exist.");
      expect(finding.consequence).not.toMatch(/no lead request was sent/);
    });

    it("keeps browser-side validation, with no endpoint status, as not checked", () => {
      const finding = presentVerdict(formEvidence("expected_non_conversion", "failed", {
        interaction: interaction("validation_error"),
        outcome: { observed: false, observable: true },
        ...noRequest,
      }));
      expect(finding.status).toBe("not_checked");
      expect(finding.observed).toBe("Form validation stopped the submission before it was accepted.");
      expect(finding.evidence.map((row) => row.label)).not.toContain("interaction.responseStatus");
    });
  });

  it("words navigation verdicts with navigation_click", () => {
    expect(presentVerdict(navigationEvidence("browser_verified", 1), { targetLabel: "Pricing" })).toMatchObject({
      status: "verified",
      title: "Link-click tracking works in this browser",
      observed: "Clicking Pricing sent one `navigation_click` request to Google Analytics.",
    });
    expect(presentVerdict(navigationEvidence("duplicate_fire", 2)).title).toBe("One click sent 2 GA4 requests");
    expect(presentVerdict(navigationEvidence("tag_fired_request_missing", 0)).status).toBe("broken");
    expect(presentVerdict(navigationEvidence("insufficient_observable_evidence", 0)).status).toBe("not_checked");
  });
});
