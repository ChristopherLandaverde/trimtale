import { describe, expect, it } from "vitest";
import { formFixtureScenarios, getFormFixtureScenario } from "./form-scenarios.js";

const requiredIds = [
  "successful_correct", "validation_failure", "attempt_only", "ajax_success",
  "thank_you_redirect", "spa_success", "outcome_event_missing", "datalayer_tag_not_firing",
  "tag_fired_request_missing", "missing_required_parameter", "duplicate_request", "consent_denied",
  "server_error", "dynamic_form", "multiple_forms", "cross_origin_iframe",
];

describe("deterministic form fixture matrix", () => {
  it("contains every accepted scenario exactly once", () => {
    expect(Object.keys(formFixtureScenarios)).toEqual(requiredIds);
    expect(new Set(Object.values(formFixtureScenarios).map((item) => item.id)).size).toBe(16);
  });

  it("keeps non-conversions and unavailable evidence from emitting analytics signals", () => {
    for (const id of ["validation_failure", "attempt_only", "server_error", "cross_origin_iframe"]) {
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

  it("selects explicit presentations and defaults unknown IDs safely", () => {
    expect(getFormFixtureScenario("dynamic_form").presentation).toBe("dynamic");
    expect(getFormFixtureScenario("multiple_forms").presentation).toBe("multiple");
    expect(getFormFixtureScenario("cross_origin_iframe").presentation).toBe("cross_origin_iframe");
    expect(getFormFixtureScenario("unknown").id).toBe("successful_correct");
  });
});
