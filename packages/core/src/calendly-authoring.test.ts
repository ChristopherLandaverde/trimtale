import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  createCalendlySetupProposal,
  isCalendlyInlineUrl,
} from "./calendly-authoring.js";

interface AcceptanceFixture {
  schemaVersion: number;
  issue: string;
  feature: string;
  trustedOrigin: string;
  providerEvent: string;
  normalizedEvent: string;
  recognitionCases: Array<{ id: string; url: string; recognized: boolean }>;
  messageCases: Array<{ id: string; result: "accepted" | "rejected" }>;
  forbiddenSentinels: string[];
}

function acceptance(): AcceptanceFixture {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/calendly-completion-adapter.json"),
    "utf8",
  )) as AcceptanceFixture;
}

function request() {
  return {
    scope: "current_page" as const,
    pageUrl: "https://example.test/book?PRIVATE_PAGE_QUERY=secret",
    measurementId: "G-TEST123456",
    container: {
      accountId: "1",
      containerId: "2",
      publicId: "GTM-TEST123",
      name: "Test",
    },
  };
}

describe("Calendly completion authoring", () => {
  it("recognizes only Calendly-generated inline iframe URLs", () => {
    const fixture = acceptance();
    expect(fixture).toMatchObject({
      schemaVersion: 1,
      issue: ".scratch/gtm-setup-engine/issues/29-calendly-completion-adapter.md",
      feature: "calendly_completion_adapter",
      trustedOrigin: "https://calendly.com",
      providerEvent: "calendly.event_scheduled",
      normalizedEvent: "calendly_booking_complete",
    });
    for (const scenario of fixture.recognitionCases) {
      expect(isCalendlyInlineUrl(scenario.url), scenario.id).toBe(scenario.recognized);
    }
  });

  it("generates a guarded listener and one GA4 event setup", () => {
    const proposal = createCalendlySetupProposal(request());
    const listener = proposal.setup.tagActions.find(({ id }) => id === "tag_calendly_completion_listener");
    const ga4 = proposal.setup.tagActions.find(({ id }) => id === "tag_calendly_booking_complete");

    expect(listener).toMatchObject({
      execution: { type: "custom_html" },
      destination: { type: "external", identifier: "Calendly" },
      firingPolicyIds: ["policy_calendly_completion_listener"],
    });
    expect(ga4).toMatchObject({
      destination: { type: "ga4", measurementId: "G-TEST123456" },
      event: { name: "calendly_booking_complete", parameters: [] },
      firingPolicyIds: ["policy_calendly_booking_complete"],
    });
    expect(proposal.setup.browserEvidence).toMatchObject({
      interaction: "form_submission",
      outcome: { allowedEvidenceTypes: ["provider_completion"] },
      request: { eventName: "calendly_booking_complete", requiredParameters: ["page_location"] },
      duplicatePolicy: { minimum: 1, maximum: 1 },
      dataLayerEvent: "calendly_booking_complete",
    });
    expect(proposal.compiled.containerFile.containerVersion.tag).toHaveLength(2);
    expect(proposal.compiled.containerFile.containerVersion.trigger).toHaveLength(2);
  });

  it("executes the listener with exact origin, source, event, and duplicate checks", () => {
    const fixture = acceptance();
    const proposal = createCalendlySetupProposal(request());
    const listener = proposal.setup.tagActions.find(({ id }) => id === "tag_calendly_completion_listener");
    if (listener?.execution.type !== "custom_html") {
      throw new Error("Calendly listener is missing");
    }
    const expectedSource = {};
    const wrongSource = {};
    const frame = {
      src: "https://calendly.com/acme/demo?embed_type=Inline",
      contentWindow: expectedSource,
    };
    const listeners = new Map<string, (event: unknown) => void>();
    const window = {
      dataLayer: [] as unknown[],
      addEventListener: (type: string, listenerFn: (event: unknown) => void) => {
        listeners.set(type, listenerFn);
      },
    };
    let frameAvailable = false;
    const document = { querySelectorAll: () => frameAvailable ? [frame] : [] };
    const script = listener.execution.html.replace(/^<script>/, "").replace(/<\/script>$/, "");
    runInNewContext(script, { window, document, URL });
    const receive = listeners.get("message");
    if (!receive) {
      throw new Error("Calendly message listener is missing");
    }
    frameAvailable = true;
    const cases = [
      { id: "wrong_origin", origin: "https://attacker.example", source: expectedSource, data: { event: fixture.providerEvent } },
      { id: "wrong_source", origin: fixture.trustedOrigin, source: wrongSource, data: { event: fixture.providerEvent } },
      { id: "malformed_data", origin: fixture.trustedOrigin, source: expectedSource, data: fixture.providerEvent },
      { id: "non_completion", origin: fixture.trustedOrigin, source: expectedSource, data: { event: "calendly.date_and_time_selected" } },
      {
        id: "documented_completion",
        origin: fixture.trustedOrigin,
        source: expectedSource,
        data: {
          event: fixture.providerEvent,
          payload: {
            invitee: "PRIVATE_INVITEE_EMAIL",
            event: "PRIVATE_EVENT_URI",
            start: "PRIVATE_START_TIME",
          },
        },
      },
      { id: "repeated_completion", origin: fixture.trustedOrigin, source: expectedSource, data: { event: fixture.providerEvent } },
    ];
    const results = cases.map((scenario) => {
      const before = window.dataLayer.length;
      receive(scenario);
      return {
        id: scenario.id,
        result: window.dataLayer.length > before ? "accepted" : "rejected",
      };
    });

    expect(results).toEqual(fixture.messageCases);
    expect(window.dataLayer).toEqual([{ event: fixture.normalizedEvent }]);
    const artifacts = JSON.stringify({ setup: proposal.setup, emitted: window.dataLayer });
    for (const sentinel of fixture.forbiddenSentinels) {
      expect(artifacts).not.toContain(sentinel);
    }
  });
});
