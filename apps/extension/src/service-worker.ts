import type { BrowserEvidence } from "@gtm-observability/core";

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("workbench.html") });
});

interface PendingEvidence {
  tabId: number;
  evidence: BrowserEvidence;
  startedAt: number;
}

let pending: PendingEvidence | undefined;

chrome.runtime.onMessage.addListener(
  (message: { type?: string; evidence?: BrowserEvidence }, sender) => {
    if (message.type !== "VERIFICATION_EVIDENCE" || !message.evidence || sender.tab?.id === undefined) return;
    pending = { tabId: sender.tab.id, evidence: message.evidence, startedAt: Date.now() };
  },
);

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!pending || details.tabId !== pending.tabId || Date.now() - pending.startedAt > 5_000) return undefined;
    const updated: BrowserEvidence = {
      ...pending.evidence,
      requests: [
        ...pending.evidence.requests,
        { url: details.url, observedAt: new Date().toISOString() },
      ],
    };
    pending = { ...pending, evidence: updated };
    void chrome.runtime.sendMessage({ type: "VERIFICATION_EVIDENCE", evidence: updated });
    return undefined;
  },
  {
    urls: [
      "*://*.google-analytics.com/g/collect*",
      "*://analytics.google.com/g/collect*",
      "http://127.0.0.1:14173/g/collect*",
    ],
  },
);
