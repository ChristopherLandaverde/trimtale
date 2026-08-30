import {
  interpretConversationIntent,
  type BrowserEvidence,
  type FormCandidate,
  type FormSetupRequest,
  type NavigationElement,
  type SetupRequest,
  type TrackingRunEvidenceV1,
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
type GtmWorkflowAction = "start" | "resume" | "get" | "publish" | "browserVerification";
type TrackingWorkflowRequest = SetupRequest | FormSetupRequest;
type StoredWorkflowResult =
  | { status: "versioned"; operation: Record<string, unknown>; nextStep: "await_approval" }
  | { status: "published"; operation: Record<string, unknown>; nextStep: "verify_publication" }
  | { status: "completed"; operation: Record<string, unknown>; nextStep: "platform_unavailable" }
  | { status: "rollback_required"; operation: Record<string, unknown>; nextStep: "rollback_approval" }
  | {
    status: "blocked" | "paused";
    operation: Record<string, unknown>;
    stage: "planning" | "application" | "validation" | "version" | "approval" | "publication";
    reason: string;
  };

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
} {
  return isRecord(value)
    && typeof value.configured === "boolean"
    && typeof value.connected === "boolean"
    && (value.scope === "read-only" || value.scope === "container-edit")
    && typeof value.containerWritesEnabled === "boolean"
    && typeof value.publicationScopeRequested === "boolean"
    && typeof value.publicationEnabled === "boolean"
    && typeof value.tokenPersistenceEnabled === "boolean";
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
    void fetch("http://127.0.0.1:18787/api/google/status")
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
        };
        if (!safeStatus.configured || !safeStatus.connected || containerIds.length !== 1) {
          sendResponse({ ok: true, status: safeStatus, containerIds });
          return;
        }
        const recognitionResponse = await fetch(
          `http://127.0.0.1:18787/api/google/containers/recognize?publicId=${encodeURIComponent(containerIds[0]!)}`,
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
      ? fetch(`http://127.0.0.1:18787/api/google/containers/recognize?publicId=${encodeURIComponent(message.publicId)}`)
      : fetch("http://127.0.0.1:18787/api/google/containers/prepare-workspace", {
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

function workflowError(status: number, action?: GtmWorkflowAction): string {
  if (status === 403 && action === "publish") return "GTM publication is disabled for this backend.";
  if (status === 403) return "Container-write access is disabled for this backend.";
  if (status === 404) return "The tracking setup operation was not found.";
  if (status === 409) return "The tracking setup operation is blocked and needs review.";
  if (status === 503) return "Google OAuth is not configured or connected for setup operations.";
  return "The tracking setup operation could not continue.";
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    const body = await response.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function workflowResultFromStoredOperation(operation: Record<string, unknown>): StoredWorkflowResult {
  const status = typeof operation.status === "string" ? operation.status : "unknown";
  if (status === "versioned") {
    return { status: "versioned", operation, nextStep: "await_approval" };
  }
  if (status === "published") {
    return { status: "published", operation, nextStep: "verify_publication" };
  }
  if (status === "completed") {
    return { status: "completed", operation, nextStep: "platform_unavailable" };
  }
  if (status === "rollback_required") {
    return { status: "rollback_required", operation, nextStep: "rollback_approval" };
  }
  if (status === "planned") {
    return { status: "paused", operation, stage: "planning", reason: "ready_to_apply" };
  }
  if (status === "applying") {
    return { status: "paused", operation, stage: "application", reason: "partial_application" };
  }
  if (status === "applied") {
    return { status: "paused", operation, stage: "validation", reason: "ready_to_validate" };
  }
  if (status === "validated") {
    return { status: "paused", operation, stage: "version", reason: "ready_to_version" };
  }
  if (status === "validation_failed") {
    return { status: "blocked", operation, stage: "validation", reason: "validation_failed" };
  }
  return { status: "blocked", operation, stage: "version", reason: `operation_${status}` };
}

chrome.runtime.onMessage.addListener(
  (
    message: {
      type?: string;
      action?: GtmWorkflowAction;
      request?: TrackingWorkflowRequest;
      operationId?: string;
      versionFingerprint?: string;
      approvedBy?: string;
      evidence?: TrackingRunEvidenceV1;
    },
    _sender,
    sendResponse,
  ) => {
    if (message.type !== "GTM_WORKFLOW_REQUEST") return undefined;
    void (async () => {
      try {
        let operationId = message.operationId;
        if (message.action === "start") {
          if (!message.request) {
            sendResponse({ ok: false, error: "A confirmed tracking setup is required." });
            return;
          }
          const planned = await fetch("http://127.0.0.1:18787/api/google/workflows/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message.request),
          });
          const plannedBody = await readJsonResponse(planned);
          if (!planned.ok) {
            sendResponse({ ok: false, error: workflowError(planned.status) });
            return;
          }
          const result = isRecord(plannedBody.result) ? plannedBody.result : {};
          const operation = isRecord(result.operation) ? result.operation : undefined;
          operationId = typeof operation?.id === "string" ? operation.id : undefined;
        }

        if (message.action === "get") {
          if (!operationId) {
            sendResponse({ ok: false, error: "A tracking setup operation ID is required." });
            return;
          }
          const detail = await fetch(`http://127.0.0.1:18787/api/google/workflows/${encodeURIComponent(operationId)}`);
          const detailBody = await readJsonResponse(detail);
          const operation = isRecord(detailBody.operation) ? detailBody.operation : undefined;
          sendResponse(detail.ok
            ? operation
              ? { ok: true, result: workflowResultFromStoredOperation(operation) }
              : { ok: false, error: "The tracking setup operation detail was unavailable." }
            : { ok: false, error: workflowError(detail.status) });
          return;
        }

        if (message.action === "publish") {
          if (!operationId || !message.versionFingerprint || !message.approvedBy) {
            sendResponse({ ok: false, error: "Publication requires an operation ID, version fingerprint, and approver." });
            return;
          }
          const published = await fetch(`http://127.0.0.1:18787/api/google/workflows/${encodeURIComponent(operationId)}/publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              versionFingerprint: message.versionFingerprint,
              approvedBy: message.approvedBy,
            }),
          });
          const publishedBody = await readJsonResponse(published);
          sendResponse(published.ok
            ? { ok: true, result: publishedBody.result }
            : { ok: false, error: workflowError(published.status, "publish") });
          return;
        }

        if (message.action === "browserVerification") {
          if (!operationId || !message.evidence) {
            sendResponse({ ok: false, error: "Browser verification requires an operation ID and evidence." });
            return;
          }
          const verified = await fetch(`http://127.0.0.1:18787/api/google/workflows/${encodeURIComponent(operationId)}/browser-verification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ evidence: message.evidence }),
          });
          const verifiedBody = await readJsonResponse(verified);
          sendResponse(verified.ok
            ? { ok: true, result: verifiedBody.result }
            : { ok: false, error: workflowError(verified.status) });
          return;
        }

        if (message.action !== "start" && message.action !== "resume") {
          sendResponse({ ok: false, error: "Unsupported tracking setup operation action." });
          return;
        }
        if (!operationId) {
          sendResponse({ ok: false, error: "A tracking setup operation ID is required." });
          return;
        }
        const resumed = await fetch(`http://127.0.0.1:18787/api/google/workflows/${encodeURIComponent(operationId)}/resume`, {
          method: "POST",
        });
        const resumedBody = await readJsonResponse(resumed);
        sendResponse(resumed.ok
          ? { ok: true, result: resumedBody.result }
          : { ok: false, error: workflowError(resumed.status) });
      } catch {
        sendResponse({ ok: false, error: "The local GTM workflow service could not be reached." });
      }
    })();
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
      void chrome.tabs.sendMessage(sender.tab.id, { type: "VERIFICATION_EVIDENCE", evidence }).catch(() => undefined);
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
    void chrome.tabs.sendMessage(details.tabId, { type: "VERIFICATION_EVIDENCE", evidence: updated }).catch(() => undefined);
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
