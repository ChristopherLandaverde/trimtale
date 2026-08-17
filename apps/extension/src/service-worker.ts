import type { BrowserEvidence } from "@gtm-observability/core";

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
      navigation: Array<{ id: string; text: string; area: string }>;
    };
  }) => {
    if (message.type !== "ASSISTANT_REQUEST" || !message.requestId || !message.prompt || !message.page) return;
    const page = message.page;
    const normalized = message.prompt.toLowerCase().trim();
    const navigationIntent = /\b(nav|navigation|menu|header|footer|link|links)\b/.test(normalized);
    const formIntent = /\b(form|forms|submit|submission|lead)\b/.test(normalized);
    const phoneIntent = /\b(phone|call|telephone|tel)\b/.test(normalized);
    const emailIntent = /\b(email|mailto)\b/.test(normalized);
    let response: string;
    let actions: Array<{ id: string; label: string }> = [];

    if (navigationIntent) {
      response = `I found ${page.navigation.length} navigation links. Do you want to track all of them?`;
      actions = [
        { id: "track-all-navigation", label: "Track all" },
        { id: "choose-navigation", label: "Choose links" },
        { id: "cancel", label: "Cancel" },
      ];
    } else if (formIntent) {
      response = "I understand that as form-submission tracking. That tracking type is not implemented in this build yet.";
    } else if (phoneIntent) {
      response = "I understand that as phone-click tracking. That tracking type is not implemented in this build yet.";
    } else if (emailIntent) {
      response = "I understand that as email-link tracking. That tracking type is not implemented in this build yet.";
    } else {
      response = "What kind of interaction should I track? Try navigation, form, phone, or email.";
      actions = [
        { id: "prompt:navigation", label: "Navigation" },
        { id: "prompt:form", label: "Form" },
        { id: "prompt:phone", label: "Phone" },
        { id: "prompt:email", label: "Email" },
      ];
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
          });
        }
      }, index * 24);
    });
  });
});

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
