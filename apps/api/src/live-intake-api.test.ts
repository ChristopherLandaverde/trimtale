import {
  createIntakeInterpretationInputV2,
  organizationAuthority,
  type IntakeInterpretationV2,
} from "@gtm-observability/core";
import { describe, expect, it, vi } from "vitest";
import { LiveIntakeService } from "./live-intake-api.js";

const input = createIntakeInterpretationInputV2("Track lead generation", {
  navigationCount: 0,
  forms: [{
    id: "contact",
    label: "Contact sales",
    selector: "form#contact",
    pageUrl: "https://example.test/",
    successSignals: [{
      id: "success",
      label: "Inquiry received",
      type: "visible_element",
      value: "#success",
    }],
  }],
});

const interpretation: IntakeInterpretationV2 = {
  schemaVersion: 2,
  statedOutcome: "Generate qualified inquiries",
  measurements: [{
    id: "qualified_inquiry_form",
    conversionOutcome: "Qualified inquiry",
    interactionCandidate: "form_submission",
    groundedTargetCandidateIds: ["form_1"],
    groundedSuccessEvidenceCandidateIds: ["form_1_evidence_1"],
  }],
  ambiguities: [],
  clarification: null,
  authority: {
    canConfirmSpecification: false,
    canWriteGtm: false,
    canReportEvidenceVerdict: false,
    canClaimPlatformReceipt: false,
  },
};

describe("live intake API service", () => {
  it("returns one validated non-authoritative interpretation for an exact organization", async () => {
    const provider = {
      interpretLive: vi.fn(async () => structuredClone(interpretation)),
    };
    const service = new LiveIntakeService("org_beta", provider);
    const authority = organizationAuthority({
      organizationId: "org_beta",
      membershipId: "mem_member",
      role: "member",
    });
    const controller = new AbortController();

    await expect(service.interpret(authority, input, controller.signal)).resolves.toEqual(
      interpretation,
    );
    expect(provider.interpretLive).toHaveBeenCalledWith(input, controller.signal);
  });

  it("rejects wrong-organization authority and invalid input before provider execution", async () => {
    const provider = { interpretLive: vi.fn(async () => interpretation) };
    const service = new LiveIntakeService("org_beta", provider);
    const attacker = organizationAuthority({
      organizationId: "org_other",
      membershipId: "mem_other",
      role: "admin",
    });

    await expect(service.interpret(attacker, input, new AbortController().signal))
      .rejects.toThrow("Organization write permission is required");
    await expect(service.interpret(
      organizationAuthority({ organizationId: "org_beta", membershipId: "mem_member", role: "member" }),
      { ...input, fullHtml: "<form>private</form>" },
      new AbortController().signal,
    )).rejects.toThrow("Live intake input is invalid");
    expect(provider.interpretLive).not.toHaveBeenCalled();
  });

  it("rejects invalid provider output without returning it", async () => {
    const provider = {
      interpretLive: vi.fn(async () => ({
        ...interpretation,
        measurements: [{
          ...interpretation.measurements[0],
          groundedTargetCandidateIds: ["invented_target"],
        }],
      })),
    };
    const service = new LiveIntakeService("org_beta", provider);
    const authority = organizationAuthority({
      organizationId: "org_beta",
      membershipId: "mem_member",
      role: "member",
    });

    await expect(service.interpret(authority, input, new AbortController().signal))
      .rejects.toThrow("Live intake provider output is invalid");
  });
});
