import { describe, expect, it } from "vitest";
import { workflowResultFromStoredOperation } from "./workflow-bridge.js";

describe("workflowResultFromStoredOperation", () => {
  it.each([
    ["published", "verify_publication"],
    ["completed", "platform_unavailable"],
    ["rollback_required", "rollback_approval"],
    ["rolled_back", "complete"],
  ] as const)("maps %s to %s", (status, nextStep) => {
    expect(workflowResultFromStoredOperation({ id: "operation_1", status })).toEqual({
      status,
      operation: { id: "operation_1", status },
      nextStep,
    });
  });

  it.each([
    ["planned", "paused", "planning", "ready_to_apply"],
    ["applying", "paused", "application", "partial_application"],
    ["applied", "paused", "validation", "ready_to_validate"],
    ["validated", "paused", "version", "ready_to_version"],
    ["validation_failed", "blocked", "validation", "validation_failed"],
  ] as const)("maps resumable stored %s operations", (operationStatus, status, stage, reason) => {
    expect(workflowResultFromStoredOperation({ id: "operation_1", status: operationStatus })).toEqual({
      status,
      operation: { id: "operation_1", status: operationStatus },
      stage,
      reason,
    });
  });

  it("fails closed for unsupported stored operation states", () => {
    expect(workflowResultFromStoredOperation({ id: "operation_1", status: "approved" })).toEqual({
      status: "blocked",
      operation: { id: "operation_1", status: "approved" },
      stage: "version",
      reason: "operation_approved",
    });
    expect(workflowResultFromStoredOperation({ id: "operation_2" })).toEqual({
      status: "blocked",
      operation: { id: "operation_2" },
      stage: "version",
      reason: "operation_unknown",
    });
  });
});
