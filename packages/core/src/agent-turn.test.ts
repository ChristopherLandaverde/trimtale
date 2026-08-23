import { describe, expect, it } from "vitest";
import {
  agentTurnForIntake,
  agentTurnForNavigationScope,
  discoverNavigationTargetGroups,
  interpretNavigationScopeDeterministically,
  isAgentTurnV1,
  type FormCandidate,
} from "./index.js";
import { interpretConversationIntent, selectConversationTarget } from "./conversation.js";

function form(id: string, label: string): FormCandidate {
  return {
    id,
    label,
    selector: `form#${id}`,
    pageUrl: "https://example.test/",
    successSignals: [{
      id: `${id}-success`,
      label: "Success message",
      type: "visible_element",
      value: `#${id}-success`,
    }],
  };
}

describe("provider-neutral agent turns", () => {
  it("turns one navigation match into a reversible keyboard-ready preview", () => {
    const navigation = [
      { id: "header", text: "Pricing", href: "https://example.test/pricing", area: "header" as const, selector: "header a", groupId: "primary", groupLabel: "Primary navigation" },
      { id: "footer", text: "Pricing", href: "https://example.test/pricing", area: "footer" as const, selector: "footer a", groupId: "footer", groupLabel: "Footer navigation" },
    ];
    const groups = discoverNavigationTargetGroups(navigation);
    const intake = interpretConversationIntent("Track header navigation", { navigationCount: 2, forms: [] });
    const interpretation = interpretNavigationScopeDeterministically(["Track header navigation"], groups);
    const turn = agentTurnForNavigationScope(
      intake,
      { formCount: 0, navigationCount: 2 },
      groups,
      interpretation,
      "local_model",
      "qwen3:30b",
    );
    expect(turn.task.summary).toContain("Primary navigation");
    expect(turn.actions).toEqual([
      { id: "confirm-navigation-preview", label: "Confirm selection · Enter" },
      { id: "remove-navigation-preview", label: "Remove · Esc" },
      { id: "choose-navigation-groups", label: "Change selection" },
    ]);
    expect(turn.receipts.at(-1)).toMatchObject({
      id: "scope-interpreted",
      detail: "Local model qwen3:30b; reversible page preview",
    });
    expect(turn.question).toBe("Press Enter to confirm, Esc to remove, or change the selection.");
    expect(isAgentTurnV1(turn)).toBe(true);
  });

  it("turns ambiguous intake into one grounded task, plan, question, and receipt", () => {
    const forms = [form("contact", "Contact sales"), form("newsletter", "Newsletter signup")];
    const intake = interpretConversationIntent("Track leads", { navigationCount: 5, forms });
    const turn = agentTurnForIntake(intake, {
      formCount: 2,
      navigationCount: 5,
      connection: { publicId: "GTM-TEST123", measurementId: "G-TEST123456" },
    });

    expect(turn).toMatchObject({
      schemaVersion: 1,
      task: {
        goal: "Set up lead-form tracking",
        status: "needs_input",
        summary: "I found two forms and need you to choose which one represents a qualified inquiry.",
      },
      question: "Which form should count as a lead?",
      plan: [
        { id: "understand", status: "completed" },
        { id: "inspect", status: "completed" },
        { id: "target", status: "active" },
        { id: "review", status: "pending" },
        { id: "verify", status: "pending" },
      ],
      receipts: [
        { id: "page-inspected", status: "completed", detail: "2 forms · 5 navigation links" },
        { id: "gtm-connected", status: "completed", detail: "GTM-TEST123 · G-TEST123456" },
      ],
    });
    expect(turn.actions.map((action) => action.id)).toEqual(["target:contact", "target:newsletter"]);
    expect(isAgentTurnV1(turn)).toBe(true);
  });

  it("advances the same task to an approval checkpoint without leaking page internals", () => {
    const privateSentinel = "private-form-value@example.test";
    const contact = form("contact", "Contact <img src=x onerror=attackerSentinel>");
    const initial = interpretConversationIntent(`Track leads ${privateSentinel}`, {
      navigationCount: 0,
      forms: [contact, form("newsletter", "Newsletter")],
    });
    const selected = selectConversationTarget(initial, contact);
    const turn = agentTurnForIntake(selected, { formCount: 2, navigationCount: 0 });
    const serialized = JSON.stringify(turn);

    expect(turn).toMatchObject({
      task: { status: "ready_for_review" },
      plan: [
        { id: "understand", status: "completed" },
        { id: "inspect", status: "completed" },
        { id: "target", status: "completed" },
        { id: "review", status: "active", kind: "approval" },
        { id: "verify", status: "pending" },
      ],
      actions: [{ id: "confirm-specification", label: "Review setup" }],
    });
    expect(serialized).not.toContain(privateSentinel);
    expect(serialized).not.toContain("form#contact");
    expect(serialized).not.toContain("#contact-success");
    expect(isAgentTurnV1(turn)).toBe(true);
  });

  it("represents unsupported and insufficient work as honest blockers", () => {
    const unsupported = agentTurnForIntake(
      interpretConversationIntent("Track phone calls", { navigationCount: 0, forms: [] }),
      { formCount: 0, navigationCount: 0 },
    );
    const insufficient = agentTurnForIntake(
      interpretConversationIntent("Track this form", { navigationCount: 0, forms: [] }),
      { formCount: 0, navigationCount: 0 },
    );

    expect(unsupported.task.status).toBe("unsupported");
    expect(unsupported.plan.some((stage) => stage.status === "blocked")).toBe(true);
    expect(insufficient.task.status).toBe("blocked");
    expect(insufficient.task.summary).toMatch(/could not find an observable form/i);
    expect(isAgentTurnV1({ ...unsupported, schemaVersion: 2 })).toBe(false);
    expect(isAgentTurnV1({ ...unsupported, task: { ...unsupported.task, status: "completed" } })).toBe(true);
  });
});
