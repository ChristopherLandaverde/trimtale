import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface GuidedJourneyAcceptance {
  schemaVersion: number;
  stages: string[];
  starterLimit: number;
  compactContext: {
    healthyKinds: string[];
    expandedByDefault: boolean;
    requiredSummary: string[];
  };
  artifactKinds: string[];
  resumableCheckpoints: string[];
  approvalInvariants: string[];
  queueBoundary: { allowed: string[]; forbidden: string[] };
  forbiddenResumeFields: string[];
  completion: string[];
}

const contract = JSON.parse(readFileSync(
  resolve(process.cwd(), "tests/acceptance/guided-task-journey.json"),
  "utf8",
)) as GuidedJourneyAcceptance;

describe("guided task journey acceptance", () => {
  it("keeps one complete ordered setup journey", () => {
    expect(contract.schemaVersion).toBe(1);
    expect(contract.stages).toEqual(["define", "review", "apply", "test", "publish", "verify"]);
    expect(contract.starterLimit).toBe(3);
    expect(contract.compactContext).toEqual({
      healthyKinds: ["recognized"],
      expandedByDefault: false,
      requiredSummary: ["container_name", "public_id", "effective_access"],
    });
    expect(contract.artifactKinds).toEqual(expect.arrayContaining([
      "specification", "plan", "receipt", "binding", "evidence",
    ]));
  });

  it("preserves authority and private-data boundaries", () => {
    expect(contract.approvalInvariants).toEqual([
      "apply_requires_exact_visible_plan_action",
      "publication_requires_exact_visible_version_action",
      "rollback_requires_exact_visible_target_action",
    ]);
    expect(contract.queueBoundary).toEqual({
      allowed: ["pending_conversation_response"],
      forbidden: ["provider_mutation_cancel", "provider_mutation_steer"],
    });
    expect(contract.forbiddenResumeFields).toEqual(expect.arrayContaining([
      "prompt", "form_value", "cookie", "credential", "identity", "page_text",
    ]));
    expect(contract.resumableCheckpoints).toHaveLength(5);
    expect(contract.completion).toEqual(["live_and_verified", "copy_summary", "start_another_setup"]);
  });
});
