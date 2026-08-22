import { describe, expect, it } from "vitest";
import {
  assertTrackingSpecification,
  navigationSpecification,
  validateTrackingRunEvidence,
  validateTrackingScenario,
  validateTrackingSpecification,
  type TrackingSpecificationV1,
} from "./contracts.js";

const navigation = [{
  id: "nav_contact",
  text: "Contact",
  href: "https://example.test/contact",
  area: "header" as const,
  selector: "header a.contact",
}];

describe("tracking specification contract", () => {
  it("round-trips a confirmed navigation specification", () => {
    const specification = navigationSpecification(
      "spec_navigation",
      "Track navigation links",
      "https://example.test/",
      navigation,
    );
    const roundTrip = JSON.parse(JSON.stringify(specification)) as unknown;
    expect(validateTrackingSpecification(roundTrip)).toEqual([]);
    assertTrackingSpecification(roundTrip);
    expect(roundTrip.event.name).toBe("navigation_click");
  });

  it("rejects unknown schema versions", () => {
    const specification = navigationSpecification("spec_navigation", "Track navigation", "https://example.test/", navigation);
    expect(validateTrackingSpecification({ ...specification, schemaVersion: 2 })).toContain("schemaVersion must be 1");
  });

  it("rejects incompatible interaction, outcome, and event combinations", () => {
    const specification = navigationSpecification("spec_navigation", "Track navigation", "https://example.test/", navigation);
    const invalid = {
      ...specification,
      event: { ...specification.event, name: "generate_lead" },
    } as unknown as TrackingSpecificationV1;
    expect(validateTrackingSpecification(invalid)).toContain("interaction, conversion outcome, and event are incompatible");
  });

  it("requires observable success evidence for forms", () => {
    const form = {
      schemaVersion: 1,
      id: "spec_lead",
      status: "confirmed",
      originalIntent: "Track successful leads",
      interaction: { type: "form_submission" },
      conversionOutcome: { type: "qualified_inquiry", practitionerConfirmed: true },
      event: { name: "generate_lead", requiredParameters: ["form_id"], optionalParameters: [] },
      targets: [{ id: "contact", label: "Contact", selector: "form#contact", pageUrl: "https://example.test/" }],
      successEvidence: [],
    };
    expect(validateTrackingSpecification(form)).toContain("form submissions require success evidence");
  });

  it("validates scenario and run-evidence envelopes", () => {
    expect(validateTrackingScenario({
      schemaVersion: 1,
      id: "navigation-pass",
      specificationFixture: "navigation.json",
      siteFixture: "navigation",
      environment: {},
      journey: [{ action: "click" }],
      expectedVerdict: "browser_verified",
    })).toEqual([]);
    expect(validateTrackingRunEvidence({
      schemaVersion: 1,
      runId: "run_1",
      specificationId: "spec_1",
      startedAt: "2026-08-22T12:00:00.000Z",
      observations: {
        interaction: { submissionResult: "success" },
        outcome: { observable: true },
        tagFired: true,
      },
      verdict: {
        code: "browser_verified",
        browserVerification: "passed",
        platformConfirmation: "unverified",
        nextAction: "Await platform confirmation.",
      },
    })).toEqual([]);
  });
});
