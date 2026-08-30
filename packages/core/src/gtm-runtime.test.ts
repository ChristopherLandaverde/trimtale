import { describe, expect, it } from "vitest";
import { observeGtmRuntime } from "./gtm-runtime.js";

describe("GTM runtime observation", () => {
  it("reports public container IDs found in safe script metadata", () => {
    expect(observeGtmRuntime({ inspectionAvailable: true, scriptUrls: ["https://www.googletagmanager.com/gtm.js?id=GTM-test123"] }))
      .toEqual({ status: "detected", containerIds: ["GTM-TEST123"] });
  });
  it("reports not detected when inspection succeeds without GTM signals", () => {
    expect(observeGtmRuntime({ inspectionAvailable: true, scriptUrls: [] }))
      .toEqual({ status: "not_detected", containerIds: [] });
  });
  it("does not turn unavailable inspection into an absence claim", () => {
    expect(observeGtmRuntime({ inspectionAvailable: false, scriptUrls: [] })).toEqual({
      status: "inconclusive", containerIds: [], reason: "Page runtime could not be inspected",
    });
  });
});
