import { describe, expect, it } from "vitest";
import {
  approveGa4ConfigurationPlan,
  createGa4ConfigurationPlan,
  ga4ConfigurationApprovalCurrent,
  validateGa4ActionReceipt,
  validateGa4ConfigurationPlan,
} from "./ga4-configuration.js";

function plan() {
  return createGa4ConfigurationPlan({
    id: "ga4_contact_setup",
    target: {
      propertyId: "550074997",
      propertyName: "Lead site",
      measurementId: "G-YV879ECLRV",
      streamId: "15443100029",
      streamName: "Lead site web",
    },
    providerStateFingerprint: "ga4_state_before",
    actions: [
      {
        id: "dimension_form_name",
        type: "custom_dimension" as const,
        parameterName: "form_name",
        displayName: "Form name",
        description: "Name of the submitted lead form",
        scope: "EVENT" as const,
      },
      {
        id: "metric_lead_value",
        type: "custom_metric" as const,
        parameterName: "lead_value",
        displayName: "Lead value",
        description: "Declared lead value",
        measurementUnit: "CURRENCY" as const,
        scope: "EVENT" as const,
        restrictedMetricTypes: ["REVENUE_DATA" as const],
      },
      {
        id: "key_event_generate_lead",
        type: "key_event" as const,
        eventName: "generate_lead",
        countingMethod: "ONCE_PER_EVENT" as const,
      },
    ],
  });
}

describe("separate GA4 configuration plans", () => {
  it("binds explicit approval to one property, plan, and provider-state fingerprint", () => {
    const draft = plan();
    const approved = approveGa4ConfigurationPlan(
      draft,
      "practitioner@example.test",
      "2026-08-24T15:00:00.000Z",
    );

    expect(validateGa4ConfigurationPlan(approved)).toEqual([]);
    expect(approved.approval).toMatchObject({
      approvedBy: "practitioner@example.test",
      planFingerprint: draft.planFingerprint,
      providerStateFingerprint: "ga4_state_before",
    });
    expect(ga4ConfigurationApprovalCurrent(
      approved,
      "ga4_state_before",
      Date.parse("2026-08-24T15:10:00.000Z"),
    )).toBe(true);
  });

  it("invalidates approval for provider drift, expiry, or an edited action", () => {
    const approved = approveGa4ConfigurationPlan(plan(), "operator", "2026-08-24T15:00:00.000Z");
    expect(ga4ConfigurationApprovalCurrent(approved, "ga4_state_changed", Date.parse("2026-08-24T15:01:00.000Z"))).toBe(false);
    expect(ga4ConfigurationApprovalCurrent(approved, "ga4_state_before", Date.parse("2026-08-24T15:31:00.000Z"))).toBe(false);

    const edited = structuredClone(approved);
    const keyEvent = edited.actions.find(({ type }) => type === "key_event");
    if (keyEvent?.type === "key_event") keyEvent.countingMethod = "ONCE_PER_SESSION";
    expect(validateGa4ConfigurationPlan(edited)).toContain("planFingerprint does not match the plan");
  });

  it("enforces event scope and the Admin API currency restrictions", () => {
    const subject = plan();
    const dimension = subject.actions[0] as Record<string, unknown>;
    dimension.scope = "USER";
    const metric = subject.actions[1] as Record<string, unknown>;
    metric.restrictedMetricTypes = [];
    expect(validateGa4ConfigurationPlan(subject)).toEqual(expect.arrayContaining([
      "actions[0].scope must be EVENT",
      "actions[1].currency metric requires a restricted metric type",
    ]));
  });

  it("validates an independently durable provider action receipt", () => {
    const subject = plan();
    expect(validateGa4ActionReceipt({
      schemaVersion: 1,
      planId: subject.id,
      planFingerprint: subject.planFingerprint,
      actionId: "dimension_form_name",
      actionType: "custom_dimension",
      propertyId: subject.target.propertyId,
      status: "created",
      resourceName: "properties/550074997/customDimensions/12",
      providerFingerprintAfter: "ga4_state_after",
      completedAt: "2026-08-24T15:12:00.000Z",
    })).toEqual([]);
  });
});
