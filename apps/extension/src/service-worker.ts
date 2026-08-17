import type { BrowserEvidence } from "@gtm-observability/core";

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "GET_EVIDENCE" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content-script.js"] });
  }
}

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id || !tab.url?.startsWith("http")) return;
  void (async () => {
    await ensureContentScript(tab.id!);
    await chrome.tabs.sendMessage(tab.id!, { type: "TOGGLE_WORKBENCH", tabId: tab.id });
  })();
});

interface PendingEvidence {
  tabId: number;
  evidence: BrowserEvidence;
  startedAt: number;
}

interface DownloadJsonRequest {
  type: "DOWNLOAD_JSON";
  filename: string;
  content: string;
}

interface GetTabEvidenceRequest {
  type: "GET_TAB_EVIDENCE";
  tabId: number;
}

let pending: PendingEvidence | undefined;
const tabEvidence = new Map<number, Map<string, BrowserEvidence>>();

function isDownloadJsonRequest(message: { type?: string }): message is DownloadJsonRequest {
  return (
    message.type === "DOWNLOAD_JSON" &&
    typeof (message as Partial<DownloadJsonRequest>).filename === "string" &&
    typeof (message as Partial<DownloadJsonRequest>).content === "string"
  );
}

function isGetTabEvidenceRequest(message: { type?: string }): message is GetTabEvidenceRequest {
  return message.type === "GET_TAB_EVIDENCE" && typeof (message as Partial<GetTabEvidenceRequest>).tabId === "number";
}

function storeEvidence(tabId: number, evidence: BrowserEvidence): void {
  const existing = tabEvidence.get(tabId) ?? new Map<string, BrowserEvidence>();
  existing.set(evidence.navigationId, evidence);
  tabEvidence.set(tabId, existing);
}

chrome.runtime.onMessage.addListener(
  (message: { type?: string; evidence?: BrowserEvidence }, sender, sendResponse) => {
    if (isDownloadJsonRequest(message)) {
      const url = `data:application/json;charset=utf-8,${encodeURIComponent(message.content)}`;
      void chrome.downloads
        .download({ url, filename: message.filename, saveAs: false })
        .then((downloadId) => sendResponse({ downloadId }))
        .catch((error: unknown) => {
          sendResponse({ error: error instanceof Error ? error.message : "Download failed." });
        });
      return true;
    }

    if (isGetTabEvidenceRequest(message)) {
      sendResponse({ evidence: [...(tabEvidence.get(message.tabId)?.values() ?? [])] });
      return false;
    }

    if (message.type !== "VERIFICATION_EVIDENCE" || !message.evidence || sender.tab?.id === undefined) return false;
    pending = { tabId: sender.tab.id, evidence: message.evidence, startedAt: Date.now() };
    storeEvidence(sender.tab.id, message.evidence);
    return false;
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
    storeEvidence(details.tabId, updated);
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
