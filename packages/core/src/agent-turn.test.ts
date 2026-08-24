import { describe, expect, it } from "vitest";
import {
  agentTurnForIntake,
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

  it("puts automatic GA4 coverage in the task decision", () => {
    const coverage = {
      enabled: true,
      outboundClicks: true,
      fileDownloads: true,
      formInteractions: true,
    };
    const navigation = agentTurnForIntake(
      interpretConversationIntent("Track navigation clicks", { navigationCount: 5, forms: [] }),
      { formCount: 0, navigationCount: 5, automaticCoverage: coverage },
    );
    const lead = agentTurnForIntake(
      interpretConversationIntent("Track leads", {
        navigationCount: 0,
        forms: [form("contact", "Contact sales"), form("newsletter", "Newsletter")],
      }),
      { formCount: 2, navigationCount: 0, automaticCoverage: coverage },
    );
    const disabled = agentTurnForIntake(
      interpretConversationIntent("Track navigation clicks", { navigationCount: 5, forms: [] }),
      {
        formCount: 0,
        navigationCount: 5,
        automaticCoverage: { ...coverage, enabled: false },
      },
    );

    expect(navigation.task).toEqual({
      goal: "Partially covered · Navigation tracking",
      status: "needs_input",
      summary: "GA4 already measures outbound clicks. I found 5 navigation links; choose whether any still need a custom navigation_click event.",
    });
    expect(navigation.question).toBe("Which links still need a custom event?");
    expect(navigation.actions.map(({ id }) => id)).toEqual(["choose-navigation", "cancel"]);
    expect(lead.task).toEqual({
      goal: "Needs custom setup · Confirmed lead tracking",
      status: "needs_input",
      summary: "GA4 measures form starts and submits, not confirmed leads. I found two forms and need you to choose which one represents a qualified inquiry.",
    });
    expect(disabled.task).toEqual({
      goal: "Needs setup · Navigation tracking",
      status: "needs_input",
      summary: "GA4 automatic measurement is off. I found 5 navigation links; choose all of them or narrow the scope.",
    });
  });

  it("decides automatic file-download coverage without generating GTM", () => {
    const intake = interpretConversationIntent("Track downloads", {
      navigationCount: 0,
      forms: [],
    });
    const connection = {
      publicId: "GTM-TEST123",
      measurementId: "G-TEST123456",
    };
    const covered = agentTurnForIntake(intake, {
      formCount: 0,
      navigationCount: 0,
      connection,
      automaticCoverage: {
        enabled: true,
        outboundClicks: true,
        fileDownloads: true,
        formInteractions: true,
      },
    });
    const masterOff = agentTurnForIntake(intake, {
      formCount: 0,
      navigationCount: 0,
      connection,
      automaticCoverage: {
        enabled: false,
        outboundClicks: true,
        fileDownloads: true,
        formInteractions: true,
      },
    });
    const downloadsOff = agentTurnForIntake(intake, {
      formCount: 0,
      navigationCount: 0,
      connection,
      automaticCoverage: {
        enabled: true,
        outboundClicks: true,
        fileDownloads: false,
        formInteractions: true,
      },
    });
    const missingStream = agentTurnForIntake(intake, {
      formCount: 0,
      navigationCount: 0,
      connection: { publicId: "GTM-TEST123" },
      automaticCoverage: {
        enabled: true,
        outboundClicks: true,
        fileDownloads: true,
        formInteractions: true,
      },
    });

    expect(covered.task).toEqual({
      goal: "Already covered · File downloads",
      status: "completed",
      summary: "GA4 G-TEST123456 automatically measures supported file links. No GTM setup is needed. Next: verify a real file link in the browser.",
    });
    expect(covered.actions).toEqual([]);
    expect(masterOff.task).toEqual({
      goal: "Coverage gap · File downloads",
      status: "blocked",
      summary: "GA4 automatic measurement is off for G-TEST123456. File downloads are not automatically covered. No GTM setup was generated.",
    });
    expect(downloadsOff.task).toEqual({
      goal: "Coverage gap · File downloads",
      status: "blocked",
      summary: "GA4 automatic file downloads are off for G-TEST123456. No GTM setup was generated.",
    });
    expect(missingStream.task).toEqual({
      goal: "Coverage unknown · File downloads",
      status: "blocked",
      summary: "Connect one exact GA4 stream before deciding download coverage. No GTM setup was generated.",
    });
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
