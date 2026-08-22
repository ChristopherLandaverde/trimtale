import { describe, expect, it } from "vitest";
import { LocalRunEvidenceStore, normalizeFormRunEvidence, type RawFormRunObservation } from "./form-evidence.js";

const verdict = {
  code: "browser_verified" as const,
  browserVerification: "passed" as const,
  platformConfirmation: "unverified" as const,
  nextAction: "No browser fix is needed; await platform confirmation.",
};

function raw(transport: RawFormRunObservation["transport"]): RawFormRunObservation {
  return {
    runId: `run_${transport}`,
    specificationId: "spec_contact",
    startedAt: "2026-08-22T18:00:00.000Z",
    transport,
    targetId: "contact",
    submitAttempted: true,
    submissionResult: "success",
    outcomeObserved: true,
    outcomeObservable: true,
    outcomeEvidenceType: "visible_element",
    dataLayerEvents: [{ event: "generate_lead", form_id: "contact", form_name: "Contact_sales" }],
    tagFired: true,
    networkUrls: ["https://www.google-analytics.com/g/collect?v=2&tid=G-TEST123&en=generate_lead&ep.form_id=contact"],
    consent: "granted",
  };
}

describe("form run evidence normalization", () => {
  it.each(["native", "redirect", "ajax", "spa"] as const)("normalizes %s transport into the same evidence contract", (transport) => {
    const evidence = normalizeFormRunEvidence(raw(transport), verdict);
    expect(evidence.observations).toMatchObject({
      interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "success" },
      outcome: { observed: true, observable: true, evidenceType: "visible_element" },
      consent: { analyticsStorage: "granted" },
      tagFired: true,
    });
    expect(evidence.observations.dataLayer.matchingEvents).toHaveLength(1);
    expect(evidence.observations.network.ga4Requests).toHaveLength(1);
  });

  it("redacts form values, cookies, arbitrary page text, and unsafe request parameters", () => {
    const privateValue = "private-person@example.test";
    const input = raw("ajax") as RawFormRunObservation & Record<string, unknown>;
    input.formValues = { email: privateValue };
    input.cookies = `session=${privateValue}`;
    input.pageText = `Welcome ${privateValue}`;
    input.dataLayerEvents = [{ event: "generate_lead", email: privateValue, message: privateValue }];
    input.networkUrls = [`https://www.google-analytics.com/g/collect?v=2&en=generate_lead&ep.email=${encodeURIComponent(privateValue)}&ep.page_location=${encodeURIComponent(`https://example.test/contact?email=${privateValue}`)}`];
    const serialized = JSON.stringify(normalizeFormRunEvidence(input, verdict));
    expect(serialized).not.toContain(privateValue);
    expect(serialized).not.toContain("ep.email");
    expect(serialized).toContain("https%3A%2F%2Fexample.test%2Fcontact");
  });

  it("marks unobservable cases through supplied inconclusive verdicts without fabricating observations", () => {
    const input = raw("unobservable");
    input.outcomeObserved = false;
    input.outcomeObservable = false;
    delete input.outcomeEvidenceType;
    input.dataLayerEvents = [];
    input.tagFired = null;
    input.networkUrls = [];
    const evidence = normalizeFormRunEvidence(input, {
      code: "insufficient_observable_evidence",
      browserVerification: "inconclusive",
      platformConfirmation: "unverified",
      nextAction: "Inspect the form manually and identify a safe success signal.",
    });
    expect(evidence.observations.outcome).toEqual({ observed: false, observable: false });
    expect(evidence.verdict.browserVerification).toBe("inconclusive");
    expect(evidence.observations.tagFired).toBeNull();
  });

  it("stores immutable local debugging artifacts", () => {
    const store = new LocalRunEvidenceStore();
    const evidence = normalizeFormRunEvidence(raw("ajax"), verdict);
    store.save(evidence);
    const first = store.get(evidence.runId)!;
    first.observations.dataLayer.matchingEvents.push({ event: "tampered" });
    expect(store.get(evidence.runId)?.observations.dataLayer.matchingEvents).toHaveLength(1);
  });
});
