import {
  agentTurnForIntake,
  interpretConversationIntent,
  validateFormSetupRequest,
  type AgentTurnContext,
  type BrowserEvidence,
  type FormSetupRequest,
  type FormCandidate,
  type NavigationElement,
} from "@gtm-observability/core";

function validAutomaticCoverage(
  value: unknown,
): value is NonNullable<AgentTurnContext["automaticCoverage"]> {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.enabled === "boolean"
    && typeof value.outboundClicks === "boolean"
    && typeof value.fileDownloads === "boolean"
    && typeof value.formInteractions === "boolean";
}

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
    automaticCoverage?: unknown;
  }) => {
    if (message.type !== "ASSISTANT_REQUEST" || !message.requestId || !message.prompt || !message.page) return;
    const page = message.page;
    const intake = interpretConversationIntent(message.prompt, {
      navigationCount: page.navigation.length,
      forms: page.forms ?? [],
    });
    const turn = agentTurnForIntake(intake, {
      formCount: page.forms.length,
      navigationCount: page.navigation.length,
      ...(validAutomaticCoverage(message.automaticCoverage)
        ? { automaticCoverage: message.automaticCoverage }
        : {}),
      ...(message.connection ? { connection: message.connection } : {}),
    });
    port.postMessage({
      type: "AGENT_TURN",
      requestId: message.requestId,
      turn,
      navigation: page.navigation,
      forms: page.forms,
      intake,
    });
  });
});

type GtmContainerOperation = "inspect" | "prepare";

const workflowBaseUrl = "http://127.0.0.1:8787/api/google/workflows";
const workflowPlanUrl = `${workflowBaseUrl}/plan`;
const maxPlanActions = 64;
const maxGeneratedNameLength = 256;
const maxFingerprintLength = 256;

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

function exactMeasurementId(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.result) || value.result.status !== "recognized") {
    return undefined;
  }
  const measurementIds = value.result.measurementIds;
  if (!Array.isArray(measurementIds)
    || measurementIds.length !== 1
    || typeof measurementIds[0] !== "string"
    || !/^G-[A-Z0-9]+$/.test(measurementIds[0])) {
    return undefined;
  }

  return measurementIds[0];
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message)
      || message.type !== "GA4_ENHANCED_MEASUREMENT_REQUEST"
      || typeof message.measurementId !== "string"
      || !/^G-[A-Z0-9]+$/.test(message.measurementId)) {
      return undefined;
    }
    void fetch("http://127.0.0.1:8787/api/google/analytics/enhanced-measurement/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ measurementId: message.measurementId }),
    }).then(async (response) => {
      if (!response.ok) {
        sendResponse({ ok: false, error: "analytics_unavailable" });
        return;
      }
      const result: unknown = await response.json();
      sendResponse({ ok: true, result });
    }).catch(() => sendResponse({ ok: false, error: "service_offline" }));
    return true;
  },
);

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
        const measurementId = safeStatus.analyticsReadEnabled
          ? exactMeasurementId(recognition)
          : undefined;
        if (!measurementId) {
          sendResponse({ ok: true, status: safeStatus, containerIds, recognition });
          return;
        }
        try {
          const enhancedResponse = await fetch(
            `http://127.0.0.1:8787/api/google/analytics/enhanced-measurement?measurementId=${encodeURIComponent(measurementId)}`,
          );
          if (!enhancedResponse.ok) {
            sendResponse({
              ok: true,
              status: safeStatus,
              containerIds,
              recognition,
              enhancedMeasurementError: "unavailable",
            });
            return;
          }
          const enhancedMeasurement: unknown = await enhancedResponse.json();
          sendResponse({ ok: true, status: safeStatus, containerIds, recognition, enhancedMeasurement });
        } catch {
          sendResponse({
            ok: true,
            status: safeStatus,
            containerIds,
            recognition,
            enhancedMeasurementError: "unavailable",
          });
        }
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

interface PlanActionSummary {
  kind: "tag" | "trigger" | "variable" | "builtInVariable";
  action: "create" | "reuse" | "no_op" | "update" | "conflict";
  generatedName: string;
  reason?: "managed_change_requires_approval";
}

interface WorkflowPlanSummary {
  operationId: string;
  status: "planned";
  planStatus: "ready" | "conflict";
  fingerprint: string;
  actions: PlanActionSummary[];
}

interface WorkflowResumeSummary {
  operationId: string;
  status: "versioned" | "blocked" | "paused";
  stage?: "planning" | "application" | "validation" | "version";
  validationStatus?: "passed";
  versionFingerprint?: string;
  nextStep?: "await_approval";
}

function formWorkflowRequest(value: unknown): FormSetupRequest | undefined {
  if (!isRecord(value)
    || !isRecord(value.specification)
    || typeof value.measurementId !== "string"
    || !isRecord(value.container)) {
    return undefined;
  }
  const request = value as unknown as FormSetupRequest;
  return validateFormSetupRequest(request).length === 0 ? request : undefined;
}

function planSummary(value: unknown): WorkflowPlanSummary | undefined {
  if (!isRecord(value)
    || (value.status !== "planned" && value.status !== "reused")
    || !isRecord(value.operation)
    || typeof value.operation.id !== "string"
    || !/^operation_[A-Za-z0-9_-]+$/.test(value.operation.id)
    || value.operation.status !== "planned"
    || !isRecord(value.operation.plan)) {
    return undefined;
  }
  const plan = value.operation.plan;
  if ((plan.status !== "ready" && plan.status !== "conflict")
    || typeof plan.fingerprint !== "string"
    || !/^plan_[A-Za-z0-9_-]+$/.test(plan.fingerprint)
    || !Array.isArray(plan.actions)
    || plan.actions.length > maxPlanActions) {
    return undefined;
  }
  const actions: PlanActionSummary[] = [];
  for (const action of plan.actions) {
    if (!isRecord(action)
      || !["tag", "trigger", "variable", "builtInVariable"].includes(String(action.kind))
      || !["create", "reuse", "no_op", "update", "conflict"].includes(String(action.action))
      || typeof action.generatedName !== "string"
      || action.generatedName.trim().length === 0
      || action.generatedName.length > maxGeneratedNameLength) {
      return undefined;
    }
    actions.push({
      kind: action.kind as PlanActionSummary["kind"],
      action: action.action as PlanActionSummary["action"],
      generatedName: action.generatedName,
      ...(action.action === "conflict" && action.reason === "managed_change_requires_approval"
        ? { reason: action.reason }
        : {}),
    });
  }
  return {
    operationId: value.operation.id,
    status: "planned",
    planStatus: plan.status,
    fingerprint: plan.fingerprint,
    actions,
  };
}

function validFingerprint(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maxFingerprintLength
    && /^[A-Za-z0-9._-]+$/.test(value);
}

function resumeSummary(
  value: unknown,
  operationId: string,
): WorkflowResumeSummary | undefined {
  if (!isRecord(value)
    || !["versioned", "blocked", "paused"].includes(String(value.status))
    || !isRecord(value.operation)
    || value.operation.id !== operationId) {
    return undefined;
  }
  if (value.status === "versioned") {
    if (value.nextStep !== "await_approval"
      || value.operation.status !== "versioned"
      || !isRecord(value.operation.validation)
      || value.operation.validation.status !== "passed"
      || !isRecord(value.operation.version)
      || !validFingerprint(value.operation.version.fingerprint)
      || !validFingerprint(value.operation.version.priorLiveVersionFingerprint)) {
      return undefined;
    }
    return {
      operationId,
      status: "versioned",
      validationStatus: "passed",
      versionFingerprint: value.operation.version.fingerprint,
      nextStep: "await_approval",
    };
  }
  if (!["planning", "application", "validation", "version"].includes(String(value.stage))) {
    return undefined;
  }
  return {
    operationId,
    status: value.status as "blocked" | "paused",
    stage: value.stage as "planning" | "application" | "validation" | "version",
  };
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GTM_WORKFLOW_PLAN_REQUEST") {
      return undefined;
    }
    const request = formWorkflowRequest(message.request);
    if (!request) {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }

    void fetch(workflowPlanUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }).then(async (response) => {
      if (!response.ok) {
        sendResponse({
          ok: false,
          error: response.status === 409 ? "planning_blocked" : "planning_unavailable",
        });
        return;
      }
      const body: unknown = await response.json();
      const summary = isRecord(body) ? planSummary(body.result) : undefined;
      sendResponse(summary
        ? { ok: true, result: summary }
        : { ok: false, error: "invalid_response" });
    }).catch(() => sendResponse({ ok: false, error: "service_offline" }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GTM_WORKFLOW_RESUME_REQUEST") {
      return undefined;
    }
    const operationId = message.operationId;
    if (typeof operationId !== "string" || !/^operation_[A-Za-z0-9_-]+$/.test(operationId)) {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }

    void fetch(`${workflowBaseUrl}/${encodeURIComponent(operationId)}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).then(async (response) => {
      if (!response.ok) {
        sendResponse({ ok: false, error: "workflow_unavailable" });
        return;
      }
      const body: unknown = await response.json();
      const summary = isRecord(body) ? resumeSummary(body.result, operationId) : undefined;
      sendResponse(summary
        ? { ok: true, result: summary }
        : { ok: false, error: "invalid_response" });
    }).catch(() => sendResponse({ ok: false, error: "service_offline" }));
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
