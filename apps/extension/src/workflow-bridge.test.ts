import { describe, expect, it } from "vitest";
import { workflowResultFromStoredOperation } from "./workflow-bridge.js";

describe("workflowResultFromStoredOperation", () => {
  it.each([
    ["approved", "publish"],
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

  it("maps a rollback-required operation with a recorded rollback approval to the separate rollback step", () => {
    const operation = {
      id: "operation_1",
      status: "rollback_required",
      rollback: {
        targetVersionFingerprint: "live-7",
        status: "required",
        approval: { approvedAt: "2026-08-30T20:06:00.000Z", approvedBy: "practitioner@example.test", targetVersionFingerprint: "live-7" },
      },
    };
    expect(workflowResultFromStoredOperation(operation)).toEqual({ status: "rollback_approved", operation, nextStep: "rollback" });
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
    // "approved" is now a durable state between the approve and publish requests (mapped above).
    expect(workflowResultFromStoredOperation({ id: "operation_1", status: "verification_failed" })).toEqual({
      status: "blocked",
      operation: { id: "operation_1", status: "verification_failed" },
      stage: "version",
      reason: "operation_verification_failed",
    });
    expect(workflowResultFromStoredOperation({ id: "operation_2" })).toEqual({
      status: "blocked",
      operation: { id: "operation_2" },
      stage: "version",
      reason: "operation_unknown",
    });
  });
});
