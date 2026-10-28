import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface CallbackCase {
  id: string;
  origin: string;
  data: unknown;
  expected: "accepted" | "rejected";
}

interface CallbackAcceptance {
  schemaVersion: number;
  provider: string;
  trustedOrigin: string;
  completionEvent: string;
  providerDuplicateGuarantee: string;
  consumerDuplicatePolicy: string;
  allowlistedPayloadFields: string[];
  normalizedEvent: Record<string, string>;
  destinationRequest: {
    host: string;
    eventName: string;
    requiredParameters: string[];
  };
  cases: CallbackCase[];
  forbiddenSentinels: string[];
}

interface ProofArtifacts {
  dataLayer: Array<Record<string, string>>;
  requests: Array<{
    host: string;
    eventName: string;
    parameters: string[];
  }>;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function runProof(acceptance: CallbackAcceptance): {
  results: Array<{ id: string; result: CallbackCase["expected"] }>;
  artifacts: ProofArtifacts;
} {
  let completionAccepted = false;
  const artifacts: ProofArtifacts = { dataLayer: [], requests: [] };
  const results = acceptance.cases.map((scenario) => {
    const eventName = record(scenario.data) ? scenario.data.event : undefined;
    const accepted = !completionAccepted
      && scenario.origin === acceptance.trustedOrigin
      && eventName === acceptance.completionEvent;

    if (!accepted) {
      return { id: scenario.id, result: "rejected" as const };
    }

    completionAccepted = true;
    artifacts.dataLayer.push(acceptance.normalizedEvent);
    artifacts.requests.push({
      host: acceptance.destinationRequest.host,
      eventName: acceptance.destinationRequest.eventName,
      parameters: acceptance.destinationRequest.requiredParameters,
    });

    return { id: scenario.id, result: "accepted" as const };
  });

  return { results, artifacts };
}

function loadAcceptance(): CallbackAcceptance {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/calendly-cross-origin-callback.json"),
    "utf8",
  )) as CallbackAcceptance;
}

describe("Calendly cross-origin callback discovery", () => {
  it("accepts one exact-origin completion and rejects unsafe alternatives", () => {
    const acceptance = loadAcceptance();
    const proof = runProof(acceptance);

    expect(acceptance).toMatchObject({
      schemaVersion: 1,
      provider: "calendly",
      trustedOrigin: "https://calendly.com",
      completionEvent: "calendly.event_scheduled",
      providerDuplicateGuarantee: "not_documented",
      consumerDuplicatePolicy: "accept_first_completion_per_page_lifecycle",
      allowlistedPayloadFields: [],
    });
    expect(acceptance.cases.map(({ id, expected }) => ({ id, expected }))).toEqual([
      { id: "wrong_origin", expected: "rejected" },
      { id: "lookalike_origin", expected: "rejected" },
      { id: "malformed_message", expected: "rejected" },
      { id: "non_completion_event", expected: "rejected" },
      { id: "documented_completion", expected: "accepted" },
      { id: "repeated_completion", expected: "rejected" },
    ]);
    expect(proof.results).toEqual(acceptance.cases.map(({ id, expected }) => ({
      id,
      result: expected,
    })));
  });

  it("demonstrates one privacy-safe data-layer event and destination request", () => {
    const acceptance = loadAcceptance();
    const proof = runProof(acceptance);
    const artifacts = JSON.stringify(proof.artifacts);

    expect(acceptance.normalizedEvent).toEqual({ event: "calendly_booking_complete" });
    expect(acceptance.destinationRequest).toEqual({
      host: "www.google-analytics.com",
      eventName: "calendly_booking_complete",
      requiredParameters: ["page_location"],
    });
    expect(acceptance.forbiddenSentinels).toEqual([
      "PRIVATE_INVITEE_URI",
      "PRIVATE_EMAIL",
      "PRIVATE_EVENT_URI",
      "PRIVATE_START_TIME",
      "PRIVATE_REPEAT_INVITEE_URI",
    ]);
    expect(proof.artifacts.dataLayer).toHaveLength(1);
    expect(proof.artifacts.requests).toHaveLength(1);
    for (const sentinel of acceptance.forbiddenSentinels) {
      expect(artifacts).not.toContain(sentinel);
    }
  });
});
