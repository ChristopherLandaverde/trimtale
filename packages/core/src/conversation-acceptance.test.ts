import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface ConversationAcceptanceContract {
  schemaVersion: number;
  issue: string;
  feature: string;
  behavioralTests: string[];
  cases: Array<{
    id: string;
    message: string;
    page: {
      navigationCount: number;
      forms: Array<{ id: string; label: string; successSignals: string[] }>;
    };
    expected: {
      interaction: string;
      state: string;
      eventName?: string;
      canConfirm: boolean;
    };
  }>;
}

export function loadConversationAcceptance(): ConversationAcceptanceContract {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/conversation-intake.json"),
    "utf8",
  )) as ConversationAcceptanceContract;
}

describe("issue 03 conversation-intake acceptance contract", () => {
  it("binds deterministic and browser tests to the same cases", () => {
    const contract = loadConversationAcceptance();
    expect(contract.schemaVersion).toBe(1);
    expect(contract.behavioralTests).toEqual([
      "packages/core/src/conversation.test.ts",
      "tests/e2e/conversation-intake.spec.ts",
    ]);
    expect(contract.cases.map((item) => item.id)).toEqual([
      "navigation-remains-supported",
      "ambiguous-form-requires-target",
      "ambiguous-success-requires-evidence",
      "complete-form-intent-produces-draft",
      "phone-is-recognized-but-unsupported",
      "unknown-intent-requests-interaction",
    ]);
  });

  it("requires ambiguity and unsupported paths to remain unconfirmable", () => {
    const cases = loadConversationAcceptance().cases;
    expect(cases.filter((item) => item.expected.state.startsWith("awaiting_") || item.expected.state === "unsupported")
      .every((item) => item.expected.canConfirm === false)).toBe(true);
    expect(cases.find((item) => item.id === "complete-form-intent-produces-draft")?.expected)
      .toMatchObject({ state: "draft_ready", eventName: "generate_lead", canConfirm: true });
  });
});
