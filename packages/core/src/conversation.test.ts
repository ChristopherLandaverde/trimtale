import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyConversationInteraction,
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
    interactionCounts?: {
      phone_click?: number;
      email_click?: number;
      outbound_click?: number;
      file_download?: number;
    };
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
  it("classifies automatic-coverage requests precisely", () => {
    expect(classifyConversationInteraction("Track page views")).toBe("page_view");
    expect(classifyConversationInteraction("Measure scroll depth")).toBe("scroll");
    expect(classifyConversationInteraction("Track internal site search")).toBe("site_search");
    expect(classifyConversationInteraction("Track video engagement")).toBe("video_engagement");
    expect(classifyConversationInteraction("Track document views")).toBe("unknown");
    expect(classifyConversationInteraction("Search the contact forms")).toBe("form_submission");
  });

  for (const item of fixture()) {
    it(item.id, () => {
      const page: ConversationPageContext = {
        navigationCount: item.page.navigationCount,
        forms: item.page.forms.map(form),
        ...(item.page.interactionCounts ? { interactionCounts: item.page.interactionCounts } : {}),
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

  it("recognizes a file-download tracking request", () => {
    const result = interpretConversationIntent("Track downloads", {
      navigationCount: 0,
      forms: [],
      interactionCounts: { file_download: 2 },
    });

    expect(result).toMatchObject({
      interaction: "file_download",
      state: "awaiting_scope",
      eventName: "file_download",
      canConfirm: false,
    });
  });

  it("recognizes external-link tracking and requires observed evidence", () => {
    const observed = interpretConversationIntent("Track outbound links", {
      navigationCount: 0,
      forms: [],
      interactionCounts: { outbound_click: 3 },
    });
    const missing = interpretConversationIntent("Track external links", {
      navigationCount: 0,
      forms: [],
    });

    expect(observed).toMatchObject({
      interaction: "outbound_click",
      state: "awaiting_scope",
      eventName: "outbound_click",
      canConfirm: false,
    });
    expect(missing).toMatchObject({
      interaction: "outbound_click",
      state: "insufficient_evidence",
      eventName: "outbound_click",
      canConfirm: false,
    });
  });

  it("does not infer downloads from unrelated document language", () => {
    const result = interpretConversationIntent("Track document views", {
      navigationCount: 0,
      forms: [],
    });

    expect(result.interaction).toBe("unknown");
  });

  it("grounds a known interaction in a safe count and requires scope", () => {
    const result = interpretConversationIntent("Track phone calls", {
      navigationCount: 0,
      forms: [],
      interactionCounts: { phone_click: 2 },
    });

    expect(result).toMatchObject({
      interaction: "phone_click",
      state: "awaiting_scope",
      eventName: "phone_click",
      canConfirm: false,
    });
    expect(result.options.map(({ id }) => id)).toEqual([
      "scope:sitewide",
      "scope:current_page",
      "cancel",
    ]);
  });

  it("requires observable email-link evidence before scope", () => {
    const observed = interpretConversationIntent("Track email links", {
      navigationCount: 0,
      forms: [],
      interactionCounts: { email_click: 2 },
    });
    const missing = interpretConversationIntent("Track email links", {
      navigationCount: 0,
      forms: [],
    });

    expect(observed).toMatchObject({
      interaction: "email_click",
      state: "awaiting_scope",
      eventName: "email_click",
      canConfirm: false,
    });
    expect(missing).toMatchObject({
      interaction: "email_click",
      state: "insufficient_evidence",
      eventName: "email_click",
      canConfirm: false,
    });
  });

  it("grounds one supported Calendly inline embed on the current page", () => {
    const observed = interpretConversationIntent("Track completed Calendly bookings", {
      navigationCount: 0,
      forms: [],
      calendlyEmbedCount: 1,
    });
    const missing = interpretConversationIntent("Track Calendly appointments", {
      navigationCount: 0,
      forms: [],
      calendlyEmbedCount: 0,
    });
    const ambiguous = interpretConversationIntent("Track Calendly meetings", {
      navigationCount: 0,
      forms: [],
      calendlyEmbedCount: 2,
    });

    expect(observed).toMatchObject({
      interaction: "calendly_booking",
      state: "draft_ready",
      eventName: "calendly_booking_complete",
      scope: "current_page",
      canConfirm: true,
      options: [{ id: "confirm-calendly-specification", label: "Review setup" }],
    });
    expect(missing).toMatchObject({
      interaction: "calendly_booking",
      state: "insufficient_evidence",
      canConfirm: false,
    });
    expect(ambiguous).toMatchObject({
      interaction: "calendly_booking",
      state: "insufficient_evidence",
      canConfirm: false,
    });
  });
});
