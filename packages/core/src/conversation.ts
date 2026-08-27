import {
  knownInteractionDefinition,
  type InteractionScopeV1,
  type KnownInteractionTypeV1,
} from "./interaction-authoring.js";

export type ConversationInteraction =
  | "navigation_click"
  | "form_submission"
  | AutomaticCoverageInteraction
  | "file_download"
  | "outbound_click"
  | "cta_click"
  | "phone_click"
  | "email_click"
  | "calendly_booking"
  | "unknown";

export type AutomaticCoverageInteraction =
  | "page_view"
  | "scroll"
  | "site_search"
  | "video_engagement";

export type ConversationState =
  | "awaiting_interaction"
  | "awaiting_scope"
  | "awaiting_target"
  | "awaiting_success_evidence"
  | "draft_ready"
  | "coverage_check"
  | "unsupported"
  | "insufficient_evidence";

export interface FormSuccessSignal {
  id: string;
  label: string;
  type: "visible_element" | "thank_you_url" | "data_layer_event" | "same_page_success";
  value: string;
}

export interface FormCandidate {
  id: string;
  label: string;
  selector: string;
  pageUrl: string;
  successSignals: FormSuccessSignal[];
}

export interface ConversationPageContext {
  navigationCount: number;
  forms: FormCandidate[];
  interactionCounts?: Partial<Record<KnownInteractionTypeV1, number>>;
  calendlyEmbedCount?: number;
}

export interface ConversationIntakeResult {
  interaction: ConversationInteraction;
  state: ConversationState;
  canConfirm: boolean;
  eventName?: "navigation_click" | "generate_lead" | KnownInteractionTypeV1 | "calendly_booking_complete";
  scope?: InteractionScopeV1;
  target?: FormCandidate | undefined;
  successSignal?: FormSuccessSignal | undefined;
  options: Array<{ id: string; label: string }>;
}

function boundedInteractionCount(page: ConversationPageContext, interaction: KnownInteractionTypeV1): number {
  const value = page.interactionCounts?.[interaction] ?? 0;
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 999) : 0;
}

function knownInteractionResult(
  interaction: ConversationInteraction,
  page: ConversationPageContext,
): ConversationIntakeResult | undefined {
  const definition = knownInteractionDefinition(interaction);
  if (!definition) return undefined;
  const count = boundedInteractionCount(page, definition.interaction);
  if (count === 0) {
    return {
      interaction,
      state: "insufficient_evidence",
      eventName: definition.eventName,
      canConfirm: false,
      options: [],
    };
  }
  return {
    interaction,
    state: "awaiting_scope",
    eventName: definition.eventName,
    canConfirm: false,
    options: [
      { id: "scope:sitewide", label: `All ${definition.plural} sitewide` },
      { id: "scope:current_page", label: "Only on this page" },
      { id: "cancel", label: "Cancel" },
    ],
  };
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function classifyConversationInteraction(message: string): ConversationInteraction {
  const value = normalized(message);
  if (/\bcalendly\b/.test(value)) return "calendly_booking";
  if (/\b(form|forms|submit|submission|lead|leads|inquiry|inquiries)\b/.test(value)) return "form_submission";
  if (/\b(page view|page views|pageview|pageviews)\b/.test(value)) return "page_view";
  if (/\b(scroll|scrolls|scrolling)\b/.test(value)) return "scroll";
  if (/\b(site search|internal search|search result|search results)\b/.test(value)) return "site_search";
  if (/\b(video|videos)\b/.test(value)) return "video_engagement";
  if (/\b(download|downloads)\b/.test(value)) return "file_download";
  if (/\b(outbound|external|offsite|off site)\b/.test(value)
    && /\b(link|links|click|clicks)\b/.test(value)) return "outbound_click";
  if (/\b(phone|call|telephone|tel)\b/.test(value)) return "phone_click";
  if (/\b(email|mailto)\b/.test(value)) return "email_click";
  if (/\b(cta|call to action|button)\b/.test(value)) return "cta_click";
  if (/\b(nav|navigation|menu|header|footer|link|links)\b/.test(value)) return "navigation_click";
  return "unknown";
}

function mentionedTarget(message: string, forms: FormCandidate[]): FormCandidate | undefined {
  const value = normalized(message);
  return forms.find((form) => {
    const label = normalized(form.label);
    return label.length > 0 && value.includes(label);
  });
}

function mentionedSignal(message: string, signals: FormSuccessSignal[]): FormSuccessSignal | undefined {
  const value = normalized(message);
  return signals.find((signal) => {
    const candidates = [normalized(signal.id), normalized(signal.label)];
    if (signal.type === "visible_element") candidates.push("success message");
    if (signal.type === "thank_you_url") candidates.push("thank you url", "thank you page");
    return candidates.some((candidate) => candidate.length > 0 && value.includes(candidate));
  });
}

function formResult(message: string, page: ConversationPageContext): ConversationIntakeResult {
  if (page.forms.length === 0) {
    return {
      interaction: "form_submission",
      state: "insufficient_evidence",
      canConfirm: false,
      options: [],
    };
  }

  const target = mentionedTarget(message, page.forms) ?? (page.forms.length === 1 ? page.forms[0] : undefined);
  if (!target) {
    return {
      interaction: "form_submission",
      state: "awaiting_target",
      canConfirm: false,
      options: page.forms.map((form) => ({ id: `target:${form.id}`, label: form.label })),
    };
  }

  if (target.successSignals.length === 0) {
    return {
      interaction: "form_submission",
      state: "insufficient_evidence",
      canConfirm: false,
      target,
      options: [],
    };
  }

  const successSignal = mentionedSignal(message, target.successSignals)
    ?? (target.successSignals.length === 1 ? target.successSignals[0] : undefined);
  if (!successSignal) {
    return {
      interaction: "form_submission",
      state: "awaiting_success_evidence",
      canConfirm: false,
      target,
      options: target.successSignals.map((signal) => ({ id: `success:${signal.id}`, label: signal.label })),
    };
  }

  return {
    interaction: "form_submission",
    state: "draft_ready",
    eventName: "generate_lead",
    canConfirm: true,
    target,
    successSignal,
    options: [{ id: "confirm-specification", label: "Review what will be tracked" }],
  };
}

export function interpretConversationIntent(
  message: string,
  page: ConversationPageContext,
): ConversationIntakeResult {
  const interaction = classifyConversationInteraction(message);
  if (interaction === "calendly_booking") {
    const count = Number.isSafeInteger(page.calendlyEmbedCount) && Number(page.calendlyEmbedCount) > 0
      ? Math.min(Number(page.calendlyEmbedCount), 999)
      : 0;
    if (count !== 1) {
      return {
        interaction,
        state: "insufficient_evidence",
        eventName: "calendly_booking_complete",
        canConfirm: false,
        options: [],
      };
    }
    return {
      interaction,
      state: "draft_ready",
      eventName: "calendly_booking_complete",
      scope: "current_page",
      canConfirm: true,
      options: [{ id: "confirm-calendly-specification", label: "Review setup" }],
    };
  }
  if (interaction === "form_submission") return formResult(message, page);
  if (interaction === "navigation_click") {
    return {
      interaction,
      state: "awaiting_scope",
      eventName: "navigation_click",
      canConfirm: false,
      options: page.navigationCount > 0
        ? [
            { id: "track-all-navigation", label: "Track all" },
            { id: "choose-navigation", label: "Choose links" },
            { id: "cancel", label: "Cancel" },
          ]
        : [],
    };
  }
  if (interaction === "page_view"
    || interaction === "scroll"
    || interaction === "site_search"
    || interaction === "video_engagement") {
    return {
      interaction,
      state: "coverage_check",
      canConfirm: false,
      options: [],
    };
  }
  const known = knownInteractionResult(interaction, page);
  if (known) return known;
  if (interaction !== "unknown") {
    return { interaction, state: "unsupported", canConfirm: false, options: [] };
  }
  return {
    interaction,
    state: "awaiting_interaction",
    canConfirm: false,
    options: [
      { id: "prompt:navigation", label: "Navigation" },
      { id: "prompt:form", label: "Form" },
      { id: "prompt:phone", label: "Phone" },
      { id: "prompt:outbound links", label: "Outbound links" },
      { id: "prompt:downloads", label: "Downloads" },
      { id: "prompt:email", label: "Email" },
    ],
  };
}

export function selectConversationScope(
  current: ConversationIntakeResult,
  scope: InteractionScopeV1,
): ConversationIntakeResult {
  const definition = knownInteractionDefinition(current.interaction);
  if (!definition) throw new Error("Scope can only resolve a supported interaction intake.");
  return {
    ...current,
    state: "draft_ready",
    eventName: definition.eventName,
    scope,
    canConfirm: true,
    options: [{ id: "confirm-interaction-specification", label: "Review setup" }],
  };
}

export function selectConversationTarget(
  current: ConversationIntakeResult,
  target: FormCandidate,
): ConversationIntakeResult {
  if (current.interaction !== "form_submission") throw new Error("A form target can only resolve form intake.");
  if (target.successSignals.length === 0) {
    return { ...current, state: "insufficient_evidence", canConfirm: false, target, successSignal: undefined, options: [] };
  }
  if (target.successSignals.length === 1) {
    return selectConversationSuccess(current, target, target.successSignals[0]!);
  }
  return {
    ...current,
    state: "awaiting_success_evidence",
    canConfirm: false,
    target,
    successSignal: undefined,
    options: target.successSignals.map((signal) => ({ id: `success:${signal.id}`, label: signal.label })),
  };
}

export function selectConversationSuccess(
  current: ConversationIntakeResult,
  target: FormCandidate,
  successSignal: FormSuccessSignal,
): ConversationIntakeResult {
  if (!target.successSignals.some((signal) => signal.id === successSignal.id)) {
    throw new Error("Success evidence must belong to the selected form target.");
  }
  return {
    interaction: "form_submission",
    state: "draft_ready",
    eventName: "generate_lead",
    canConfirm: true,
    target,
    successSignal,
    options: [{ id: "confirm-specification", label: "Review what will be tracked" }],
  };
}
