import { describe, expect, it } from "vitest";
import {
  agentTurnForIntake,
  isAgentTurnV1,
  type FormCandidate,
} from "./index.js";
import { interpretConversationIntent, selectConversationScope, selectConversationTarget } from "./conversation.js";

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

  it("reports automatic-only interactions without offering setup", () => {
    const automaticCoverage = {
      enabled: true,
      pageViews: true,
      scrolls: true,
      outboundClicks: true,
      siteSearch: true,
      videoEngagement: true,
      fileDownloads: true,
      formInteractions: true,
    };
    const cases = [
      ["Track page views", "Already covered · Page views", "automatically measures page views"],
      ["Track scroll depth", "Already covered · Scrolls", "automatically measures scrolls"],
      ["Track internal site search", "Already covered · Site search", "automatically measures site search"],
      ["Track video engagement", "Already covered · Video engagement", "automatically measures video engagement"],
    ] as const;

    for (const [message, goal, summary] of cases) {
      const turn = agentTurnForIntake(
        interpretConversationIntent(message, { navigationCount: 0, forms: [] }),
        {
          formCount: 0,
          navigationCount: 0,
          connection: { publicId: "GTM-TEST123", measurementId: "G-TEST123456" },
          automaticCoverage,
        },
      );

      expect(turn.task).toMatchObject({ goal, status: "completed", summary: expect.stringContaining(summary) });
      expect(turn.actions).toEqual([]);
      expect(turn.plan.map(({ label }) => label)).toEqual([
        "Understand the outcome",
        "Inspect this page",
        "Check automatic coverage",
        "Avoid duplicate setup",
        "Verify measurement",
      ]);
      expect(turn.plan.find(({ id }) => id === "verify")?.status).toBe("pending");
      expect(isAgentTurnV1(turn)).toBe(true);
    }
  });

  it("names automatic-coverage gaps without creating fallback setup", () => {
    const automaticCoverage = {
      enabled: true,
      pageViews: true,
      scrolls: false,
      outboundClicks: true,
      siteSearch: true,
      videoEngagement: true,
      fileDownloads: true,
      formInteractions: true,
    };
    const intake = interpretConversationIntent("Track scroll depth", {
      navigationCount: 0,
      forms: [],
    });
    const gap = agentTurnForIntake(intake, {
      formCount: 0,
      navigationCount: 0,
      connection: { publicId: "GTM-TEST123", measurementId: "G-TEST123456" },
      automaticCoverage,
    });
    const masterOff = agentTurnForIntake(intake, {
      formCount: 0,
      navigationCount: 0,
      connection: { publicId: "GTM-TEST123", measurementId: "G-TEST123456" },
      automaticCoverage: { ...automaticCoverage, enabled: false, scrolls: true },
    });
    const unavailable = agentTurnForIntake(intake, {
      formCount: 0,
      navigationCount: 0,
      connection: { publicId: "GTM-TEST123" },
    });

    expect(gap.task).toEqual({
      goal: "Coverage gap · Scrolls",
      status: "blocked",
      summary: "GA4 automatic scroll measurement is off for G-TEST123456. No GTM setup was generated.",
    });
    expect(masterOff.task).toEqual({
      goal: "Coverage gap · Scrolls",
      status: "blocked",
      summary: "GA4 automatic measurement is off for G-TEST123456. No GTM setup was generated.",
    });
    expect(unavailable.task).toEqual({
      goal: "Check automatic coverage · Scrolls",
      status: "blocked",
      summary: "I need one exact GA4 web stream and its Enhanced Measurement settings to check scroll coverage. No setup was generated.",
    });
    expect(gap.actions).toEqual([]);
    expect(masterOff.actions).toEqual([]);
    expect(unavailable.actions).toEqual([]);
  });

  it("uses automatic file-download coverage and offers setup only for a gap", () => {
    const intake = interpretConversationIntent("Track downloads", {
      navigationCount: 0,
      forms: [],
      interactionCounts: { file_download: 2 },
    });
    const connection = {
      publicId: "GTM-TEST123",
      measurementId: "G-TEST123456",
    };
    const covered = agentTurnForIntake(intake, {
      formCount: 0,
      navigationCount: 0,
      interactionCounts: { file_download: 2 },
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
      interactionCounts: { file_download: 2 },
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
      interactionCounts: { file_download: 2 },
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
      interactionCounts: { file_download: 2 },
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
      goal: "Set up file-download tracking",
      status: "needs_input",
      summary: "GA4 automatic measurement is off. I found 2 downloadable file links. The event can cover matching downloadable file links sitewide or only this page.",
    });
    expect(downloadsOff.task).toEqual({
      goal: "Set up file-download tracking",
      status: "needs_input",
      summary: "GA4 automatic file-download measurement is off. I found 2 downloadable file links. The event can cover matching downloadable file links sitewide or only this page.",
    });
    expect(masterOff.actions.map(({ id }) => id)).toEqual([
      "scope:sitewide",
      "scope:current_page",
      "cancel",
    ]);
    expect(missingStream.task.status).toBe("needs_input");
  });

  it("avoids duplicate outbound setup when exact-stream coverage is on", () => {
    const intake = interpretConversationIntent("Track external links", {
      navigationCount: 0,
      forms: [],
      interactionCounts: { outbound_click: 2 },
    });
    const context = {
      formCount: 0,
      navigationCount: 0,
      interactionCounts: { outbound_click: 2 },
      connection: { publicId: "GTM-TEST123", measurementId: "G-TEST123456" },
    };
    const covered = agentTurnForIntake(intake, {
      ...context,
      automaticCoverage: {
        enabled: true,
        outboundClicks: true,
        fileDownloads: true,
        formInteractions: true,
      },
    });
    const uncovered = agentTurnForIntake(intake, {
      ...context,
      automaticCoverage: {
        enabled: true,
        outboundClicks: false,
        fileDownloads: true,
        formInteractions: true,
      },
    });

    expect(covered.task).toEqual({
      goal: "Already covered · Outbound links",
      status: "completed",
      summary: "GA4 G-TEST123456 automatically measures outbound link clicks. No GTM setup is needed. Next: verify a real outbound link in the browser.",
    });
    expect(covered.actions).toEqual([]);
    expect(uncovered.task).toMatchObject({
      goal: "Set up outbound-link tracking",
      status: "needs_input",
      summary: expect.stringContaining("automatic outbound-click measurement is off"),
    });
  });

  it("grounds phone-click scope without exposing contact data", () => {
    const intake = interpretConversationIntent("Track phone calls", {
      navigationCount: 0,
      forms: [],
      interactionCounts: { phone_click: 1 },
    });
    const scoped = selectConversationScope(intake, "sitewide");
    const turn = agentTurnForIntake(scoped, {
      formCount: 0,
      navigationCount: 0,
      interactionCounts: { phone_click: 1 },
    });

    expect(turn).toMatchObject({
      task: {
        status: "ready_for_review",
        summary: expect.stringContaining("Phone number, tel URL, and visible link text are excluded"),
      },
      actions: [{ id: "confirm-interaction-specification", label: "Review setup" }],
    });
    expect(JSON.stringify(turn)).not.toContain("tel:+");
  });

  it("grounds email-link scope without exposing email data", () => {
    const intake = interpretConversationIntent("Track email links", {
      navigationCount: 0,
      forms: [],
      interactionCounts: { email_click: 1 },
    });
    const scoped = selectConversationScope(intake, "current_page");
    const turn = agentTurnForIntake(scoped, {
      formCount: 0,
      navigationCount: 0,
      interactionCounts: { email_click: 1 },
    });
    const missing = agentTurnForIntake(
      interpretConversationIntent("Track email links", { navigationCount: 0, forms: [] }),
      { formCount: 0, navigationCount: 0 },
    );

    expect(turn).toMatchObject({
      task: {
        status: "ready_for_review",
        summary: expect.stringContaining("Email address, mailto URL, subject/body values, and visible link text are excluded"),
      },
      actions: [{ id: "confirm-interaction-specification", label: "Review setup" }],
    });
    expect(missing.task).toMatchObject({
      status: "blocked",
      summary: "I could not find an observable email link on this page. No setup was generated.",
    });
    expect(JSON.stringify(turn)).not.toContain("private@example.test");
  });

  it("represents unsupported and insufficient work as honest blockers", () => {
    const unsupported = agentTurnForIntake(
      interpretConversationIntent("Track CTA buttons", { navigationCount: 0, forms: [] }),
      { formCount: 0, navigationCount: 0 },
    );
    const missingPhone = agentTurnForIntake(
      interpretConversationIntent("Track phone calls", { navigationCount: 0, forms: [] }),
      { formCount: 0, navigationCount: 0 },
    );
    const insufficient = agentTurnForIntake(
      interpretConversationIntent("Track this form", { navigationCount: 0, forms: [] }),
      { formCount: 0, navigationCount: 0 },
    );

    expect(unsupported.task.status).toBe("unsupported");
    expect(unsupported.plan.some((stage) => stage.status === "blocked")).toBe(true);
    expect(missingPhone.task.status).toBe("blocked");
    expect(insufficient.task.status).toBe("blocked");
    expect(insufficient.task.summary).toMatch(/could not find an observable form/i);
    expect(isAgentTurnV1({ ...unsupported, schemaVersion: 2 })).toBe(false);
    expect(isAgentTurnV1({ ...unsupported, task: { ...unsupported.task, status: "completed" } })).toBe(true);
  });
});
