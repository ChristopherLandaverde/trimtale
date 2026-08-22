import { describe, expect, it } from "vitest";
import type { SuccessEvidence, TrackingSpecificationV1 } from "./contracts.js";
import { createFormSetupProposal, validateFormSetupRequest } from "./generator.js";
import type { FormSetupRequest } from "./types.js";

function request(evidence: SuccessEvidence, overrides: Partial<TrackingSpecificationV1> = {}): FormSetupRequest {
  return {
    measurementId: "G-TEST123456",
    container: { accountId: "1", containerId: "2", publicId: "GTM-TEST123", name: "Test" },
    specification: {
      schemaVersion: 1,
      id: "spec_contact",
      status: "confirmed",
      originalIntent: "Track qualified contact inquiries",
      interaction: { type: "form_submission" },
      conversionOutcome: { type: "qualified_inquiry", practitionerConfirmed: true },
      event: { name: "generate_lead", requiredParameters: ["form_id", "form_name", "page_location"], optionalParameters: [] },
      targets: [{ id: "contact", label: "Contact sales", selector: "form#contact", pageUrl: "https://example.test/" }],
      successEvidence: [evidence],
      ...overrides,
    },
  };
}

describe("confirmed form setup generation", () => {
  it.each([
    [{ type: "visible_element", selector: "#contact-success" } as const, "ELEMENT_VISIBILITY", "#contact-success"],
    [{ type: "thank_you_url", urlPattern: "^https://example\\.test/thank-you$" } as const, "PAGEVIEW", "thank-you"],
    [{ type: "data_layer_event", eventName: "qualified_lead" } as const, "CUSTOM_EVENT", "qualified_lead"],
    [{ type: "same_page_success", signal: "contact_success" } as const, "CUSTOM_EVENT", "contact_success"],
  ])("generates a trigger for %s evidence", (evidence, triggerType, expectedValue) => {
    const proposal = createFormSetupProposal(request(evidence));
    expect(proposal.eventName).toBe("generate_lead");
    expect(proposal.containerFile.containerVersion.trigger).toHaveLength(1);
    expect(proposal.containerFile.containerVersion.trigger[0]).toMatchObject({ type: triggerType });
    expect(JSON.stringify(proposal.containerFile.containerVersion.trigger[0])).toContain(expectedValue);
    expect(proposal.warnings.join(" ")).toMatch(/Merge.*new GTM workspace/);
    expect(proposal.warnings.join(" ")).toContain("does not confirm GA4 platform processing");
  });

  it("rejects draft, incomplete, navigation, and unsafe specifications", () => {
    expect(validateFormSetupRequest(request({ type: "visible_element", selector: "#success" }, { status: "draft" }))).toContain("Form setup requires a confirmed specification.");
    expect(validateFormSetupRequest(request({ type: "visible_element", selector: "#success" }, { successEvidence: [] })).join(" ")).toContain("require success evidence");
    expect(validateFormSetupRequest(request({ type: "visible_element", selector: "#success" }, {
      interaction: { type: "navigation_click" },
      conversionOutcome: { type: "navigation", practitionerConfirmed: true },
      event: { name: "navigation_click", requiredParameters: ["link_url"], optionalParameters: [] },
    })).join(" ")).toContain("form_submission generate_lead");
    expect(validateFormSetupRequest(request({ type: "visible_element", selector: "<img onerror=alert(1)>" })).join(" ")).toContain("unsafe");
    expect(validateFormSetupRequest(request({ type: "visible_element", selector: "#success" }, {
      event: { name: "generate_lead", requiredParameters: ["form_id"], optionalParameters: [] },
    })).join(" ")).toContain("page_location");
    const malformed = request({ type: "visible_element", selector: "#success" });
    malformed.specification.successEvidence = [{ type: "visible_element" } as SuccessEvidence];
    expect(validateFormSetupRequest(malformed).join(" ")).toContain("successEvidence[0] is invalid");
  });

  it("includes required form metadata without submitted values", () => {
    const input = request({ type: "visible_element", selector: "#contact-success" }) as FormSetupRequest & { submittedFieldValue?: string };
    input.submittedFieldValue = "private-person@example.test";
    const proposal = createFormSetupProposal(input);
    const output = JSON.stringify(proposal.containerFile);
    expect(output).toContain("form_id");
    expect(output).toContain("form_name");
    expect(output).toContain("page_location");
    expect(output).not.toContain("private-person@example.test");
    expect(proposal.containerFile.containerVersion.tag).toHaveLength(1);
    expect(proposal.containerFile.containerVersion.builtInVariable).toEqual([
      expect.objectContaining({ type: "PAGE_URL", name: "Page URL" }),
    ]);
  });
});
