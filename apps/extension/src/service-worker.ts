import {
  adoptIntakeInterpretation,
  agentTurnForIntake,
  createIntakeInterpretationInputV2,
  createMeasurementPlan,
  interpretConversationIntent,
  selectMeasurementPlanItem,
  validateGa4ActionReceipt,
  validateGa4ConfigurationPlan,
  validateTrackingSetup,
  validateExactDraftBrowserRun,
  validateTrackingRunEvidence,
  validateProviderProgressProjection,
  validateIntakeInterpretationV2,
  validateAuthoringInput,
  validateFormSetupRequest,
  type AgentTurnContext,
  type BrowserEvidence,
  type ExactDraftBrowserRunV1,
  type FormSetupRequest,
  type GenericTrackingSetupRequest,
  type Ga4ActionReceiptV1,
  type Ga4ConfigurationPlanV1,
  type FormCandidate,
  type ConversationIntakeResult,
  type ConversationPageContext,
  type KnownInteractionTypeV1,
  type MeasurementPlanCreation,
  type NavigationElement,
  type ProviderProgressProjectionV1,
  type TrackingRunEvidenceV1,
} from "@gtm-observability/core";
import {
  authenticatedApiFetch,
  productAuthError,
  signInProduct,
  signOutProduct,
} from "./product-auth.js";

function validAutomaticCoverage(
  value: unknown,
): value is NonNullable<AgentTurnContext["automaticCoverage"]> {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.enabled === "boolean"
    && typeof value.pageViews === "boolean"
    && typeof value.scrolls === "boolean"
    && typeof value.outboundClicks === "boolean"
    && typeof value.siteSearch === "boolean"
    && typeof value.videoEngagement === "boolean"
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

interface AssistantPageInput {
  title: string;
  url: string;
  navigation: NavigationElement[];
  forms: FormCandidate[];
  interactionCounts?: Partial<Record<KnownInteractionTypeV1, number>>;
  calendlyEmbedCount?: number;
}

function conversationPage(page: AssistantPageInput): ConversationPageContext {
  return {
    navigationCount: page.navigation.length,
    forms: page.forms,
    ...(page.interactionCounts ? { interactionCounts: page.interactionCounts } : {}),
    calendlyEmbedCount: page.calendlyEmbedCount ?? 0,
  };
}

function assistantContext(
  page: AssistantPageInput,
  automaticCoverage: unknown,
  connection?: { publicId: string; measurementId?: string },
): AgentTurnContext {
  return {
    formCount: page.forms.length,
    navigationCount: page.navigation.length,
    ...(page.interactionCounts ? { interactionCounts: page.interactionCounts } : {}),
    calendlyEmbedCount: page.calendlyEmbedCount ?? 0,
    ...(validAutomaticCoverage(automaticCoverage) ? { automaticCoverage } : {}),
    ...(connection ? { connection } : {}),
  };
}

type InterpretedAssistantResult =
  | { kind: "intake"; intake: ConversationIntakeResult }
  | { kind: "measurement_plan"; creation: MeasurementPlanCreation };

async function interpretedIntake(
  prompt: string,
  page: AssistantPageInput,
  context: AgentTurnContext,
): Promise<InterpretedAssistantResult> {
  const pageContext = conversationPage(page);
  const deterministic = interpretConversationIntent(prompt, pageContext);
  const input = createIntakeInterpretationInputV2(prompt, pageContext);
  let response: Response;
  try {
    response = await authenticatedApiFetch("http://127.0.0.1:8787/api/intake/interpretations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { kind: "intake", intake: deterministic };
  }
  if (response.status === 503 || response.status === 401 || response.status === 403) {
    return { kind: "intake", intake: deterministic };
  }
  if (!response.ok) {
    return { kind: "intake", intake: deterministic };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "intake", intake: interpretConversationIntent("", pageContext) };
  }
  const result = isRecord(body) ? body.result : undefined;
  if (validateIntakeInterpretationV2(input, result).length > 0) {
    return { kind: "intake", intake: interpretConversationIntent("", pageContext) };
  }
  const creation = createMeasurementPlan(input, result, pageContext, context);
  if (creation) {
    return { kind: "measurement_plan", creation };
  }
  const adoption = adoptIntakeInterpretation(input, result, pageContext);
  return {
    kind: "intake",
    intake: adoption.status === "accepted"
      ? adoption.intake
      : interpretConversationIntent("", pageContext),
  };
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "assistant") return;
  const plans = new Map<string, MeasurementPlanCreation>();

  const postTurn = (
    requestId: string,
    intake: ConversationIntakeResult,
    page: AssistantPageInput,
    context: AgentTurnContext,
  ): void => {
    port.postMessage({
      type: "AGENT_TURN",
      requestId,
      turn: agentTurnForIntake(intake, context),
      navigation: page.navigation,
      forms: page.forms,
      interactionCounts: page.interactionCounts,
      calendlyEmbedCount: page.calendlyEmbedCount,
      intake,
    });
  };

  port.onMessage.addListener((message: {
    type?: string;
    requestId?: string;
    planRequestId?: string;
    itemId?: string;
    prompt?: string;
    page?: AssistantPageInput;
    connection?: { publicId: string; measurementId?: string };
    automaticCoverage?: unknown;
  }) => {
    if (message.type === "SELECT_MEASUREMENT_PLAN_ITEM"
      && message.requestId
      && message.planRequestId
      && message.itemId
      && message.page) {
      const creation = plans.get(message.planRequestId);
      const intake = creation
        ? selectMeasurementPlanItem(creation, message.itemId, conversationPage(message.page))
        : undefined;
      if (!creation || !intake) {
        port.postMessage({ type: "ASSISTANT_ERROR", requestId: message.requestId });
        return;
      }
      plans.delete(message.planRequestId);
      postTurn(
        message.requestId,
        intake,
        message.page,
        assistantContext(message.page, message.automaticCoverage, message.connection),
      );
      return;
    }
    if (message.type !== "ASSISTANT_REQUEST"
      || !message.requestId
      || !message.prompt
      || !message.page) {
      return;
    }
    const page = message.page;
    const requestId = message.requestId;
    const context = assistantContext(page, message.automaticCoverage, message.connection);
    const deterministic = interpretConversationIntent(message.prompt, conversationPage(page));
    void interpretedIntake(message.prompt, page, context).then((result) => {
      if (result.kind === "intake") {
        postTurn(requestId, result.intake, page, context);
        return;
      }
      if (plans.size >= 8) {
        const oldestPlanId = plans.keys().next().value;
        if (typeof oldestPlanId === "string") {
          plans.delete(oldestPlanId);
        }
      }
      plans.set(requestId, result.creation);
      port.postMessage({
        type: "MEASUREMENT_PLAN",
        requestId,
        plan: result.creation.plan,
        navigation: page.navigation,
        forms: page.forms,
        interactionCounts: page.interactionCounts,
        calendlyEmbedCount: page.calendlyEmbedCount,
      });
    }).catch(() => postTurn(requestId, deterministic, page, context));
  });
});

type GtmContainerOperation = "inspect" | "prepare";

const workflowBaseUrl = "http://127.0.0.1:8787/api/google/workflows";
const workflowPlanUrl = `${workflowBaseUrl}/plan`;
const maxPlanActions = 64;
const maxGeneratedNameLength = 256;
const maxFingerprintLength = 256;
const maxSemanticsLength = 32_000;

const gtmPublicIdPattern = /^GTM-[A-Z0-9]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validGa4Plan(value: unknown): value is Ga4ConfigurationPlanV1 {
  return validateGa4ConfigurationPlan(value).length === 0;
}

function validGa4Result(
  value: unknown,
  plan: Ga4ConfigurationPlanV1,
): value is {
  status: "applied";
  receipts: Ga4ActionReceiptV1[];
  providerStateFingerprint: string;
} {
  if (!isRecord(value)
    || value.status !== "applied"
    || !Array.isArray(value.receipts)
    || value.receipts.length !== plan.actions.length
    || typeof value.providerStateFingerprint !== "string") {
    return false;
  }

  const actionIds = new Set(plan.actions.map(({ id }) => id));
  return value.receipts.every((receipt) => validateGa4ActionReceipt(receipt).length === 0
    && isRecord(receipt)
    && receipt.planId === plan.id
    && receipt.planFingerprint === plan.planFingerprint
    && receipt.propertyId === plan.target.propertyId
    && typeof receipt.actionId === "string"
    && actionIds.has(receipt.actionId));
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

function bridgeError(error: unknown, fallback = "service_offline"): string {
  return productAuthError(error) ?? fallback;
}

async function productAuthStatus(): Promise<
  | { ok: true; role: "member" | "admin" }
  | { ok: false; error: string }
> {
  try {
    const response = await authenticatedApiFetch("http://127.0.0.1:8787/api/auth/status");
    if (response.status === 403) return { ok: false, error: "organization_forbidden" };
    if (!response.ok) return { ok: false, error: "authentication_unavailable" };
    const value: unknown = await response.json();
    if (!isRecord(value) || value.authenticated !== true
      || (value.role !== "member" && value.role !== "admin")) {
      return { ok: false, error: "authentication_unavailable" };
    }
    return { ok: true, role: value.role };
  } catch (error) {
    return { ok: false, error: bridgeError(error, "authentication_unavailable") };
  }
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message)) return undefined;
    if (message.type === "PRODUCT_AUTH_STATUS_REQUEST") {
      void productAuthStatus().then(sendResponse);
      return true;
    }
    if (message.type === "PRODUCT_AUTH_SIGN_IN_REQUEST") {
      void signInProduct()
        .then(productAuthStatus)
        .then(sendResponse)
        .catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
      return true;
    }
    if (message.type === "PRODUCT_AUTH_SIGN_OUT_REQUEST") {
      void signOutProduct()
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false, error: "authentication_unavailable" }));
      return true;
    }
    return undefined;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "SETUP_AUTHORING_REQUEST") return undefined;
    if (validateAuthoringInput(message.input).length > 0 || !isRecord(message.grounding)) {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }
    void authenticatedApiFetch("http://127.0.0.1:8787/api/setup-authoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: message.input, grounding: message.grounding }),
    }).then(async (response) => {
      if (!response.ok) {
        sendResponse({ ok: false, error: response.status === 503 ? "authoring_unavailable" : "authoring_rejected" });
        return;
      }
      const body: unknown = await response.json();
      const result = isRecord(body) && isRecord(body.result) ? body.result : undefined;
      const proposal = result && isRecord(result.proposal) ? result.proposal : undefined;
      const setup = result?.setup;
      const suggestions = result?.suggestions;
      if (!result
        || typeof result.providerId !== "string"
        || !proposal
        || proposal.status !== "ready"
        || typeof proposal.eventName !== "string"
        || typeof proposal.rationale !== "string"
        || !Array.isArray(suggestions)
        || suggestions.some((item) => !isRecord(item)
          || typeof item.name !== "string"
          || typeof item.classification !== "string"
          || typeof item.rationale !== "string")
        || validateTrackingSetup(setup).length > 0
        || !isRecord(setup)
        || setup.status !== "draft") {
        sendResponse({ ok: false, error: "invalid_response" });
        return;
      }
      sendResponse({
        ok: true,
        result: {
          providerId: result.providerId,
          eventName: proposal.eventName,
          rationale: proposal.rationale,
          suggestions: suggestions.map((item) => ({
            name: item.name,
            classification: item.classification,
            rationale: item.rationale,
          })),
          setup,
        },
      });
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GA4_CONFIGURATION_REQUEST") {
      return undefined;
    }

    let endpoint: "plan" | "apply";
    let body: Record<string, unknown>;
    let reviewedPlan: Ga4ConfigurationPlanV1 | undefined;
    if (message.operation === "plan"
      && typeof message.id === "string"
      && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(message.id)
      && typeof message.measurementId === "string"
      && /^G-[A-Z0-9]{4,20}$/.test(message.measurementId)
      && Array.isArray(message.actions)
      && message.actions.length > 0
      && message.actions.length <= 50) {
      endpoint = "plan";
      body = {
        id: message.id,
        measurementId: message.measurementId,
        actions: message.actions,
      };
    } else if (message.operation === "apply" && validGa4Plan(message.plan)) {
      endpoint = "apply";
      reviewedPlan = message.plan;
      body = { plan: reviewedPlan };
    } else {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }

    void authenticatedApiFetch(`http://127.0.0.1:8787/api/google/analytics/configuration/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (response) => {
      if (!response.ok) {
        const error = response.status === 409
          ? "configuration_stale"
          : response.status === 403
            ? "writes_disabled"
            : "configuration_unavailable";
        sendResponse({ ok: false, error });
        return;
      }
      const result: unknown = await response.json();
      if (endpoint === "plan" ? !validGa4Plan(result) : !reviewedPlan || !validGa4Result(result, reviewedPlan)) {
        sendResponse({ ok: false, error: "invalid_response" });
        return;
      }
      sendResponse({ ok: true, result });
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message)
      || message.type !== "GA4_ENHANCED_MEASUREMENT_REQUEST"
      || typeof message.measurementId !== "string"
      || !/^G-[A-Z0-9]+$/.test(message.measurementId)) {
      return undefined;
    }
    void authenticatedApiFetch("http://127.0.0.1:8787/api/google/analytics/enhanced-measurement/enable", {
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
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
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
    void authenticatedApiFetch("http://127.0.0.1:8787/api/google/status")
      .then(async (response) => {
        if (response.status === 403) {
          sendResponse({ ok: false, error: "organization_forbidden" });
          return;
        }
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
        const recognitionResponse = await authenticatedApiFetch(
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
          const enhancedResponse = await authenticatedApiFetch(
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
      .catch((error: unknown) => sendResponse({
        ok: false,
        error: productAuthError(error) ?? "service_offline",
      }));
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
    void authenticatedApiFetch(`http://127.0.0.1:8787/api/google/analytics/verifications/${endpoint}`, {
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
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
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
      ? authenticatedApiFetch(`http://127.0.0.1:8787/api/google/containers/recognize?publicId=${encodeURIComponent(message.publicId)}`)
      : authenticatedApiFetch("http://127.0.0.1:8787/api/google/containers/prepare-workspace", {
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
        error: productAuthError(error) ?? (error instanceof Error
          ? error.message
          : "The local GTM integration could not be reached."),
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
  entitySignature?: string;
  existingId?: string;
  replacement?: {
    currentFingerprint: string;
    currentSemantics: string;
    proposedSemantics: string;
  };
}

interface WorkflowPlanSummary {
  operationId: string;
  status: "planned";
  planStatus: "ready" | "conflict";
  fingerprint: string;
  actions: PlanActionSummary[];
  replacementApproved?: boolean;
}

interface WorkflowResumeSummary {
  operationId: string;
  status: "awaiting_preview" | "versioned" | "published" | "blocked" | "paused" | "provider_progress";
  stage?: "planning" | "application" | "validation" | "version";
  validationStatus?: "passed";
  versionFingerprint?: string;
  nextStep?: "run_tag_assistant_preview" | "await_approval" | "verify_publication";
  setupFingerprint?: string;
  workspaceFingerprint?: string;
  previewVersionFingerprint?: string;
  publishedAt?: string;
  providerProgress?: ProviderProgressProjectionV1;
}

interface WorkflowRepairSummary {
  operationId: string;
  status: "repair_ready";
  planFingerprint: string;
  reasonCode: "workspace_entity_drift";
  attempt: number;
  maximumAttempts: number;
  actions: PlanActionSummary[];
}

interface WorkflowPublicationSummary {
  operationId: string;
  status: "approved" | "published" | "provider_progress";
  versionFingerprint?: string;
  approvedAt?: string;
  publishedAt?: string;
  providerProgress?: ProviderProgressProjectionV1;
}

function trackingWorkflowRequest(value: unknown): FormSetupRequest | GenericTrackingSetupRequest | undefined {
  if (isRecord(value) && isRecord(value.setup) && isRecord(value.container)) {
    const request = value as unknown as GenericTrackingSetupRequest;
    return request.setup.status === "confirmed" && validateTrackingSetup(request.setup).length === 0
      ? request
      : undefined;
  }
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
    || !["planned", "reused", "replacement_approved"].includes(String(value.status))
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
    const managedConflict = action.action === "conflict"
      && action.reason === "managed_change_requires_approval";
    const replacement = isRecord(action.replacement) ? action.replacement : undefined;
    if (managedConflict && (
      typeof action.entitySignature !== "string"
      || !validFingerprint(action.entitySignature)
      || typeof action.existingId !== "string"
      || !validFingerprint(action.existingId)
      || !replacement
      || !validFingerprint(replacement.currentFingerprint)
      || typeof replacement.currentSemantics !== "string"
      || replacement.currentSemantics.length > maxSemanticsLength
      || typeof replacement.proposedSemantics !== "string"
      || replacement.proposedSemantics.length > maxSemanticsLength
    )) {
      return undefined;
    }
    actions.push({
      kind: action.kind as PlanActionSummary["kind"],
      action: action.action as PlanActionSummary["action"],
      generatedName: action.generatedName,
      ...(action.action === "conflict" && action.reason === "managed_change_requires_approval"
        ? {
          reason: action.reason,
          entitySignature: action.entitySignature as string,
          existingId: action.existingId as string,
          replacement: replacement as NonNullable<PlanActionSummary["replacement"]>,
        }
        : {}),
    });
  }
  return {
    operationId: value.operation.id,
    status: "planned",
    planStatus: plan.status,
    fingerprint: plan.fingerprint,
    actions,
    ...(value.status === "replacement_approved" ? { replacementApproved: true } : {}),
  };
}

function resumableOperationId(value: unknown): string | undefined {
  if (!isRecord(value)
    || value.status !== "reused"
    || !isRecord(value.operation)
    || (!(["validated", "versioned", "published"].includes(String(value.operation.status)))
      && !(isRecord(value.operation.providerAttempt) && value.operation.providerAttempt.status === "started"))
    || typeof value.operation.id !== "string"
    || !/^operation_[A-Za-z0-9_-]+$/.test(value.operation.id)) {
    return undefined;
  }

  return value.operation.id;
}

function replacementRefs(value: unknown): value is Array<{
  kind: PlanActionSummary["kind"];
  entitySignature: string;
  existingId: string;
  currentFingerprint: string;
}> {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxPlanActions) return false;
  return value.every((entity) => isRecord(entity)
    && ["tag", "trigger", "variable", "builtInVariable"].includes(String(entity.kind))
    && validFingerprint(entity.entitySignature)
    && validFingerprint(entity.existingId)
    && validFingerprint(entity.currentFingerprint));
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
    || !["awaiting_preview", "versioned", "published", "blocked", "paused", "provider_progress"].includes(String(value.status))
    || !isRecord(value.operation)
    || value.operation.id !== operationId) {
    return undefined;
  }
  if (value.status === "provider_progress") {
    if (validateProviderProgressProjection(value.progress).length > 0) return undefined;
    return {
      operationId,
      status: "provider_progress",
      providerProgress: value.progress as ProviderProgressProjectionV1,
    };
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
  if (value.status === "published") {
    if (value.nextStep !== "verify_publication"
      || value.operation.status !== "published"
      || !isRecord(value.operation.validation)
      || value.operation.validation.status !== "passed"
      || !isRecord(value.operation.version)
      || !validFingerprint(value.operation.version.fingerprint)
      || !isRecord(value.operation.publication)
      || value.operation.publication.versionFingerprint !== value.operation.version.fingerprint
      || typeof value.operation.publication.publishedAt !== "string") {
      return undefined;
    }
    return {
      operationId,
      status: "published",
      validationStatus: "passed",
      versionFingerprint: value.operation.version.fingerprint,
      publishedAt: value.operation.publication.publishedAt,
      nextStep: "verify_publication",
    };
  }
  if (value.status === "awaiting_preview") {
    if (value.nextStep !== "run_tag_assistant_preview"
      || value.operation.status !== "validated"
      || !isRecord(value.operation.validation)
      || value.operation.validation.status !== "passed"
      || !isRecord(value.preview)
      || !validFingerprint(value.preview.setupFingerprint)
      || !validFingerprint(value.preview.workspaceFingerprint)
      || !validFingerprint(value.preview.previewVersionFingerprint)) {
      return undefined;
    }
    return {
      operationId,
      status: "awaiting_preview",
      validationStatus: "passed",
      nextStep: "run_tag_assistant_preview",
      setupFingerprint: value.preview.setupFingerprint,
      workspaceFingerprint: value.preview.workspaceFingerprint,
      previewVersionFingerprint: value.preview.previewVersionFingerprint,
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

function repairSummary(value: unknown, operationId: string): WorkflowRepairSummary | undefined {
  if (!isRecord(value)
    || value.status !== "repair_ready"
    || value.nextStep !== "review_repair"
    || !isRecord(value.repair)
    || !isRecord(value.operation)
    || value.operation.id !== operationId
    || value.operation.status !== "validated"
    || !isRecord(value.operation.draftRepair)
    || value.operation.draftRepair.status !== "review_required"
    || !isRecord(value.operation.draftRepair.plan)) {
    return undefined;
  }
  const repair = value.repair;
  const plan = value.operation.draftRepair.plan;
  if (!validFingerprint(repair.planFingerprint)
    || repair.planFingerprint !== plan.fingerprint
    || repair.reasonCode !== "workspace_entity_drift"
    || !Number.isInteger(repair.attempt)
    || !Number.isInteger(repair.maximumAttempts)
    || Number(repair.attempt) < 1
    || Number(repair.maximumAttempts) < Number(repair.attempt)
    || !Array.isArray(plan.actions)
    || plan.actions.length > maxPlanActions) {
    return undefined;
  }
  const actions: PlanActionSummary[] = [];
  for (const action of plan.actions) {
    if (!isRecord(action)
      || !["tag", "trigger", "variable", "builtInVariable"].includes(String(action.kind))
      || !["create", "reuse", "no_op", "update"].includes(String(action.action))
      || typeof action.generatedName !== "string"
      || action.generatedName.trim().length === 0
      || action.generatedName.length > maxGeneratedNameLength) {
      return undefined;
    }
    actions.push({
      kind: action.kind as PlanActionSummary["kind"],
      action: action.action as PlanActionSummary["action"],
      generatedName: action.generatedName,
    });
  }
  if (!actions.some(({ action }) => action === "create" || action === "update")) {
    return undefined;
  }
  return {
    operationId,
    status: "repair_ready",
    planFingerprint: repair.planFingerprint,
    reasonCode: "workspace_entity_drift",
    attempt: Number(repair.attempt),
    maximumAttempts: Number(repair.maximumAttempts),
    actions,
  };
}

function publicationSummary(
  value: unknown,
  operationId: string,
  expectedVersionFingerprint: string,
): WorkflowPublicationSummary | undefined {
  if (!isRecord(value)
    || !isRecord(value.operation)
    || value.operation.id !== operationId
    || !isRecord(value.operation.version)
    || value.operation.version.fingerprint !== expectedVersionFingerprint) {
    return undefined;
  }
  if (value.status === "approved"
    && value.nextStep === "publish"
    && value.operation.status === "approved"
    && isRecord(value.operation.approval)
    && value.operation.approval.versionFingerprint === expectedVersionFingerprint
    && typeof value.operation.approval.approvedAt === "string") {
    return {
      operationId,
      status: "approved",
      versionFingerprint: expectedVersionFingerprint,
      approvedAt: value.operation.approval.approvedAt,
    };
  }
  if (value.status === "published"
    && value.nextStep === "verify_publication"
    && value.operation.status === "published"
    && isRecord(value.operation.publication)
    && value.operation.publication.versionFingerprint === expectedVersionFingerprint
    && typeof value.operation.publication.publishedAt === "string") {
    return {
      operationId,
      status: "published",
      versionFingerprint: expectedVersionFingerprint,
      publishedAt: value.operation.publication.publishedAt,
    };
  }
  return undefined;
}

function liveVerificationSummary(
  value: unknown,
  operationId: string,
  expectedVersionFingerprint: string,
): Record<string, string> | undefined {
  if (!isRecord(value)
    || !["published", "completed", "rollback_required"].includes(String(value.status))
    || !isRecord(value.operation)
    || value.operation.id !== operationId
    || value.operation.status !== value.status
    || !isRecord(value.operation.version)
    || value.operation.version.fingerprint !== expectedVersionFingerprint
    || !isRecord(value.operation.publication)
    || value.operation.publication.versionFingerprint !== expectedVersionFingerprint
    || typeof value.operation.postPublicationEvidenceId !== "string") {
    return undefined;
  }
  if (value.status === "published" && value.nextStep === "verify_publication") {
    return {
      operationId,
      status: "published",
      nextStep: "verify_publication",
      versionFingerprint: expectedVersionFingerprint,
      evidenceRunId: value.operation.postPublicationEvidenceId,
    };
  }
  if (value.status === "completed" && value.nextStep === "complete") {
    return {
      operationId,
      status: "completed",
      nextStep: "complete",
      versionFingerprint: expectedVersionFingerprint,
      evidenceRunId: value.operation.postPublicationEvidenceId,
    };
  }
  if (value.status === "rollback_required"
    && value.nextStep === "rollback"
    && isRecord(value.operation.rollback)
    && validFingerprint(value.operation.rollback.targetVersionFingerprint)
    && value.operation.rollback.status === "required") {
    return {
      operationId,
      status: "rollback_required",
      nextStep: "rollback",
      versionFingerprint: expectedVersionFingerprint,
      evidenceRunId: value.operation.postPublicationEvidenceId,
      targetVersionFingerprint: value.operation.rollback.targetVersionFingerprint,
    };
  }
  return undefined;
}

function rollbackSummary(
  value: unknown,
  operationId: string,
  expectedVersionFingerprint: string,
  expectedTargetFingerprint: string,
): Record<string, string> | undefined {
  if (!isRecord(value)
    || value.status !== "rolled_back"
    || value.nextStep !== "complete"
    || !isRecord(value.operation)
    || value.operation.id !== operationId
    || value.operation.status !== "rolled_back"
    || !isRecord(value.operation.publication)
    || value.operation.publication.versionFingerprint !== expectedVersionFingerprint
    || !isRecord(value.operation.rollback)
    || value.operation.rollback.status !== "completed"
    || value.operation.rollback.targetVersionFingerprint !== expectedTargetFingerprint
    || typeof value.operation.rollback.completedAt !== "string") {
    return undefined;
  }
  return {
    operationId,
    status: "rolled_back",
    nextStep: "complete",
    versionFingerprint: expectedVersionFingerprint,
    targetVersionFingerprint: expectedTargetFingerprint,
    completedAt: value.operation.rollback.completedAt,
  };
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GTM_WORKFLOW_PLAN_REQUEST") {
      return undefined;
    }
    const request = trackingWorkflowRequest(message.request);
    if (!request) {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }

    void authenticatedApiFetch(workflowPlanUrl, {
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
      const result = isRecord(body) ? body.result : undefined;
      const summary = planSummary(result);
      const resumeOperationId = resumableOperationId(result);
      sendResponse(summary
        ? { ok: true, result: summary }
        : resumeOperationId
          ? { ok: true, resumeOperationId }
        : { ok: false, error: "invalid_response" });
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GTM_WORKFLOW_APPROVE_REPLACEMENT_REQUEST") {
      return undefined;
    }
    const operationId = message.operationId;
    const planFingerprint = message.planFingerprint;
    const entities = message.entities;
    if (typeof operationId !== "string"
      || !/^operation_[A-Za-z0-9_-]+$/.test(operationId)
      || !validFingerprint(planFingerprint)
      || !replacementRefs(entities)) {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }
    void authenticatedApiFetch(`${workflowBaseUrl}/${encodeURIComponent(operationId)}/approve-replacement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planFingerprint, entities }),
    }).then(async (response) => {
      if (!response.ok) {
        sendResponse({ ok: false, error: "replacement_rejected" });
        return;
      }
      const body: unknown = await response.json();
      const summary = isRecord(body) ? planSummary(body.result) : undefined;
      sendResponse(summary
        ? { ok: true, result: summary }
        : { ok: false, error: "invalid_response" });
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GTM_WORKFLOW_REPAIR_DRAFT_REQUEST") {
      return undefined;
    }
    const operationId = message.operationId;
    const run = message.run;
    if (typeof operationId !== "string"
      || !/^operation_[A-Za-z0-9_-]+$/.test(operationId)
      || validateExactDraftBrowserRun(run).length > 0
      || (run as ExactDraftBrowserRunV1).operationId !== operationId
      || (run as ExactDraftBrowserRunV1).evidence.verdict.browserVerification !== "failed") {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }
    void authenticatedApiFetch(`${workflowBaseUrl}/${encodeURIComponent(operationId)}/repair-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(run),
    }).then(async (response) => {
      if (!response.ok) {
        sendResponse({ ok: false, error: "repair_unavailable" });
        return;
      }
      const body: unknown = await response.json();
      const result = isRecord(body) ? repairSummary(body.result, operationId) : undefined;
      sendResponse(result
        ? { ok: true, result }
        : { ok: false, error: "invalid_response" });
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GTM_WORKFLOW_APPLY_REPAIR_REQUEST") {
      return undefined;
    }
    const operationId = message.operationId;
    const planFingerprint = message.planFingerprint;
    if (typeof operationId !== "string"
      || !/^operation_[A-Za-z0-9_-]+$/.test(operationId)
      || !validFingerprint(planFingerprint)) {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }
    void authenticatedApiFetch(`${workflowBaseUrl}/${encodeURIComponent(operationId)}/apply-repair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planFingerprint }),
    }).then(async (response) => {
      if (!response.ok) {
        sendResponse({ ok: false, error: "repair_rejected" });
        return;
      }
      const body: unknown = await response.json();
      const result = isRecord(body) ? resumeSummary(body.result, operationId) : undefined;
      sendResponse(result?.status === "awaiting_preview"
        ? { ok: true, result }
        : { ok: false, error: "invalid_response" });
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GTM_WORKFLOW_VERIFY_PUBLICATION_REQUEST") {
      return undefined;
    }
    const operationId = message.operationId;
    const versionFingerprint = message.versionFingerprint;
    const evidence = message.evidence;
    if (typeof operationId !== "string"
      || !/^operation_[A-Za-z0-9_-]+$/.test(operationId)
      || !validFingerprint(versionFingerprint)
      || validateTrackingRunEvidence(evidence).length > 0) {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }
    void authenticatedApiFetch(`${workflowBaseUrl}/${encodeURIComponent(operationId)}/verify-publication`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionFingerprint, evidence: evidence as TrackingRunEvidenceV1 }),
    }).then(async (response) => {
      if (!response.ok) {
        sendResponse({ ok: false, error: "verification_rejected" });
        return;
      }
      const body: unknown = await response.json();
      const result = isRecord(body)
        ? liveVerificationSummary(body.result, operationId, versionFingerprint)
        : undefined;
      sendResponse(result
        ? { ok: true, result }
        : { ok: false, error: "invalid_response" });
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GTM_WORKFLOW_ROLLBACK_REQUEST") {
      return undefined;
    }
    const operationId = message.operationId;
    const versionFingerprint = message.versionFingerprint;
    const targetVersionFingerprint = message.targetVersionFingerprint;
    if (typeof operationId !== "string"
      || !/^operation_[A-Za-z0-9_-]+$/.test(operationId)
      || !validFingerprint(versionFingerprint)
      || !validFingerprint(targetVersionFingerprint)) {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }
    void authenticatedApiFetch(`${workflowBaseUrl}/${encodeURIComponent(operationId)}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionFingerprint, targetVersionFingerprint }),
    }).then(async (response) => {
      if (!response.ok) {
        sendResponse({ ok: false, error: "rollback_rejected" });
        return;
      }
      const body: unknown = await response.json();
      const result = isRecord(body)
        ? rollbackSummary(body.result, operationId, versionFingerprint, targetVersionFingerprint)
          ?? resumeSummary(body.result, operationId)
        : undefined;
      sendResponse(result
        ? { ok: true, result }
        : { ok: false, error: "invalid_response" });
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message)
      || (message.type !== "GTM_WORKFLOW_APPROVE_PUBLICATION_REQUEST"
        && message.type !== "GTM_WORKFLOW_PUBLISH_REQUEST")) {
      return undefined;
    }
    const operationId = message.operationId;
    const versionFingerprint = message.versionFingerprint;
    if (typeof operationId !== "string"
      || !/^operation_[A-Za-z0-9_-]+$/.test(operationId)
      || !validFingerprint(versionFingerprint)) {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }
    const action = message.type === "GTM_WORKFLOW_APPROVE_PUBLICATION_REQUEST"
      ? "approve-publication"
      : "publish";
    const expectedStatus = action === "approve-publication" ? "approved" : "published";
    void authenticatedApiFetch(`${workflowBaseUrl}/${encodeURIComponent(operationId)}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionFingerprint }),
    }).then(async (response) => {
      if (!response.ok) {
        sendResponse({
          ok: false,
          error: response.status === 403
            ? "publication_disabled"
            : response.status === 409
              ? "publication_stale"
              : "publication_unavailable",
        });
        return;
      }
      const body: unknown = await response.json();
      const result = isRecord(body)
        ? publicationSummary(body.result, operationId, versionFingerprint)
          ?? resumeSummary(body.result, operationId)
        : undefined;
      sendResponse(result?.status === expectedStatus || result?.status === "provider_progress"
        ? { ok: true, result }
        : { ok: false, error: "invalid_response" });
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GTM_WORKFLOW_VERIFY_DRAFT_REQUEST") return undefined;
    const operationId = message.operationId;
    const run = message.run;
    if (typeof operationId !== "string"
      || !/^operation_[A-Za-z0-9_-]+$/.test(operationId)
      || validateExactDraftBrowserRun(run).length > 0
      || (run as ExactDraftBrowserRunV1).operationId !== operationId) {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }
    void authenticatedApiFetch(`${workflowBaseUrl}/${encodeURIComponent(operationId)}/verify-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(run),
    }).then(async (response) => {
      if (!response.ok) {
        sendResponse({ ok: false, error: "verification_rejected" });
        return;
      }
      const body: unknown = await response.json();
      const result = isRecord(body) ? body.result : undefined;
      sendResponse(isRecord(result)
        && result.status === "draft_verified"
        && result.nextStep === "create_version"
        ? { ok: true }
        : { ok: false, error: "invalid_response" });
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "OPEN_TAG_ASSISTANT") return undefined;
    void chrome.tabs.create({ url: "https://tagmanager.google.com/" })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isRecord(message) || message.type !== "GTM_WORKFLOW_PROGRESS_REQUEST") {
      return undefined;
    }
    const operationId = message.operationId;
    if (typeof operationId !== "string" || !/^operation_[A-Za-z0-9_-]+$/.test(operationId)) {
      sendResponse({ ok: false, error: "invalid_request" });
      return undefined;
    }
    const parameters = new URLSearchParams();
    if (message.displayTimedOut === true) parameters.set("displayTimedOut", "true");
    if (message.browserReloaded === true) parameters.set("browserReloaded", "true");
    const query = parameters.size > 0 ? `?${parameters.toString()}` : "";
    void authenticatedApiFetch(`${workflowBaseUrl}/${encodeURIComponent(operationId)}/progress${query}`)
      .then(async (response) => {
        if (!response.ok) {
          sendResponse({ ok: false, error: "progress_unavailable" });
          return;
        }
        const body: unknown = await response.json();
        const progress = isRecord(body) ? body.progress : undefined;
        sendResponse(validateProviderProgressProjection(progress).length === 0
          ? { ok: true, result: progress }
          : { ok: false, error: "invalid_response" });
      })
      .catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
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

    void authenticatedApiFetch(`${workflowBaseUrl}/${encodeURIComponent(operationId)}/resume`, {
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
    }).catch((error: unknown) => sendResponse({ ok: false, error: bridgeError(error) }));
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
