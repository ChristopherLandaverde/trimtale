import { describe, expect, it } from "vitest";
import { formEndpointStatus, formFixtureScenarios, getFormFixtureScenario } from "./form-scenarios.js";

const requiredIds = [
  "successful_correct", "validation_failure", "html5_validation_failure", "attempt_only", "ajax_success",
  "thank_you_redirect", "spa_success", "outcome_event_missing", "datalayer_tag_not_firing",
  "tag_fired_request_missing", "missing_required_parameter", "duplicate_request", "consent_denied",
  "server_error", "dynamic_form", "multiple_forms", "embedded_form", "server_error_with_success_event",
  "redirect_server_error", "endpoint_rejection_with_success_event", "server_error_retry_success",
  "third_party_error_after_success", "cross_origin_iframe",
];

describe("deterministic form fixture matrix", () => {
  it("contains every accepted scenario exactly once", () => {
    expect(Object.keys(formFixtureScenarios)).toEqual(requiredIds);
    expect(new Set(Object.values(formFixtureScenarios).map((item) => item.id)).size).toBe(23);
  });

  it("keeps non-conversions and unavailable evidence from emitting analytics signals", () => {
    for (const id of ["validation_failure", "html5_validation_failure", "attempt_only", "server_error", "cross_origin_iframe"]) {
      expect(getFormFixtureScenario(id)).toMatchObject({ outcomeObserved: false, dataLayerEvent: false, ga4RequestCount: 0 });
    }
  });

  it("makes each diagnostic tracking state observable and reproducible", () => {
    expect(getFormFixtureScenario("datalayer_tag_not_firing")).toMatchObject({ dataLayerEvent: true, tagFired: false, ga4RequestCount: 0 });
    expect(getFormFixtureScenario("tag_fired_request_missing")).toMatchObject({ dataLayerEvent: true, tagFired: true, ga4RequestCount: 0 });
    expect(getFormFixtureScenario("missing_required_parameter")).toMatchObject({ ga4RequestCount: 1, includeRequiredParameters: false });
    expect(getFormFixtureScenario("duplicate_request")).toMatchObject({ ga4RequestCount: 2 });
    expect(getFormFixtureScenario("consent_denied")).toMatchObject({ consent: "denied", ga4RequestCount: 0 });
  });

  it("models a page that reports success after its form endpoint failed", () => {
    for (const id of ["server_error_with_success_event", "redirect_server_error", "endpoint_rejection_with_success_event"]) {
      expect(getFormFixtureScenario(id)).toMatchObject({ reportsSuccessOnFailure: true, outcomeObserved: true, dataLayerEvent: true, ga4RequestCount: 1 });
    }
    expect(formEndpointStatus(getFormFixtureScenario("server_error_with_success_event"))).toBe(503);
    expect(formEndpointStatus(getFormFixtureScenario("redirect_server_error"))).toBe(503);
    expect(getFormFixtureScenario("redirect_server_error").transport).toBe("redirect");
    expect(formEndpointStatus(getFormFixtureScenario("endpoint_rejection_with_success_event"))).toBe(422);
    expect(getFormFixtureScenario("endpoint_rejection_with_success_event")).toMatchObject({ submissionResult: "validation_error", validation: "endpoint" });
  });

  it("fails only the first attempt of a retrying form and keeps default endpoint statuses", () => {
    const retry = getFormFixtureScenario("server_error_retry_success");
    expect([formEndpointStatus(retry, 1), formEndpointStatus(retry, 2)]).toEqual([503, 200]);
    expect(formEndpointStatus(getFormFixtureScenario("server_error"))).toBe(500);
    expect(formEndpointStatus(getFormFixtureScenario("successful_correct"))).toBe(200);
    expect(getFormFixtureScenario("third_party_error_after_success")).toMatchObject({ submissionResult: "success", thirdPartyErrorAfterSubmit: true });
  });

  it("selects explicit presentations and defaults unknown IDs safely", () => {
    expect(getFormFixtureScenario("dynamic_form").presentation).toBe("dynamic");
    expect(getFormFixtureScenario("multiple_forms").presentation).toBe("multiple");
    expect(getFormFixtureScenario("embedded_form").presentation).toBe("embedded");
    expect(getFormFixtureScenario("html5_validation_failure").validation).toBe("html5");
    expect(getFormFixtureScenario("cross_origin_iframe").presentation).toBe("cross_origin_iframe");
    expect(getFormFixtureScenario("unknown").id).toBe("successful_correct");
  });
});
