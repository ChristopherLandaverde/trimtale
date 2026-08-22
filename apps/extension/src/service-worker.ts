import {
  interpretConversationIntent,
  type BrowserEvidence,
  type FormCandidate,
  type NavigationElement,
} from "@gtm-observability/core";

async function toggleAssistant(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url?.startsWith("http")) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content-script.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
  }
}

chrome.action.onClicked.addListener(toggleAssistant);

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-assistant") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) await toggleAssistant(tab);
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "assistant") return;
  port.onMessage.addListener((message: {
    type?: string;
    requestId?: string;
    prompt?: string;
    page?: {
      title: string;
      url: string;
      navigation: NavigationElement[];
      forms: FormCandidate[];
    };
  }) => {
    if (message.type !== "ASSISTANT_REQUEST" || !message.requestId || !message.prompt || !message.page) return;
    const page = message.page;
    const intake = interpretConversationIntent(message.prompt, {
      navigationCount: page.navigation.length,
      forms: page.forms ?? [],
    });
    let response: string;
    let actions = intake.options;

    if (intake.interaction === "navigation_click") {
      response = `I found ${page.navigation.length} navigation links. Do you want to track all of them?`;
    } else if (intake.state === "awaiting_target") {
      response = `I found ${intake.options.length} forms. Which one represents the outcome you want to measure?`;
    } else if (intake.state === "awaiting_success_evidence") {
      response = `What proves ${intake.target?.label ?? "the form"} succeeded?`;
    } else if (intake.state === "draft_ready") {
      response = `I'll treat a successful ${intake.target?.label ?? "form"} submission as generate_lead. A submit attempt or validation error will not count.`;
    } else if (intake.state === "insufficient_evidence") {
      response = "I found the form, but I cannot safely observe what proves it succeeded. This needs a diagnostic handoff.";
    } else if (intake.state === "unsupported") {
      response = `I understand that as ${intake.interaction.replaceAll("_", " ")} tracking. That tracking type is not implemented in this build yet.`;
    } else {
      response = "What kind of interaction should I track? Try navigation, form, phone, or email.";
    }
    const chunks = response.match(/.{1,18}(?:\s|$)/g) ?? [response];
    chunks.forEach((delta, index) => {
      setTimeout(() => {
        if (!port.sender) return;
        port.postMessage({ type: "ASSISTANT_DELTA", requestId: message.requestId, delta });
        if (index === chunks.length - 1) {
          port.postMessage({
            type: "ASSISTANT_DONE",
            requestId: message.requestId,
            actions,
            navigation: page.navigation,
            forms: page.forms,
            intake,
          });
        }
      }, index * 24);
    });
  });
});

type GtmContainerOperation = "inspect" | "prepare";

chrome.runtime.onMessage.addListener(
  (
    message: { type?: string; operation?: GtmContainerOperation; publicId?: string },
    _sender,
    sendResponse,
  ) => {
    if (
      message.type !== "GTM_CONTAINER_REQUEST"
      || (message.operation !== "inspect" && message.operation !== "prepare")
      || typeof message.publicId !== "string"
    ) return undefined;

    const operation = message.operation;
    const request = operation === "inspect"
      ? fetch(`http://127.0.0.1:8787/api/google/containers/recognize?publicId=${encodeURIComponent(message.publicId)}`)
      : fetch("http://127.0.0.1:8787/api/google/containers/prepare-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: message.publicId }),
      });

    void request.then(async (response) => {
      const body = await response.json() as Record<string, unknown>;
      sendResponse(response.ok
        ? { ok: true, ...body }
        : { ok: false, error: typeof body.error === "string" ? body.error : `GTM request failed with HTTP ${response.status}.` });
    }).catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error
          ? error.message
          : "The local GTM integration could not be reached.",
      });
    });
    return true;
  },
);

interface PendingEvidence {
  tabId: number;
  evidence: BrowserEvidence;
  startedAt: number;
}

let pending: PendingEvidence | undefined;
const recentRequests = new Map<number, BrowserEvidence["requests"]>();
const requestLifetimeMs = 5_000;

function requestsSince(tabId: number, clickedAt: string): BrowserEvidence["requests"] {
  const clickedAtMs = Date.parse(clickedAt);
  return (recentRequests.get(tabId) ?? []).filter(
    (request) => Date.parse(request.observedAt) >= clickedAtMs,
  );
}

function mergeRequests(
  first: BrowserEvidence["requests"],
  second: BrowserEvidence["requests"],
): BrowserEvidence["requests"] {
  const seen = new Set<string>();
  return [...first, ...second].filter((request) => {
    const key = `${request.observedAt}\u0000${request.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

chrome.runtime.onMessage.addListener(
  (message: { type?: string; evidence?: BrowserEvidence }, sender) => {
    if (message.type !== "VERIFICATION_EVIDENCE" || !message.evidence || sender.tab?.id === undefined) return;
    const evidence = {
      ...message.evidence,
      requests: mergeRequests(
        message.evidence.requests,
        requestsSince(sender.tab.id, message.evidence.clickedAt),
      ),
    };
    pending = { tabId: sender.tab.id, evidence, startedAt: Date.now() };
    if (evidence.requests.length > message.evidence.requests.length) {
      void chrome.runtime.sendMessage({ type: "VERIFICATION_EVIDENCE", evidence });
    }
  },
);

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const request = { url: details.url, observedAt: new Date().toISOString() };
    const cutoff = Date.now() - requestLifetimeMs;
    const observed = (recentRequests.get(details.tabId) ?? [])
      .filter((item) => Date.parse(item.observedAt) >= cutoff);
    observed.push(request);
    recentRequests.set(details.tabId, observed);
    if (details.tabId >= 0) {
      void chrome.tabs.sendMessage(details.tabId, { type: "FORM_ANALYTICS_REQUEST", request }).catch(() => undefined);
    }

    if (!pending || details.tabId !== pending.tabId || Date.now() - pending.startedAt > requestLifetimeMs) return undefined;
    const updated: BrowserEvidence = {
      ...pending.evidence,
      requests: mergeRequests(pending.evidence.requests, [request]),
    };
    pending = { ...pending, evidence: updated };
    void chrome.runtime.sendMessage({ type: "VERIFICATION_EVIDENCE", evidence: updated });
    return undefined;
  },
  {
    urls: [
      "*://*.google-analytics.com/g/collect*",
      "*://analytics.google.com/g/collect*",
      "http://127.0.0.1:4173/g/collect*",
    ],
  },
);
