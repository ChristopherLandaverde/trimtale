import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  interpretConversationIntent,
  selectConversationSuccess,
  selectConversationTarget,
  type ConversationPageContext,
  type FormCandidate,
} from "./conversation.js";

interface FixtureCase {
  id: string;
  message: string;
  page: {
    navigationCount: number;
    forms: Array<{ id: string; label: string; successSignals: string[] }>;
  };
  expected: { interaction: string; state: string; eventName?: string; canConfirm: boolean };
}

function signal(id: string) {
  const thankYou = id === "thank-you-url";
  return {
    id,
    label: thankYou ? "Thank-you URL" : "Success message",
    type: thankYou ? "thank_you_url" as const : "visible_element" as const,
    value: thankYou ? "/thank-you" : "[data-form-success]",
  };
}

function form(item: FixtureCase["page"]["forms"][number]): FormCandidate {
  return {
    id: item.id,
    label: item.label,
    selector: `form#${item.id}`,
    pageUrl: "https://example.test/",
    successSignals: item.successSignals.map(signal),
  };
}

function fixture(): FixtureCase[] {
  const value = JSON.parse(readFileSync(resolve(process.cwd(), "tests/acceptance/conversation-intake.json"), "utf8")) as { cases: FixtureCase[] };
  return value.cases;
}

describe("deterministic conversation intake", () => {
  for (const item of fixture()) {
    it(item.id, () => {
      const page: ConversationPageContext = {
        navigationCount: item.page.navigationCount,
        forms: item.page.forms.map(form),
      };
      const result = interpretConversationIntent(item.message, page);
      expect(result).toMatchObject(item.expected);
    });
  }

  it("applies target and success corrections to structured state", () => {
    const contact = form({ id: "contact", label: "Contact sales", successSignals: ["success-message", "thank-you-url"] });
    const newsletter = form({ id: "newsletter", label: "Newsletter signup", successSignals: ["success-message"] });
    const initial = interpretConversationIntent("Track a form", { navigationCount: 0, forms: [contact, newsletter] });
    const targetSelected = selectConversationTarget(initial, contact);
    expect(targetSelected).toMatchObject({ state: "awaiting_success_evidence", target: { id: "contact" }, canConfirm: false });
    const successSelected = selectConversationSuccess(targetSelected, contact, contact.successSignals[1]!);
    expect(successSelected).toMatchObject({
      state: "draft_ready",
      eventName: "generate_lead",
      target: { id: "contact" },
      successSignal: { id: "thank-you-url" },
      canConfirm: true,
    });
  });

  it("rejects success evidence from a different target", () => {
    const contact = form({ id: "contact", label: "Contact sales", successSignals: ["success-message"] });
    const newsletter = form({ id: "newsletter", label: "Newsletter signup", successSignals: ["thank-you-url"] });
    const current = interpretConversationIntent("Track Contact sales", { navigationCount: 0, forms: [contact, newsletter] });
    expect(() => selectConversationSuccess(current, contact, newsletter.successSignals[0]!)).toThrow(/must belong/);
  });
});
