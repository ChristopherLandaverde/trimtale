import { describe, expect, it } from "vitest";
import type { ScenarioVerdictCode, TrackingRunEvidenceV1 } from "./contracts.js";
import { determineFormVerdict } from "./form-verdict.js";

function observations(overrides: Partial<TrackingRunEvidenceV1["observations"]> = {}): TrackingRunEvidenceV1["observations"] {
  return {
    interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "success" },
    outcome: { observed: true, observable: true, evidenceType: "visible_element" },
    dataLayer: { matchingEvents: [{ event: "generate_lead" }] },
    tagFired: true,
    network: { ga4Requests: [{ url: "https://www.google-analytics.com/g/collect?en=generate_lead&ep.form_id=contact&ep.form_name=Contact_sales&ep.page_location=https%3A%2F%2Fexample.test%2F", observedAt: "2026-08-22T18:00:00.000Z" }] },
    consent: { analyticsStorage: "granted" },
    ...overrides,
  };
}

const corpus: Array<{ code: ScenarioVerdictCode; evidence: TrackingRunEvidenceV1["observations"] }> = [
  { code: "expected_non_conversion", evidence: observations({ interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "validation_error" }, outcome: { observed: false, observable: true } }) },
  { code: "browser_verified", evidence: observations() },
  { code: "outcome_observed_event_missing", evidence: observations({ dataLayer: { matchingEvents: [] }, tagFired: false, network: { ga4Requests: [] } }) },
  { code: "datalayer_event_observed_tag_not_firing", evidence: observations({ tagFired: false, network: { ga4Requests: [] } }) },
  { code: "tag_fired_request_missing", evidence: observations({ tagFired: true, network: { ga4Requests: [] } }) },
  { code: "missing_parameter", evidence: observations({ network: { ga4Requests: [{ url: "https://www.google-analytics.com/g/collect?en=generate_lead&ep.form_id=contact", observedAt: "2026-08-22T18:00:00.000Z" }] } }) },
  { code: "duplicate_fire", evidence: observations({ network: { ga4Requests: [
    { url: "https://www.google-analytics.com/g/collect?en=generate_lead", observedAt: "2026-08-22T18:00:00.000Z" },
    { url: "https://www.google-analytics.com/g/collect?en=generate_lead", observedAt: "2026-08-22T18:00:01.000Z" },
  ] } }) },
  { code: "consent_limited", evidence: observations({ consent: { analyticsStorage: "denied" }, tagFired: false, network: { ga4Requests: [] } }) },
  { code: "submission_failed", evidence: observations({ interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "server_error" }, outcome: { observed: false, observable: true }, dataLayer: { matchingEvents: [] }, tagFired: false, network: { ga4Requests: [] } }) },
  { code: "insufficient_observable_evidence", evidence: observations({ outcome: { observed: false, observable: false }, dataLayer: { matchingEvents: [] }, tagFired: null, network: { ga4Requests: [] }, consent: { analyticsStorage: "unknown" } }) },
];

describe("deterministic form verdict engine", () => {
  it.each(corpus)("classifies $code", ({ code, evidence }) => {
    const verdict = determineFormVerdict(evidence);
    expect(verdict.code).toBe(code);
    expect(verdict.nextAction.length).toBeGreaterThan(20);
    expect(verdict.platformConfirmation).toBe("unverified");
  });

  it.each([
    ["successful_correct", "browser_verified", observations()],
    ["validation_failure", "expected_non_conversion", corpus.find((item) => item.code === "expected_non_conversion")!.evidence],
    ["attempt_only", "expected_non_conversion", observations({ outcome: { observed: false, observable: true }, dataLayer: { matchingEvents: [] }, tagFired: false, network: { ga4Requests: [] } })],
    ["ajax_success", "browser_verified", observations()],
    ["thank_you_redirect", "browser_verified", observations({ outcome: { observed: true, observable: true, evidenceType: "thank_you_url" } })],
    ["spa_success", "browser_verified", observations({ outcome: { observed: true, observable: true, evidenceType: "same_page_success" } })],
    ["outcome_event_missing", "outcome_observed_event_missing", corpus.find((item) => item.code === "outcome_observed_event_missing")!.evidence],
    ["datalayer_tag_not_firing", "datalayer_event_observed_tag_not_firing", corpus.find((item) => item.code === "datalayer_event_observed_tag_not_firing")!.evidence],
    ["tag_fired_request_missing", "tag_fired_request_missing", corpus.find((item) => item.code === "tag_fired_request_missing")!.evidence],
    ["missing_required_parameter", "missing_parameter", corpus.find((item) => item.code === "missing_parameter")!.evidence],
    ["duplicate_request", "duplicate_fire", corpus.find((item) => item.code === "duplicate_fire")!.evidence],
    ["consent_denied", "consent_limited", corpus.find((item) => item.code === "consent_limited")!.evidence],
    ["server_error", "submission_failed", corpus.find((item) => item.code === "submission_failed")!.evidence],
    ["dynamic_form", "browser_verified", observations()],
    ["multiple_forms", "browser_verified", observations()],
    ["cross_origin_iframe", "insufficient_observable_evidence", corpus.find((item) => item.code === "insufficient_observable_evidence")!.evidence],
    ["server_error_with_success_event", "submission_failed", observations({ interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "server_error", responseStatus: 503 } })],
    ["redirect_server_error", "submission_failed", observations({ interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "server_error", responseStatus: 503 }, outcome: { observed: true, observable: true, evidenceType: "thank_you_url" } })],
    ["endpoint_rejection_with_success_event", "expected_non_conversion", observations({ interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "validation_error", responseStatus: 422 } })],
    ["server_error_retry_success", "browser_verified", observations()],
    ["third_party_error_after_success", "browser_verified", observations()],
  ] as const)("maps fixture %s to %s", (_id, expected, evidence) => {
    expect(determineFormVerdict(evidence).code).toBe(expected);
  });

  it("never passes attempt-only, validation, server failure, or unobservable cases", () => {
    for (const evidence of [
      observations({ outcome: { observed: false, observable: true }, dataLayer: { matchingEvents: [] }, tagFired: false, network: { ga4Requests: [] } }),
      corpus.find((item) => item.code === "expected_non_conversion")!.evidence,
      corpus.find((item) => item.code === "submission_failed")!.evidence,
      corpus.find((item) => item.code === "insufficient_observable_evidence")!.evidence,
    ]) {
      expect(determineFormVerdict(evidence).browserVerification).not.toBe("passed");
    }
  });

  it("accepts GA4's standard dl wire parameter as page_location evidence", () => {
    const liveRequest = observations({
      network: { ga4Requests: [{
        url: "https://www.google-analytics.com/g/collect?en=generate_lead&ep.form_id=workflow-smoke-form&ep.form_name=Disposable_workflow_smoke_form&dl=https%3A%2F%2Fconsentflow-psi.vercel.app%2F",
        observedAt: "2026-08-23T04:30:00.000Z",
      }] },
    });
    expect(determineFormVerdict(liveRequest).code).toBe("browser_verified");
  });

  it("still requires page location in either supported wire representation", () => {
    const noPageLocation = observations({
      network: { ga4Requests: [{
        url: "https://www.google-analytics.com/g/collect?en=generate_lead&ep.form_id=contact&ep.form_name=Contact_sales",
        observedAt: "2026-08-23T04:30:00.000Z",
      }] },
    });
    expect(determineFormVerdict(noPageLocation).code).toBe("missing_parameter");
  });

  it("names the conflicting success signal and the HTTP status when a failed submission reported success", () => {
    const failed = determineFormVerdict(observations({ interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "server_error", responseStatus: 503 } }));
    expect(failed.code).toBe("submission_failed");
    expect(failed.browserVerification).toBe("failed");
    expect(failed.nextAction).toMatch(/^The page reported success, but the form endpoint returned HTTP 503\./);
    expect(failed.nextAction).toMatch(/GA4 may count a lead/);

    const noRequest = determineFormVerdict(observations({ interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "server_error" }, tagFired: false, network: { ga4Requests: [] } }));
    expect(noRequest.nextAction).toMatch(/^The page reported success, but the form endpoint returned a server error\./);
    expect(noRequest.nextAction).not.toMatch(/GA4 may count/);

    const rejected = determineFormVerdict(observations({ interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "validation_error", responseStatus: 422 } }));
    expect(rejected.code).toBe("expected_non_conversion");
    expect(rejected.nextAction).toMatch(/^The page reported success, but the form endpoint rejected the submission with HTTP 422\./);
  });

  it("keeps the standard next action for failures without a conflicting success signal", () => {
    expect(determineFormVerdict(corpus.find((item) => item.code === "submission_failed")!.evidence).nextAction)
      .toBe("Fix the form or server error, then rerun browser verification.");
    expect(determineFormVerdict(corpus.find((item) => item.code === "expected_non_conversion")!.evidence).nextAction)
      .toBe("Correct the form input and submit again; do not count this attempt as a lead.");
  });
});
