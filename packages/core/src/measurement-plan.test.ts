import { describe, expect, it } from "vitest";
import {
  createIntakeInterpretationInputV2,
  createMeasurementPlan,
  selectMeasurementPlanItem,
  validateMeasurementPlanV1,
  type AgentTurnContext,
  type ConversationPageContext,
  type IntakeInterpretationV2,
} from "./index.js";

const page: ConversationPageContext = {
  navigationCount: 2,
  forms: [{
    id: "contact-sales",
    label: "Contact sales",
    selector: "form#contact-sales",
    pageUrl: "https://example.test/resources",
    successSignals: [{
      id: "contact-success",
      label: "Inquiry received",
      type: "visible_element",
      value: "#contact-success",
    }],
  }],
  interactionCounts: { file_download: 1, phone_click: 1 },
};

const context: AgentTurnContext = {
  formCount: 1,
  navigationCount: 2,
  interactionCounts: { file_download: 1, phone_click: 1 },
  automaticCoverage: {
    enabled: true,
    pageViews: true,
    scrolls: true,
    outboundClicks: true,
    siteSearch: true,
    videoEngagement: true,
    fileDownloads: true,
    formInteractions: true,
  },
  connection: { publicId: "GTM-TEST123", measurementId: "G-TEST123456" },
};

const authority = {
  canConfirmSpecification: false as const,
  canWriteGtm: false as const,
  canReportEvidenceVerdict: false as const,
  canClaimPlatformReceipt: false as const,
};

function interpretation(): IntakeInterpretationV2 {
  return {
    schemaVersion: 2,
    statedOutcome: "Understand high-intent visitor outcomes",
    measurements: [
      {
        id: "qualified_inquiry",
        conversionOutcome: "Qualified inquiry",
        interactionCandidate: "form_submission",
        groundedTargetCandidateIds: ["form_1"],
        groundedSuccessEvidenceCandidateIds: ["form_1_evidence_1"],
      },
      {
        id: "resource_download",
        conversionOutcome: "Resource download",
        interactionCandidate: "file_download",
        groundedTargetCandidateIds: ["downloads_on_page"],
        groundedSuccessEvidenceCandidateIds: [],
      },
      {
        id: "phone_conversation",
        conversionOutcome: "Phone conversation",
        interactionCandidate: "phone_click",
        groundedTargetCandidateIds: ["phone_on_page"],
        groundedSuccessEvidenceCandidateIds: [],
      },
    ],
    ambiguities: ["multiple_measurements"],
    clarification: "Which measurable activity should we start with?",
    authority,
  };
}

describe("measurement plan", () => {
  it("classifies grounded activities and starts one exact existing intake", () => {
    const input = createIntakeInterpretationInputV2(
      "Track leads, resource downloads, and phone conversations",
      page,
    );
    const creation = createMeasurementPlan(input, interpretation(), page, context);

    expect(creation?.plan).toMatchObject({
      schemaVersion: 1,
      statedOutcome: "Understand high-intent visitor outcomes",
      recommendedItemId: "qualified_inquiry",
      items: [
        {
          id: "qualified_inquiry",
          conversionOutcome: "Qualified inquiry",
          interaction: "form_submission",
          targetLabels: ["Contact sales"],
          successEvidenceLabels: ["Inquiry received"],
          status: "ready",
          action: "start",
        },
        {
          id: "resource_download",
          interaction: "file_download",
          targetLabels: ["Downloadable file links on this page"],
          status: "already_covered",
          action: "start",
        },
        {
          id: "phone_conversation",
          interaction: "phone_click",
          targetLabels: ["Phone links on this page"],
          status: "ready",
          action: "start",
        },
      ],
      authority,
    });
    expect(validateMeasurementPlanV1(creation?.plan)).toEqual([]);
    expect(selectMeasurementPlanItem(creation!, "qualified_inquiry", page)).toMatchObject({
      interaction: "form_submission",
      state: "draft_ready",
      eventName: "generate_lead",
      target: { id: "contact-sales" },
    });
    expect(selectMeasurementPlanItem(creation!, "invented_item", page)).toBeUndefined();
    expect(selectMeasurementPlanItem(
      creation!,
      "qualified_inquiry",
      { ...page, forms: [] },
    )).toBeUndefined();
  });

  it("keeps ambiguous and unsupported activities non-startable", () => {
    const input = createIntakeInterpretationInputV2("Measure engagement and something else", page);
    const result = interpretation();
    result.measurements = [
      result.measurements[0]!,
      {
        id: "unknown_activity",
        conversionOutcome: "Meaningful engagement",
        interactionCandidate: "unknown",
        groundedTargetCandidateIds: [],
        groundedSuccessEvidenceCandidateIds: [],
      },
    ];
    result.ambiguities = ["interaction"];
    result.clarification = "What visitor action should represent meaningful engagement?";

    const creation = createMeasurementPlan(input, result, page, context);

    expect(creation?.plan.items).toEqual([
      expect.objectContaining({ id: "qualified_inquiry", status: "needs_clarification", action: "none" }),
      expect.objectContaining({ id: "unknown_activity", status: "unsupported", action: "none" }),
    ]);
    expect(creation?.plan.recommendedItemId).toBeNull();
    expect(selectMeasurementPlanItem(creation!, "qualified_inquiry", page)).toBeUndefined();
    expect(selectMeasurementPlanItem(creation!, "unknown_activity", page)).toBeUndefined();
  });

  it("rejects invalid plans and invalid provider grounding", () => {
    const input = createIntakeInterpretationInputV2("Track several outcomes", page);
    const invented = interpretation();
    invented.measurements[1]!.groundedTargetCandidateIds = ["invented_download"];

    expect(createMeasurementPlan(input, invented, page, context)).toBeUndefined();
    expect(validateMeasurementPlanV1({
      schemaVersion: 1,
      statedOutcome: "Several outcomes",
      recommendedItemId: "invented_item",
      items: [],
      authority,
    })).toContain("plan.items must contain 2 to 12 items");
    expect(validateMeasurementPlanV1({
      schemaVersion: 1,
      statedOutcome: "Several outcomes",
      recommendedItemId: null,
      items: [
        {
          id: "first",
          conversionOutcome: "First outcome",
          interaction: "phone_click",
          targetLabels: ["Phone links on this page"],
          successEvidenceLabels: [],
          status: "ready",
          summary: "A supported phone interaction is present.",
          action: "start",
        },
        {
          id: "second",
          conversionOutcome: "Second outcome",
          interaction: "unknown",
          targetLabels: [],
          successEvidenceLabels: [],
          status: "unsupported",
          summary: "This interaction is not supported.",
          action: "none",
        },
      ],
      authority,
    })).toContain("plan.recommendedItemId is required when an item is startable");
  });
});
