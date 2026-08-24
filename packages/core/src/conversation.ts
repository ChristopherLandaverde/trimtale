export type ConversationInteraction =
  | "navigation_click"
  | "form_submission"
  | "file_download"
  | "cta_click"
  | "phone_click"
  | "email_click"
  | "unknown";

export type ConversationState =
  | "awaiting_interaction"
  | "awaiting_scope"
  | "awaiting_target"
  | "awaiting_success_evidence"
  | "draft_ready"
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
}

export interface ConversationIntakeResult {
  interaction: ConversationInteraction;
  state: ConversationState;
  canConfirm: boolean;
  eventName?: "navigation_click" | "generate_lead";
  target?: FormCandidate | undefined;
  successSignal?: FormSuccessSignal | undefined;
  options: Array<{ id: string; label: string }>;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function classifyConversationInteraction(message: string): ConversationInteraction {
  const value = normalized(message);
  if (/\b(form|forms|submit|submission|lead|leads|inquiry|inquiries)\b/.test(value)) return "form_submission";
  if (/\b(download|downloads)\b/.test(value)) return "file_download";
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
    options: [{ id: "confirm-specification", label: "Review setup" }],
  };
}

export function interpretConversationIntent(
  message: string,
  page: ConversationPageContext,
): ConversationIntakeResult {
  const interaction = classifyConversationInteraction(message);
  if (interaction === "form_submission") return formResult(message, page);
  if (interaction === "file_download") {
    return {
      interaction,
      state: "awaiting_scope",
      canConfirm: false,
      options: [],
    };
  }
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
      { id: "prompt:email", label: "Email" },
    ],
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
    options: [{ id: "confirm-specification", label: "Review setup" }],
  };
}
