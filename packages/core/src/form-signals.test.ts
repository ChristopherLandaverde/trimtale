import { describe, expect, it } from "vitest";
import { determineFormVerdict } from "./form-verdict.js";
import { normalizeFormRunEvidence } from "./form-evidence.js";
import {
  FormRun,
  classifyFormResponseStatus,
  consentFromCollectUrl,
  matchesSuccessUrl,
  parsePageSignal,
  signalsFromDataLayerPush,
  thankYouUrlPattern,
} from "./form-signals.js";

const startedAt = "2026-10-30T18:00:00.000Z";
const startedAtMs = Date.parse(startedAt);
const sentinel = "private-sentinel@example.com";
const collect = (query: string) => `https://www.google-analytics.com/g/collect?v=2&tid=G-TEST123456&${query}`;
const fullLead = collect("en=generate_lead&ep.form_id=contact&ep.form_name=Contact_sales&ep.page_location=https%3A%2F%2Fexample.test%2F");

function verdictFor(run: FormRun, success: Parameters<FormRun["observation"]>[0]["success"] = { type: "visible_element", selector: "#contact-success" }) {
  const raw = run.observation({ runId: "run_1", specificationId: "spec_form_contact", targetId: "contact", success });
  const evidence = normalizeFormRunEvidence(raw, {
    code: "insufficient_observable_evidence",
    browserVerification: "inconclusive",
    platformConfirmation: "unverified",
    nextAction: "Await classification.",
  });
  return { raw, evidence, verdict: determineFormVerdict(evidence.observations) };
}

function leadEvent(at = startedAtMs + 10) {
  return { kind: "datalayer_event" as const, event: "generate_lead", formId: "contact", formName: "Contact_sales", at };
}

function deliveredRun(urls: string[], options: { consent?: "granted" | "denied" | "unknown" } = {}): FormRun {
  const run = new FormRun("generate_lead", startedAt, options.consent ?? "granted");
  run.recordAttempt();
  run.recordOutcome();
  run.recordPageSignal(leadEvent());
  urls.forEach((url, index) => {
    run.recordAnalyticsRequest({ id: `r${index}`, url, observedAt: startedAt });
    run.recordAnalyticsDelivery(`r${index}`, true);
  });
  return run;
}

describe("dataLayer signal extraction", () => {
  it("reads object-style event pushes and keeps only identifier-shaped form fields", () => {
    expect(signalsFromDataLayerPush({ event: "generate_lead", form_id: "contact", form_name: "Contact_sales" }, 5)).toEqual([
      { kind: "datalayer_event", event: "generate_lead", formId: "contact", formName: "Contact_sales", at: 5 },
    ]);
  });

  it("reads gtag-style event and consent commands", () => {
    expect(signalsFromDataLayerPush(["event", "generate_lead", { form_id: "contact" }], 7)).toEqual([
      { kind: "datalayer_event", event: "generate_lead", formId: "contact", at: 7 },
    ]);
    expect(signalsFromDataLayerPush(["consent", "default", { analytics_storage: "denied", ad_storage: "denied" }], 8)).toEqual([
      { kind: "consent", analyticsStorage: "denied", at: 8 },
    ]);
    expect(signalsFromDataLayerPush(["consent", "update", { analytics_storage: "granted" }], 9)).toEqual([
      { kind: "consent", analyticsStorage: "granted", at: 9 },
    ]);
  });

  it("never carries form values or other personal data out of a push", () => {
    const signals = signalsFromDataLayerPush({
      event: "generate_lead",
      form_id: sentinel,
      form_name: sentinel,
      email: sentinel,
      user_data: { email_address: sentinel },
    }, 1);
    expect(JSON.stringify(signals)).not.toContain(sentinel);
    expect(signals).toEqual([{ kind: "datalayer_event", event: "generate_lead", at: 1 }]);
    expect(signalsFromDataLayerPush(["event", sentinel], 1)).toEqual([]);
    expect(signalsFromDataLayerPush({ event: sentinel }, 1)).toEqual([]);
  });

  it("ignores pushes that are not events or consent commands", () => {
    for (const value of [null, 3, "event", { foo: "bar" }, ["config", "G-TEST"], ["consent", "default", { analytics_storage: "maybe" }]]) {
      expect(signalsFromDataLayerPush(value, 1)).toEqual([]);
    }
  });

  it("parses only well-formed serialized signals across the page boundary", () => {
    expect(parsePageSignal(JSON.stringify(leadEvent(3)))).toEqual(leadEvent(3));
    expect(parsePageSignal(JSON.stringify({ kind: "consent", analyticsStorage: "denied", at: 2 }))).toEqual({ kind: "consent", analyticsStorage: "denied", at: 2 });
    for (const value of ["", "{", "null", JSON.stringify({ kind: "datalayer_event", event: sentinel, at: 1 }), JSON.stringify({ kind: "datalayer_event", event: "generate_lead", formId: sentinel, at: 1 }), JSON.stringify({ kind: "other", at: 1 })]) {
      expect(parsePageSignal(value)).toBeUndefined();
    }
  });
});

describe("browser signal helpers", () => {
  it("reads analytics consent from the gcs parameter", () => {
    expect(consentFromCollectUrl(collect("en=page_view&gcs=G100"))).toBe("denied");
    expect(consentFromCollectUrl(collect("en=page_view&gcs=G110"))).toBe("denied");
    expect(consentFromCollectUrl(collect("en=page_view&gcs=G101"))).toBe("granted");
    expect(consentFromCollectUrl(collect("en=page_view"))).toBe("unknown");
  });

  it("classifies form endpoint responses", () => {
    expect(classifyFormResponseStatus(500)).toBe("server_error");
    expect(classifyFormResponseStatus(503)).toBe("server_error");
    expect(classifyFormResponseStatus(422)).toBe("validation_error");
    expect(classifyFormResponseStatus(400)).toBe("validation_error");
    expect(classifyFormResponseStatus(200)).toBeUndefined();
    expect(classifyFormResponseStatus(404)).toBeUndefined();
    expect(classifyFormResponseStatus(0)).toBeUndefined();
  });

  it("builds an escaped thank-you URL pattern that ignores query strings", () => {
    const pattern = thankYouUrlPattern("https://example.test/thank-you?ref=a");
    expect(pattern).toBe("^https://example\\.test/thank-you(?:[?#].*)?$");
    expect(matchesSuccessUrl(pattern, "https://example.test/thank-you")).toBe(true);
    expect(matchesSuccessUrl(pattern, "https://example.test/thank-you?formScenario=x")).toBe(true);
    expect(matchesSuccessUrl(pattern, "https://example.test/thank-you-not")).toBe(false);
    expect(matchesSuccessUrl(pattern, "https://exampleXtest/thank-you")).toBe(false);
    expect(matchesSuccessUrl("(", "https://example.test/")).toBe(false);
  });
});

describe("form run from real browser signals", () => {
  it("verifies one delivered generate_lead request after an observed success", () => {
    expect(verdictFor(deliveredRun([fullLead])).verdict.code).toBe("browser_verified");
  });

  it("does not count unrelated GA4 events as the conversion request", () => {
    const run = deliveredRun([fullLead, collect("en=page_view"), collect("en=user_engagement")]);
    expect(verdictFor(run).verdict.code).toBe("browser_verified");
  });

  it("reports duplicates and missing parameters from the delivered requests", () => {
    expect(verdictFor(deliveredRun([fullLead, fullLead])).verdict.code).toBe("duplicate_fire");
    expect(verdictFor(deliveredRun([collect("en=generate_lead")])).verdict.code).toBe("missing_parameter");
  });

  it("treats an attempted but undelivered request as tag fired, request missing", () => {
    const run = new FormRun("generate_lead", startedAt, "granted");
    run.recordAttempt();
    run.recordOutcome();
    run.recordPageSignal(leadEvent());
    run.recordAnalyticsRequest({ id: "r1", url: fullLead, observedAt: startedAt });
    expect(run.hasPendingDeliveries()).toBe(true);
    run.recordAnalyticsDelivery("r1", false);
    expect(run.hasPendingDeliveries()).toBe(false);
    expect(verdictFor(run).verdict.code).toBe("tag_fired_request_missing");
  });

  it("reports a dataLayer event without any request as the tag not firing", () => {
    expect(verdictFor(deliveredRun([])).verdict.code).toBe("datalayer_event_observed_tag_not_firing");
  });

  it("reports an observed success without the dataLayer event", () => {
    const run = new FormRun("generate_lead", startedAt, "granted");
    run.recordAttempt();
    run.recordOutcome();
    run.recordPageSignal({ kind: "datalayer_event", event: "form_start", at: startedAtMs + 1 });
    expect(verdictFor(run).verdict.code).toBe("outcome_observed_event_missing");
  });

  it("ignores dataLayer events that happened before the run started", () => {
    const run = new FormRun("generate_lead", startedAt, "granted");
    run.recordAttempt();
    run.recordOutcome();
    run.recordPageSignal(leadEvent(startedAtMs - 1));
    expect(verdictFor(run).verdict.code).toBe("outcome_observed_event_missing");
  });

  it("classifies validation failures, server errors and attempts without success", () => {
    const invalid = new FormRun("generate_lead", startedAt, "granted");
    invalid.recordValidationFailure();
    expect(verdictFor(invalid).raw).toMatchObject({ submitAttempted: true, submissionResult: "validation_error" });
    expect(verdictFor(invalid).verdict.code).toBe("expected_non_conversion");

    const failed = new FormRun("generate_lead", startedAt, "granted");
    failed.recordAttempt();
    failed.recordResponseStatus(500);
    expect(verdictFor(failed).verdict.code).toBe("submission_failed");

    const rejected = new FormRun("generate_lead", startedAt, "granted");
    rejected.recordAttempt();
    rejected.recordResponseStatus(422);
    expect(verdictFor(rejected).verdict.code).toBe("expected_non_conversion");

    const attemptOnly = new FormRun("generate_lead", startedAt, "unknown");
    attemptOnly.recordAttempt();
    attemptOnly.recordResponseStatus(200);
    expect(verdictFor(attemptOnly).verdict.code).toBe("expected_non_conversion");
  });

  it("lets an observed success outrank an earlier validation failure in the same run", () => {
    const run = deliveredRun([fullLead]);
    run.recordValidationFailure();
    expect(verdictFor(run).verdict.code).toBe("browser_verified");
  });

  it("uses consent commands, then the gcs parameter, for the consent state", () => {
    const commanded = new FormRun("generate_lead", startedAt, "granted");
    commanded.recordAttempt();
    commanded.recordOutcome();
    commanded.recordPageSignal(leadEvent());
    commanded.recordPageSignal({ kind: "consent", analyticsStorage: "denied", at: startedAtMs + 5 });
    expect(verdictFor(commanded).verdict.code).toBe("consent_limited");

    const cookieless = deliveredRun([`${fullLead}&gcs=G100`], { consent: "unknown" });
    expect(verdictFor(cookieless).raw.consent).toBe("denied");
    expect(verdictFor(cookieless).verdict.code).toBe("consent_limited");
  });

  it("is not verified without a submit attempt", () => {
    const run = new FormRun("generate_lead", startedAt, "granted");
    expect(verdictFor(run).verdict.code).toBe("insufficient_observable_evidence");
  });

  it("survives serialization across a page navigation", () => {
    const run = new FormRun("generate_lead", startedAt, "granted");
    run.recordAttempt();
    run.recordTransport("redirect");
    const restored = FormRun.restore(JSON.parse(JSON.stringify(run.toJSON())));
    expect(restored).toBeDefined();
    restored!.recordOutcome();
    restored!.recordPageSignal(leadEvent());
    restored!.recordAnalyticsRequest({ id: "r1", url: fullLead, observedAt: startedAt });
    restored!.recordAnalyticsDelivery("r1", true);
    const result = verdictFor(restored!, { type: "thank_you_url", urlPattern: thankYouUrlPattern("https://example.test/thank-you") });
    expect(result.raw.transport).toBe("redirect");
    expect(result.verdict.code).toBe("browser_verified");
    expect(FormRun.restore({ eventName: 3 })).toBeUndefined();
  });

  it("keeps form values out of the serialized run and the evidence", () => {
    const run = deliveredRun([`${fullLead}&ep.email=${encodeURIComponent(sentinel)}&uid=${encodeURIComponent(sentinel)}`]);
    for (const signal of signalsFromDataLayerPush({ event: "generate_lead", email: sentinel, form_name: sentinel }, startedAtMs + 20)) run.recordPageSignal(signal);
    const { evidence } = verdictFor(run);
    expect(JSON.stringify(evidence)).not.toContain("private-sentinel");
    expect(JSON.stringify(run.toJSON())).not.toContain("private-sentinel");
  });
});
