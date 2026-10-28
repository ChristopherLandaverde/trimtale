import { describe, expect, it } from "vitest";
import type { SuccessEvidence, TrackingSpecificationV1 } from "./contracts.js";
import { compileTrackingSetup } from "./setup-compiler.js";
import { formSetup, navigationSetup } from "./setup-adapters.js";
import { validateTrackingSetup } from "./setup-contract.js";
import type { FormSetupRequest, SetupRequest } from "./types.js";

const container = {
  accountId: "1",
  containerId: "2",
  publicId: "GTM-TEST123",
  name: "Test",
};

function navigationRequest(): SetupRequest {
  return {
    intent: "Track navigation clicks",
    pageUrl: "https://example.test/",
    measurementId: "G-TEST123456",
    container,
    navigation: [{
      id: "pricing",
      text: "Pricing",
      href: "https://example.test/pricing",
      area: "nav",
      selector: "nav a[href='/pricing']",
    }],
  };
}

function formRequest(evidence: SuccessEvidence): FormSetupRequest {
  const specification: TrackingSpecificationV1 = {
    schemaVersion: 1,
    id: "spec_contact",
    status: "confirmed",
    originalIntent: "Track qualified contact inquiries",
    interaction: { type: "form_submission" },
    conversionOutcome: { type: "qualified_inquiry", practitionerConfirmed: true },
    event: {
      name: "generate_lead",
      requiredParameters: ["form_id", "form_name", "page_location"],
      optionalParameters: [],
    },
    targets: [{
      id: "contact",
      label: "Contact sales",
      selector: "form#contact",
      pageUrl: "https://example.test/",
    }],
    successEvidence: [evidence],
  };
  return { specification, measurementId: "G-TEST123456", container };
}

describe("legacy workflow setup adapters", () => {
  it("converts navigation into the generic contract and compiler", () => {
    const setup = navigationSetup(navigationRequest(), "setup_navigation_adapter");
    const compiled = compileTrackingSetup(setup, container);
    const trigger = compiled.containerFile.containerVersion.trigger[0] as {
      type: string;
      autoEventFilter: Array<{ parameter: Array<{ key?: string; value?: string }> }>;
    };
    const pattern = trigger.autoEventFilter[0]?.parameter
      .find(({ key }) => key === "arg1")?.value;

    expect(validateTrackingSetup(setup)).toEqual([]);
    expect(trigger.type).toBe("JUST_LINKS");
    expect(pattern).toContain("https://example\\.test/pricing");
    expect(compiled.containerFile.containerVersion.builtInVariable).toEqual([
      expect.objectContaining({ type: "CLICK_TEXT" }),
      expect.objectContaining({ type: "CLICK_URL" }),
    ]);
  });

  it.each([
    { type: "visible_element", selector: "#success" } as const,
    { type: "thank_you_url", urlPattern: "^https://example\\.test/thanks$" } as const,
    { type: "data_layer_event", eventName: "qualified_lead" } as const,
    { type: "same_page_success", signal: "contact_success" } as const,
  ])("converts $type form evidence through the same compiler", (evidence) => {
    const setup = formSetup(formRequest(evidence), `setup_form_${evidence.type}`);
    const compiled = compileTrackingSetup(setup, container);

    expect(validateTrackingSetup(setup)).toEqual([]);
    expect(compiled.containerFile.containerVersion.tag).toHaveLength(1);
    expect(compiled.containerFile.containerVersion.trigger).toHaveLength(1);
    expect(JSON.stringify(compiled.containerFile)).not.toMatch(/email|message|submittedFieldValue/);
  });
});
