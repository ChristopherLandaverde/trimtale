import {
  agentTurnForNavigationScope,
  agentTurnForIntake,
  createNavigationScopeInterpretationInput,
  discoverNavigationTargetGroups,
  interpretConversationIntent,
  navigationScopeInterpretationRoute,
  isNavigationScopeInterpretationV1,
  type BrowserEvidence,
  type FormCandidate,
  type NavigationElement,
  type NavigationScopeInterpretationV1,
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
    connection?: { publicId: string; measurementId?: string };
  }) => {
    if (message.type !== "ASSISTANT_REQUEST" || !message.requestId || !message.prompt || !message.page) return;
    const page = message.page;
    const intake = interpretConversationIntent(message.prompt, {
      navigationCount: page.navigation.length,
      forms: page.forms ?? [],
    });
    const context = {
      formCount: page.forms.length,
      navigationCount: page.navigation.length,
      ...(message.connection ? { connection: message.connection } : {}),
    };
    const groups = discoverNavigationTargetGroups(page.navigation);
    const send = (
      interpretation?: NavigationScopeInterpretationV1,
      source: "local_model" | "deterministic" = "deterministic",
      model?: string,
    ): void => {
      const turn = intake.interaction === "navigation_click" && interpretation
        ? agentTurnForNavigationScope(intake, context, groups, interpretation, source, model)
        : agentTurnForIntake(intake, context);
      port.postMessage({
        type: "AGENT_TURN",
        requestId: message.requestId,
        turn,
        navigation: page.navigation,
        navigationGroups: groups,
        ...(interpretation ? { navigationScopeInterpretation: interpretation } : {}),
        forms: page.forms,
        intake,
      });
    };
    if (intake.interaction !== "navigation_click" || groups.length === 0) {
      send();
      return;
    }
    const route = navigationScopeInterpretationRoute([message.prompt], groups);
    if (route.source === "deterministic") {
      send(route.fallback, "deterministic");
      return;
    }
    const input = createNavigationScopeInterpretationInput([message.prompt], groups);
    void fetch("http://127.0.0.1:8787/api/agent/navigation-scope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then(async (response) => {
      if (!response.ok) throw new Error("local_model_unavailable");
      const body: unknown = await response.json();
      if (!isRecord(body) || !isRecord(body.provider) || body.provider.id !== "ollama"
        || typeof body.provider.model !== "string"
        || !isNavigationScopeInterpretationV1(body.interpretation, groups)) {
        throw new Error("local_model_invalid");
      }
      send(body.interpretation, "local_model", body.provider.model);
    }).catch(() => send(route.fallback, "deterministic"));
  });
});

type GtmContainerOperation = "inspect" | "prepare";

const gtmPublicIdPattern = /^GTM-[A-Z0-9]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validConnectionStatus(value: unknown): value is {
  configured: boolean;
  connected: boolean;
  scope: "read-only" | "container-edit";
  containerWritesEnabled: boolean;
  publicationScopeRequested: boolean;
  publicationEnabled: boolean;
  tokenPersistenceEnabled: boolean;
  analyticsReadEnabled: boolean;
} {
  return isRecord(value)
    && typeof value.configured === "boolean"
    && typeof value.connected === "boolean"
    && (value.scope === "read-only" || value.scope === "container-edit")
    && typeof value.containerWritesEnabled === "boolean"
    && typeof value.publicationScopeRequested === "boolean"
    && typeof value.publicationEnabled === "boolean"
    && typeof value.tokenPersistenceEnabled === "boolean"
    && typeof value.analyticsReadEnabled === "boolean";
}

function validObservedContainerIds(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length <= 10
    && value.every((item) => typeof item === "string" && gtmPublicIdPattern.test(item));
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GTM_CONNECTION_CONTEXT_REQUEST") return undefined;
    if (!validObservedContainerIds(message.containerIds)) {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }
    const containerIds = [...new Set(message.containerIds)];
    void fetch("http://127.0.0.1:8787/api/google/status")
      .then(async (response) => {
        if (!response.ok) throw new Error("status_unavailable");
        const status: unknown = await response.json();
        if (!validConnectionStatus(status)) throw new Error("invalid_status");
        const safeStatus = {
          configured: status.configured,
          connected: status.connected,
          scope: status.scope,
          containerWritesEnabled: status.containerWritesEnabled,
          publicationScopeRequested: status.publicationScopeRequested,
          publicationEnabled: status.publicationEnabled,
          tokenPersistenceEnabled: status.tokenPersistenceEnabled,
          analyticsReadEnabled: status.analyticsReadEnabled,
        };
        if (!safeStatus.configured || !safeStatus.connected || containerIds.length !== 1) {
          sendResponse({ ok: true, status: safeStatus, containerIds });
          return;
        }
        const recognitionResponse = await fetch(
          `http://127.0.0.1:8787/api/google/containers/recognize?publicId=${encodeURIComponent(containerIds[0]!)}`,
        );
        if (!recognitionResponse.ok) {
          sendResponse({ ok: true, status: safeStatus, containerIds, recognitionError: "recognition_unavailable" });
          return;
        }
        const recognition: unknown = await recognitionResponse.json();
        sendResponse({ ok: true, status: safeStatus, containerIds, recognition });
      })
      .catch(() => sendResponse({ ok: false, error: "service_offline" }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GA4_VERIFICATION_REQUEST") return undefined;
    const operation = message.operation;
    let endpoint: string;
    let body: Record<string, string>;
    if (operation === "start"
      && typeof message.measurementId === "string"
      && /^G-[A-Z0-9]+$/.test(message.measurementId)
      && typeof message.eventName === "string"
      && /^[a-z][a-z0-9_]{0,39}$/.test(message.eventName)) {
      endpoint = "start";
      body = { measurementId: message.measurementId, eventName: message.eventName };
    } else if (operation === "confirm"
      && typeof message.verificationId === "string"
      && /^[A-Za-z0-9_-]{1,128}$/.test(message.verificationId)) {
      endpoint = "confirm";
      body = { verificationId: message.verificationId };
    } else {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }
    void fetch(`http://127.0.0.1:8787/api/google/analytics/verifications/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (response) => {
      if (!response.ok) {
        let providerCode: unknown;
        try {
          const errorBody: unknown = await response.json();
          providerCode = isRecord(errorBody) ? errorBody.code : undefined;
        } catch {
          providerCode = undefined;
        }
        const error = providerCode === "reads_disabled"
          ? "analytics_disabled"
          : providerCode === "provider_forbidden"
            ? "analytics_provider_forbidden"
          : operation === "start" && response.status === 404
            ? "measurement_not_accessible"
            : operation === "start" && response.status === 409
              ? "measurement_ambiguous"
              : operation === "confirm" && (response.status === 404 || response.status === 410)
                ? "verification_expired"
                : "analytics_unavailable";
        sendResponse({ ok: false, error });
        return;
      }
      const result: unknown = await response.json();
      sendResponse({ ok: true, result });
    }).catch(() => sendResponse({ ok: false, error: "service_offline" }));
    return true;
  },
);

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
