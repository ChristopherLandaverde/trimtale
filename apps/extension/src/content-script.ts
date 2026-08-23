import {
  createFormSetupProposal,
  createSetupProposal,
  determineFormVerdict,
  normalizeFormRunEvidence,
  observeGtmRuntime,
  selectConversationSuccess,
  selectConversationTarget,
  type BrowserEvidence,
  type ConversationIntakeResult,
  type FormCandidate,
  type NavigationArea,
  type NavigationElement,
  type SuccessEvidence,
  type SetupProposal,
  type TrackingRunEvidenceV1,
  type TrackingSpecificationV1,
} from "@gtm-observability/core";

declare global {
  interface Window { __gtmObservabilityInstalled?: boolean; }
}

interface OverlayPreferences {
  x?: number;
  y?: number;
  width: number;
  height: number;
  collapsed: boolean;
}

interface ScanResponse { pageUrl: string; title: string; navigation: NavigationElement[]; }

interface EvidencePathContext {
  intentDetail: string;
  inspectedDetail: string;
  confirmedDetail: string;
  setupGenerated: boolean;
  setupDetail: string;
}

interface GtmWorkspaceResult {
  status: "available" | "capacity_blocked" | "ownership_conflict" | "created" | "reused" | "sync_conflict";
  action?: "create" | "reuse";
  workspaceCount: number;
  remainingSlots?: number;
  managedWorkspaceCount?: number;
  reservedNameCount?: number;
  workspace?: { name: string; workspaceId: string };
}

interface GtmContainerResult {
  status: "recognized" | "not_accessible" | "ambiguous";
  publicId: string;
  matchCount?: number;
  account?: { accountId: string; name: string };
  container?: { accountId: string; containerId: string; name: string; publicId: string };
  measurementIds?: string[];
  workspace?: GtmWorkspaceResult;
}

interface GtmBridgeResponse {
  ok: boolean;
  error?: string;
  result?: GtmContainerResult;
  containerWritesEnabled?: boolean;
}

interface GtmConnectionStatus {
  configured: boolean;
  connected: boolean;
  scope: "read-only" | "container-edit";
  containerWritesEnabled: boolean;
  publicationScopeRequested: boolean;
  publicationEnabled: boolean;
  tokenPersistenceEnabled: boolean;
  analyticsReadEnabled: boolean;
}

interface GtmConnectionContext {
  status: GtmConnectionStatus;
  containerIds: string[];
  recognitionError?: "recognition_unavailable";
  result?: GtmContainerResult;
}

type GtmConnectionView =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "check_failed" }
  | { kind: "unconfigured"; containerIds: string[] }
  | { kind: "disconnected"; containerIds: string[] }
  | { kind: "no_container"; status: GtmConnectionStatus }
  | { kind: "multiple_containers"; status: GtmConnectionStatus; containerIds: string[] }
  | { kind: "recognition_failed"; status: GtmConnectionStatus; publicId: string }
  | { kind: "not_accessible"; status: GtmConnectionStatus; publicId: string }
  | { kind: "ambiguous"; status: GtmConnectionStatus; publicId: string; matchCount: number }
  | {
    kind: "recognized";
    status: GtmConnectionStatus;
    publicId: string;
    account: { accountId: string; name: string };
    container: { accountId: string; containerId: string; name: string; publicId: string };
    measurementIds: string[];
  };

interface EvidencePathHandle {
  browserRow: HTMLElement;
  platformRow: HTMLElement;
}

interface Ga4VerificationStarted {
  status: "started";
  verificationId: string;
  measurementId: string;
  eventName: string;
  baselineEventCount: number;
  property: { propertyId: string; name: string };
  stream: { streamId: string; name: string };
}

interface Ga4VerificationConfirmation {
  status: "pending" | "confirmed";
  verificationId: string;
  baselineEventCount: number;
  currentEventCount: number;
  property: { propertyId: string; name: string };
  stream: { streamId: string; name: string };
  correlation: "aggregate_realtime_count_increase";
}

type ExtensionRequest =
  | { type: "SCAN_NAVIGATION" }
  | { type: "START_VERIFICATION"; navigation: NavigationElement[] }
  | { type: "GET_EVIDENCE" }
  | { type: "FORM_ANALYTICS_REQUEST"; request: { url: string; observedAt: string } }
  | { type: "TOGGLE_OVERLAY" };

const analyticsPattern = /(?:google-analytics\.com|analytics\.google\.com)\/g\/collect/i;
const evidence = new Map<string, BrowserEvidence>();
let verificationScope = new Map<string, NavigationElement>();
let preferences: OverlayPreferences = { width: 380, height: 260, collapsed: true };
let host: HTMLDivElement | undefined;
let frame: HTMLElement | undefined;
let responseList: HTMLElement | undefined;
let composer: HTMLTextAreaElement | undefined;
let gtmConnectionCard: HTMLElement | undefined;
let port: chrome.runtime.Port | undefined;
let targetHost: HTMLDivElement | undefined;
interface PageTarget { id: string; label: string; selector: string; }
let highlightedTargets: PageTarget[] = [];
let highlightTone: "candidate" | "confirmed" = "candidate";
const responseNodes = new Map<string, HTMLElement>();
const navigationByRequest = new Map<string, NavigationElement[]>();
const requestTimeouts = new Map<string, number>();
const intakeByRequest = new Map<string, ConversationIntakeResult>();
const formsByRequest = new Map<string, FormCandidate[]>();
const recentFormRequests: Array<{ url: string; observedAt: string }> = [];
let activeFormVerification: { requestId: string; intake: ConversationIntakeResult } | undefined;
const evidencePaths = new Map<string, EvidencePathHandle>();
const ga4VerificationByRequest = new Map<string, Ga4VerificationStarted>();
const ga4ConfirmationAttempts = new Map<string, number>();
const formVerdictMessages = new Map<string, HTMLElement>();
let recognizedGtmContext: Extract<GtmConnectionView, { kind: "recognized" }> | undefined;
let gtmConnectionLoaded = false;
let gtmConnectionRequestSequence = 0;

function successEvidenceFor(result: ConversationIntakeResult): SuccessEvidence | undefined {
  const signal = result.successSignal;
  if (!signal) return undefined;
  if (signal.type === "visible_element") return { type: signal.type, selector: signal.value };
  if (signal.type === "thank_you_url") return { type: signal.type, urlPattern: signal.value };
  if (signal.type === "data_layer_event") return { type: signal.type, eventName: signal.value };
  return { type: signal.type, signal: signal.value };
}

function confirmedFormSpecification(result: ConversationIntakeResult): TrackingSpecificationV1 | undefined {
  const target = result.target;
  const successEvidence = successEvidenceFor(result);
  if (!target || !successEvidence || !result.canConfirm) return undefined;
  return {
    schemaVersion: 1,
    id: `spec_form_${target.id}`,
    status: "confirmed",
    originalIntent: `Track qualified inquiries from ${target.label}`,
    interaction: { type: "form_submission" },
    conversionOutcome: { type: "qualified_inquiry", practitionerConfirmed: true },
    event: {
      name: "generate_lead",
      requiredParameters: ["form_id", "form_name", "page_location"],
      optionalParameters: [],
    },
    targets: [{
      id: target.id,
      label: target.label,
      selector: target.selector,
      pageUrl: target.pageUrl,
    }],
    successEvidence: [successEvidence],
  };
}

function fixtureMeta(name: string): string | undefined {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content || undefined;
}

function connectedSetupContext() {
  const context = recognizedGtmContext;
  if (!context || context.measurementIds.length !== 1) return undefined;
  return {
    measurementId: context.measurementIds[0]!,
    container: {
      accountId: context.container.accountId,
      containerId: context.container.containerId,
      publicId: context.publicId,
      name: context.container.name,
    },
  };
}

function formSetupProposal(result: ConversationIntakeResult) {
  const specification = confirmedFormSpecification(result);
  const connected = connectedSetupContext();
  const measurementId = connected?.measurementId ?? fixtureMeta("gtm-observability-measurement-id");
  const publicId = connected?.container.publicId ?? fixtureMeta("gtm-observability-container-id");
  if (!specification || !measurementId || !publicId) return undefined;
  return createFormSetupProposal({
    specification,
    measurementId,
    container: connected?.container
      ?? { accountId: "0", containerId: "0", publicId, name: "GTM Observability import" },
  });
}

function navigationSetupProposal(navigation: NavigationElement[]): SetupProposal | undefined {
  const connected = connectedSetupContext();
  const measurementId = connected?.measurementId ?? fixtureMeta("gtm-observability-measurement-id");
  const runtime = inspectGtmRuntime();
  const publicId = connected?.container.publicId ?? (runtime.status === "detected" && runtime.containerIds.length === 1
    ? runtime.containerIds[0]
    : fixtureMeta("gtm-observability-container-id"));
  if (!measurementId || !publicId || navigation.length === 0) return undefined;
  return createSetupProposal({
    intent: "Track navigation links",
    pageUrl: location.href,
    measurementId,
    navigation,
    container: connected?.container
      ?? { accountId: "0", containerId: "0", publicId, name: "GTM Observability import" },
  });
}

function containerFileDownloadHref(containerFile: unknown): string {
  const content = JSON.stringify(containerFile, null, 2);
  return `data:application/json;charset=utf-8,${encodeURIComponent(content)}`;
}

function formSetupDownloadHref(result: ConversationIntakeResult): string | undefined {
  const proposal = formSetupProposal(result);
  if (!proposal) return undefined;
  return containerFileDownloadHref(proposal.containerFile);
}

function formExplanation(
  verdict: TrackingRunEvidenceV1["verdict"],
  platformCheckStarted = false,
): string {
  if (verdict.code === "browser_verified") {
    return platformCheckStarted
      ? "Browser verification passed because one generate_lead request was observed. Checking the pre-run GA4 Realtime baseline now."
      : "Browser verification passed because one generate_lead request was observed. Platform confirmation remains unverified.";
  }
  if (verdict.code === "expected_non_conversion") {
    return "The form was stopped by validation, so this attempt was not counted. Correct the input and submit again. Platform confirmation remains unverified.";
  }
  return `${verdict.code.replaceAll("_", " ")}. ${verdict.nextAction} Platform confirmation remains unverified.`;
}

function analyticsFailureDetail(error: string | undefined): string {
  if (error === "analytics_disabled") return "Analytics reads are disabled on this backend";
  if (error === "analytics_provider_forbidden") return "The Analytics Data API is unavailable or the saved grant cannot read it";
  if (error === "measurement_not_accessible") return "The GA4 destination is not accessible through the saved grant";
  if (error === "measurement_ambiguous") return "The GA4 destination matched multiple accessible streams";
  if (error === "verification_expired") return "The GA4 verification window expired; start a new browser run";
  if (error === "service_offline") return "The local Analytics service is offline";
  return "GA4 Realtime evidence is currently unavailable";
}

async function confirmGa4Platform(requestId: string): Promise<void> {
  const started = ga4VerificationByRequest.get(requestId);
  const row = evidencePaths.get(requestId)?.platformRow;
  if (!started || !row) return;
  const attempt = (ga4ConfirmationAttempts.get(requestId) ?? 0) + 1;
  ga4ConfirmationAttempts.set(requestId, attempt);
  updateEvidenceStage(row, "pending", "Checking GA4 Realtime against the pre-run baseline…");
  const response = await requestGa4Verification({ operation: "confirm", verificationId: started.verificationId });
  const result = response.ok ? parseGa4Confirmation(response.result) : undefined;
  if (!result) {
    ga4ConfirmationAttempts.delete(requestId);
    updateEvidenceStage(row, "failed", analyticsFailureDetail(response.error));
    return;
  }
  if (result.status === "confirmed") {
    ga4VerificationByRequest.delete(requestId);
    ga4ConfirmationAttempts.delete(requestId);
    updateEvidenceStage(
      row,
      "passed",
      `GA4 Realtime count increased from ${result.baselineEventCount} to ${result.currentEventCount}. Aggregate correlation; no user or event-level identity.`,
    );
    const verdict = formVerdictMessages.get(requestId);
    if (verdict) {
      verdict.textContent = "Verdict: browser_verified\nBrowser verification: passed\nPlatform confirmation: passed\nNext action: No further verification action is required.";
    }
    addMessage(
      `Platform confirmation: passed\nGA4 Realtime observed an aggregate generate_lead count increase on ${result.property.name}.`,
      "assistant",
    );
    return;
  }
  updateEvidenceStage(
    row,
    "pending",
    `GA4 Realtime has not increased yet (${result.baselineEventCount} → ${result.currentEventCount}). ${attempt < 12 ? "Checking again automatically…" : "Check again when reporting catches up."}`,
  );
  if (attempt < 12) {
    window.setTimeout(() => void confirmGa4Platform(requestId), 5_000);
    return;
  }
  const path = row.closest<HTMLElement>(".evidence-path");
  path?.querySelector(".platform-action")?.remove();
  const retry = document.createElement("button");
  retry.className = "quick platform-action";
  retry.textContent = "Check GA4 again";
  retry.addEventListener("click", () => {
    retry.remove();
    void confirmGa4Platform(requestId);
  }, { once: true });
  path?.append(retry);
}

async function prepareFormVerification(requestId: string, intake: ConversationIntakeResult): Promise<void> {
  recentFormRequests.length = 0;
  const rows = evidencePaths.get(requestId);
  if (rows) updateEvidenceStage(rows.browserRow, "pending", "Preparing a guided browser run…");
  const context = recognizedGtmContext;
  if (rows && context?.status.analyticsReadEnabled && context.measurementIds.length === 1) {
    updateEvidenceStage(rows.platformRow, "pending", "Recording the pre-run GA4 Realtime baseline…");
    const response = await requestGa4Verification({
      operation: "start",
      measurementId: context.measurementIds[0],
      eventName: "generate_lead",
    });
    const started = response.ok ? parseGa4Started(response.result) : undefined;
    if (started && started.measurementId === context.measurementIds[0] && started.eventName === "generate_lead") {
      ga4VerificationByRequest.set(requestId, started);
      ga4ConfirmationAttempts.set(requestId, 0);
      updateEvidenceStage(
        rows.platformRow,
        "pending",
        `Baseline ${started.baselineEventCount} on ${started.property.name}; waiting for browser verification`,
      );
    } else {
      updateEvidenceStage(rows.platformRow, "failed", analyticsFailureDetail(response.error));
    }
  }
  activeFormVerification = { requestId, intake };
  if (rows) updateEvidenceStage(rows.browserRow, "pending", "Waiting for one successful browser run…");
  addMessage(`Verification is ready. Submit ${intake.target?.label ?? "the selected form"} once.`, "assistant");
}

function classifySubmissionResult(value: string | undefined): "success" | "validation_error" | "server_error" | "unknown" {
  return value === "success" || value === "validation_error" || value === "server_error" ? value : "unknown";
}

function classifyTransport(value: string | undefined): "native" | "redirect" | "ajax" | "spa" | "unobservable" {
  return value === "native" || value === "redirect" || value === "ajax" || value === "spa" ? value : "unobservable";
}

function classifyConsent(value: string | undefined): "granted" | "denied" | "unknown" {
  return value === "granted" || value === "denied" ? value : "unknown";
}

function observableSuccess(result: ConversationIntakeResult): {
  observed: boolean;
  dataLayerEvents: Array<{ event: string }>;
} {
  const signal = result.successSignal;
  if (!signal) return { observed: false, dataLayerEvents: [] };
  if (signal.type === "visible_element") {
    try {
      const element = document.querySelector<HTMLElement>(signal.value);
      const style = element ? getComputedStyle(element) : undefined;
      const observed = Boolean(element
        && !element.hidden
        && element.getAttribute("aria-hidden") !== "true"
        && style?.display !== "none"
        && style?.visibility !== "hidden"
        && element.getClientRects().length > 0);
      return { observed, dataLayerEvents: [] };
    } catch {
      return { observed: false, dataLayerEvents: [] };
    }
  }
  if (signal.type === "thank_you_url") {
    return { observed: location.href.includes(signal.value), dataLayerEvents: [] };
  }
  if (signal.type === "data_layer_event") {
    const layer = (window as Window & { dataLayer?: unknown[] }).dataLayer;
    const observed = Array.isArray(layer) && layer.some(
      (item) => isRecord(item) && item.event === signal.value,
    );
    return { observed, dataLayerEvents: observed ? [{ event: signal.value }] : [] };
  }
  return { observed: false, dataLayerEvents: [] };
}

function analyticsUrlsSince(startedAt: string, startedAtPerformance: number): string[] {
  return [...new Set([
    ...recentFormRequests
      .filter((request) => Date.parse(request.observedAt) >= Date.parse(startedAt))
      .map((request) => request.url),
    ...recentAnalyticsRequests(startedAtPerformance).map((request) => request.url),
  ])];
}

function finishFormVerification(
  requestId: string,
  result: ConversationIntakeResult,
  startedAt: string,
  startedAtPerformance: number,
): void {
  const specification = confirmedFormSpecification(result);
  const target = result.target;
  const success = result.successSignal;
  if (!specification || !target || !success) return;
  const pageState = document.documentElement.dataset;
  const requestUrls = analyticsUrlsSince(startedAt, startedAtPerformance);
  const observedSuccess = observableSuccess(result);
  const outcomeObserved = pageState.outcomeObserved === "true" || observedSuccess.observed;
  const submissionResult = classifySubmissionResult(pageState.submissionResult);
  const provisionalVerdict: TrackingRunEvidenceV1["verdict"] = {
    code: "insufficient_observable_evidence",
    browserVerification: "inconclusive",
    platformConfirmation: "unverified",
    nextAction: "Await deterministic classification.",
  };
  const provisional = normalizeFormRunEvidence({
    runId: `run_form_${Date.now()}`,
    specificationId: specification.id,
    startedAt,
    transport: classifyTransport(pageState.transport),
    targetId: target.id,
    submitAttempted: true,
    submissionResult: submissionResult === "unknown" && outcomeObserved ? "success" : submissionResult,
    outcomeObserved,
    outcomeObservable: pageState.outcomeObservable !== "false",
    outcomeEvidenceType: success.type,
    dataLayerEvents: pageState.dataLayerEvent === "true"
      ? [{ event: "generate_lead", form_id: target.id, form_name: target.label.replaceAll(" ", "_") }]
      : observedSuccess.dataLayerEvents,
    tagFired: pageState.tagFired === "true"
      ? true
      : pageState.tagFired === "false"
        ? false
        : requestUrls.length > 0
          ? true
          : null,
    networkUrls: requestUrls,
    consent: classifyConsent(pageState.consent),
  }, provisionalVerdict);
  const verdict = determineFormVerdict(provisional.observations);
  const rows = evidencePaths.get(requestId);
  if (rows) {
    updateEvidenceStage(
      rows.browserRow,
      verdict.browserVerification === "passed" ? "passed" : "failed",
      verdict.browserVerification === "passed"
        ? "Browser request verified — one generate_lead request observed"
        : `${verdict.browserVerification === "inconclusive" ? "Inconclusive" : "Failed"} — ${verdict.nextAction}`,
    );
  }
  const platformCheckStarted = verdict.browserVerification === "passed"
    && ga4VerificationByRequest.has(requestId);
  if (verdict.browserVerification !== "passed" && ga4VerificationByRequest.delete(requestId) && rows) {
    ga4ConfirmationAttempts.delete(requestId);
    updateEvidenceStage(rows.platformRow, "failed", "Not checked because browser verification did not pass");
  }
  const verdictMessage = addMessage(
    `Verdict: ${verdict.code}\nBrowser verification: ${verdict.browserVerification}\nPlatform confirmation: ${platformCheckStarted ? "checking" : verdict.platformConfirmation}\nNext action: ${verdict.nextAction}`,
    "assistant",
  );
  formVerdictMessages.set(requestId, verdictMessage);
  addMessage(formExplanation(verdict, platformCheckStarted), "assistant").classList.add("explanation");
  window.requestAnimationFrame(() => verdictMessage.scrollIntoView({ block: "start" }));
  if (platformCheckStarted) void confirmGa4Platform(requestId);
  activeFormVerification = undefined;
}

function settleFormVerification(
  requestId: string,
  result: ConversationIntakeResult,
  startedAt: string,
  startedAtPerformance: number,
  deadline: number,
): void {
  const pageState = document.documentElement.dataset;
  const deterministicStateAvailable = pageState.submissionResult !== undefined
    || pageState.tagFired !== undefined;
  if (
    analyticsUrlsSince(startedAt, startedAtPerformance).length > 0
    || deterministicStateAvailable
    || performance.now() >= deadline
  ) {
    finishFormVerification(requestId, result, startedAt, startedAtPerformance);
    return;
  }
  window.setTimeout(
    () => settleFormVerification(requestId, result, startedAt, startedAtPerformance, deadline),
    250,
  );
}

function areaFor(element: Element): NavigationArea {
  if (element.closest("header")) return "header";
  if (element.closest("footer")) return "footer";
  if (element.closest("nav, [role='navigation']")) return "nav";
  return "unknown";
}

function selectorFor(anchor: HTMLAnchorElement, index: number): string {
  if (anchor.id) return `#${CSS.escape(anchor.id)}`;
  const area = anchor.closest("header, footer, nav, [role='navigation']");
  const prefix = area?.tagName.toLowerCase() ?? "body";
  const href = anchor.getAttribute("href");
  return href ? `${prefix} a[href="${CSS.escape(href)}"]` : `${prefix} a:nth-of-type(${index + 1})`;
}

function stableId(selector: string, href: string): string {
  let hash = 2166136261;
  for (const character of `${selector}\u0000${href}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `nav_${(hash >>> 0).toString(16)}`;
}

function scanNavigation(): ScanResponse {
  const candidates = [...document.querySelectorAll<HTMLAnchorElement>("header a[href], nav a[href], [role='navigation'] a[href], footer a[href]")];
  const seen = new Set<string>();
  const navigation: NavigationElement[] = [];
  candidates.forEach((anchor, index) => {
    if (!anchor.href || anchor.hidden || anchor.getAttribute("aria-hidden") === "true") return;
    const selector = selectorFor(anchor, index);
    const key = `${selector}\u0000${anchor.href}`;
    if (seen.has(key)) return;
    seen.add(key);
    navigation.push({
      id: stableId(selector, anchor.href),
      text: (anchor.innerText || anchor.getAttribute("aria-label") || "Untitled link").replace(/\s+/g, " ").trim(),
      href: anchor.href,
      area: areaFor(anchor),
      selector,
    });
  });
  return { pageUrl: location.href, title: document.title, navigation };
}

function adjacentFormSuccessSignal(form: HTMLFormElement): FormCandidate["successSignals"][number] | undefined {
  const region = form.closest<HTMLElement>(
    'section, article, [role="region"][aria-label], [role="region"][aria-labelledby]',
  );
  if (!region) return undefined;
  const candidates = [...new Set(region.querySelectorAll<HTMLElement>(
    '[role="status"][id], [aria-live]:not([aria-live="off"])[id]',
  ))].filter((element) => element.id.trim().length > 0);
  if (candidates.length !== 1) return undefined;
  const candidate = candidates[0]!;
  return {
    id: "success-message",
    label: candidate.getAttribute("aria-label")?.trim() || "Success message",
    type: "visible_element",
    value: `#${CSS.escape(candidate.id)}`,
  };
}

function scanForms(): FormCandidate[] {
  return [...document.querySelectorAll<HTMLFormElement>("form")].map((form, index) => {
    const id = form.id || form.getAttribute("name") || `form_${index + 1}`;
    const label = form.getAttribute("aria-label")
      || form.querySelector("legend")?.textContent?.trim()
      || form.getAttribute("name")
      || id;
    const selector = form.id
      ? `form#${CSS.escape(form.id)}`
      : form.getAttribute("name")
        ? `form[name="${CSS.escape(form.getAttribute("name")!)}"]`
        : `form:nth-of-type(${index + 1})`;
    const successSignals: FormCandidate["successSignals"] = [];
    if (form.dataset.successSelector) {
      successSignals.push({ id: "success-message", label: "Success message", type: "visible_element", value: form.dataset.successSelector });
    }
    if (form.dataset.successUrl) {
      successSignals.push({ id: "thank-you-url", label: "Thank-you URL", type: "thank_you_url", value: form.dataset.successUrl });
    }
    if (successSignals.length === 0) {
      const adjacent = adjacentFormSuccessSignal(form);
      if (adjacent) successSignals.push(adjacent);
    }
    return { id, label, selector, pageUrl: location.href, successSignals };
  });
}

function inspectGtmRuntime() {
  try {
    return observeGtmRuntime({
      inspectionAvailable: true,
      scriptUrls: [...document.scripts].map((script) => script.src).filter(Boolean),
    });
  } catch {
    return observeGtmRuntime({ inspectionAvailable: false, scriptUrls: [] });
  }
}

async function requestGtmContainer(
  operation: "inspect" | "prepare",
  publicId: string,
): Promise<GtmBridgeResponse> {
  return chrome.runtime.sendMessage({
    type: "GTM_CONTAINER_REQUEST",
    operation,
    publicId,
  }) as Promise<GtmBridgeResponse>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedText(value: unknown, maximum = 256): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function parseConnectionStatus(value: unknown): GtmConnectionStatus | undefined {
  if (!isRecord(value)
    || typeof value.configured !== "boolean"
    || typeof value.connected !== "boolean"
    || (value.scope !== "read-only" && value.scope !== "container-edit")
    || typeof value.containerWritesEnabled !== "boolean"
    || typeof value.publicationScopeRequested !== "boolean"
    || typeof value.publicationEnabled !== "boolean"
    || typeof value.tokenPersistenceEnabled !== "boolean"
    || typeof value.analyticsReadEnabled !== "boolean") return undefined;
  if (value.containerWritesEnabled !== (value.scope === "container-edit")) return undefined;
  if (value.publicationEnabled && (!value.publicationScopeRequested || !value.containerWritesEnabled)) return undefined;
  return {
    configured: value.configured,
    connected: value.connected,
    scope: value.scope,
    containerWritesEnabled: value.containerWritesEnabled,
    publicationScopeRequested: value.publicationScopeRequested,
    publicationEnabled: value.publicationEnabled,
    tokenPersistenceEnabled: value.tokenPersistenceEnabled,
    analyticsReadEnabled: value.analyticsReadEnabled,
  };
}

function parseConnectionResult(value: unknown, publicId: string): GtmContainerResult | undefined {
  if (!isRecord(value) || value.publicId !== publicId) return undefined;
  if (value.status === "not_accessible") return { status: value.status, publicId };
  if (value.status === "ambiguous") {
    if (!Number.isInteger(value.matchCount) || (value.matchCount as number) < 2) return undefined;
    return { status: value.status, publicId, matchCount: value.matchCount as number };
  }
  if (value.status !== "recognized" || !isRecord(value.account) || !isRecord(value.container)) return undefined;
  const measurementIds = value.measurementIds;
  if (!isBoundedText(value.account.accountId, 64)
    || !isBoundedText(value.account.name)
    || !isBoundedText(value.container.accountId, 64)
    || !isBoundedText(value.container.containerId, 64)
    || !isBoundedText(value.container.name)
    || value.container.publicId !== publicId
    || value.container.accountId !== value.account.accountId
    || !Array.isArray(measurementIds)
    || measurementIds.length > 32
    || measurementIds.some((item) => typeof item !== "string" || !/^G-[A-Z0-9]+$/.test(item))
    || new Set(measurementIds).size !== measurementIds.length
    || [...measurementIds].sort().some((item, index) => item !== measurementIds[index])) return undefined;
  return {
    status: value.status,
    publicId,
    account: { accountId: value.account.accountId, name: value.account.name },
    container: {
      accountId: value.container.accountId,
      containerId: value.container.containerId,
      name: value.container.name,
      publicId,
    },
    measurementIds,
  };
}

function parseConnectionContext(value: unknown, observedContainerIds: string[]): GtmConnectionContext | undefined {
  if (!isRecord(value) || value.ok !== true || !Array.isArray(value.containerIds)) return undefined;
  const containerIds = value.containerIds;
  if (containerIds.length !== observedContainerIds.length
    || containerIds.some((item, index) => item !== observedContainerIds[index])) return undefined;
  const status = parseConnectionStatus(value.status);
  if (!status) return undefined;
  if (value.recognitionError !== undefined && value.recognitionError !== "recognition_unavailable") return undefined;
  if (containerIds.length !== 1 || !status.configured || !status.connected) {
    return { status, containerIds };
  }
  if (value.recognitionError === "recognition_unavailable") {
    return { status, containerIds, recognitionError: value.recognitionError };
  }
  if (!isRecord(value.recognition)) return undefined;
  const result = parseConnectionResult(value.recognition.result, containerIds[0]!);
  if (!result || typeof value.recognition.containerWritesEnabled !== "boolean"
    || value.recognition.containerWritesEnabled !== status.containerWritesEnabled) return undefined;
  return { status, containerIds, result };
}

function parseAnalyticsResource(
  value: unknown,
  idKey: "propertyId" | "streamId",
): { id: string; name: string } | undefined {
  if (!isRecord(value) || !isBoundedText(value[idKey], 64) || !/^\d+$/.test(value[idKey])
    || !isBoundedText(value.name)) return undefined;
  return { id: value[idKey], name: value.name };
}

function parseGa4Started(value: unknown): Ga4VerificationStarted | undefined {
  if (!isRecord(value) || value.status !== "started"
    || !isBoundedText(value.verificationId, 128) || !/^[A-Za-z0-9_-]+$/.test(value.verificationId)
    || typeof value.measurementId !== "string" || !/^G-[A-Z0-9]+$/.test(value.measurementId)
    || typeof value.eventName !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(value.eventName)
    || !Number.isSafeInteger(value.baselineEventCount) || (value.baselineEventCount as number) < 0) return undefined;
  const property = parseAnalyticsResource(value.property, "propertyId");
  const stream = parseAnalyticsResource(value.stream, "streamId");
  if (!property || !stream) return undefined;
  return {
    status: value.status,
    verificationId: value.verificationId,
    measurementId: value.measurementId,
    eventName: value.eventName,
    baselineEventCount: value.baselineEventCount as number,
    property: { propertyId: property.id, name: property.name },
    stream: { streamId: stream.id, name: stream.name },
  };
}

function parseGa4Confirmation(value: unknown): Ga4VerificationConfirmation | undefined {
  if (!isRecord(value) || (value.status !== "pending" && value.status !== "confirmed")
    || !isBoundedText(value.verificationId, 128) || !/^[A-Za-z0-9_-]+$/.test(value.verificationId)
    || !Number.isSafeInteger(value.baselineEventCount) || (value.baselineEventCount as number) < 0
    || !Number.isSafeInteger(value.currentEventCount) || (value.currentEventCount as number) < 0
    || value.correlation !== "aggregate_realtime_count_increase") return undefined;
  const property = parseAnalyticsResource(value.property, "propertyId");
  const stream = parseAnalyticsResource(value.stream, "streamId");
  if (!property || !stream) return undefined;
  if (value.status === "confirmed" && (value.currentEventCount as number) <= (value.baselineEventCount as number)) {
    return undefined;
  }
  return {
    status: value.status,
    verificationId: value.verificationId,
    baselineEventCount: value.baselineEventCount as number,
    currentEventCount: value.currentEventCount as number,
    property: { propertyId: property.id, name: property.name },
    stream: { streamId: stream.id, name: stream.name },
    correlation: value.correlation,
  };
}

async function requestGa4Verification(message: Record<string, unknown>): Promise<{
  ok: boolean;
  error?: string;
  result?: unknown;
}> {
  try {
    const response: unknown = await chrome.runtime.sendMessage({ type: "GA4_VERIFICATION_REQUEST", ...message });
    if (!isRecord(response) || typeof response.ok !== "boolean") return { ok: false, error: "invalid_response" };
    const safeErrors = new Set([
      "analytics_disabled",
      "analytics_provider_forbidden",
      "measurement_not_accessible",
      "measurement_ambiguous",
      "verification_expired",
      "analytics_unavailable",
      "service_offline",
    ]);
    return response.ok
      ? { ok: true, result: response.result }
      : { ok: false, error: typeof response.error === "string" && safeErrors.has(response.error) ? response.error : "invalid_response" };
  } catch {
    return { ok: false, error: "service_offline" };
  }
}

function effectiveAccess(status: GtmConnectionStatus): string {
  if (status.publicationEnabled) return "Publish enabled";
  if (status.containerWritesEnabled) return "Edit access";
  return "Read-only";
}

function accessExplanation(status: GtmConnectionStatus): string {
  if (status.publicationEnabled) return "This backend can edit and publish. Publication still requires an explicit user action.";
  if (status.containerWritesEnabled) return "This backend can edit a GTM workspace. Publishing is off.";
  return "This backend can inspect GTM. Editing and publishing are off.";
}

function appendConnectionRow(parent: HTMLElement, label: string, value: string): void {
  const row = document.createElement("div");
  row.className = "gtm-context-row";
  const term = document.createElement("span");
  term.textContent = label;
  const detail = document.createElement("strong");
  detail.textContent = value;
  row.append(term, detail);
  parent.append(row);
}

function renderGtmConnection(view: GtmConnectionView): void {
  if (!gtmConnectionCard) return;
  gtmConnectionCard.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "gtm-context-heading";
  const title = document.createElement("strong");
  title.textContent = "GTM connection";
  const controls = document.createElement("span");
  controls.className = "gtm-context-controls";
  const badge = document.createElement("span");
  badge.className = "gtm-context-badge";
  const refresh = document.createElement("button");
  refresh.className = "gtm-context-refresh";
  refresh.type = "button";
  refresh.setAttribute("aria-label", "Refresh GTM connection");
  refresh.textContent = "↻";
  refresh.addEventListener("click", () => void loadGtmConnectionContext(true));
  controls.append(badge, refresh);
  heading.append(title, controls);
  const body = document.createElement("div");
  body.className = "gtm-context-body";
  const summary = document.createElement("p");
  const note = document.createElement("small");

  if (view.kind === "loading") {
    badge.textContent = "Checking";
    summary.textContent = "Checking authorized GTM access…";
  } else if (view.kind === "offline") {
    badge.textContent = "Service offline";
    badge.classList.add("warning");
    summary.textContent = "The local GTM service is offline.";
    note.textContent = "Chat remains available, but account and container access cannot be proven.";
  } else if (view.kind === "check_failed") {
    badge.textContent = "Check failed";
    badge.classList.add("warning");
    summary.textContent = "GTM access could not be safely verified.";
    note.textContent = "No account or container was assumed. Refresh after checking the local service.";
  } else if (view.kind === "unconfigured") {
    badge.textContent = "Not configured";
    badge.classList.add("warning");
    summary.textContent = "Google OAuth is not configured";
    if (view.containerIds.length > 0) appendConnectionRow(body, "Page", view.containerIds.join(" · "));
    note.textContent = view.containerIds.length > 0
      ? "The page ID is observable, but it does not prove GTM access."
      : "No GTM container was detected on this page, and API access is unavailable.";
  } else if (view.kind === "disconnected") {
    badge.textContent = "Connect Google";
    badge.classList.add("warning");
    summary.textContent = "Google authorization required";
    if (view.containerIds.length > 0) appendConnectionRow(body, "Page", view.containerIds.join(" · "));
    note.textContent = "Browser Google login and this app’s GTM authorization are separate.";
  } else if (view.kind === "no_container") {
    badge.textContent = effectiveAccess(view.status);
    summary.textContent = "GTM API authorization connected";
    appendConnectionRow(body, "Page", "No GTM container detected on this page");
    note.textContent = accessExplanation(view.status);
  } else if (view.kind === "multiple_containers") {
    badge.textContent = "Multiple page containers";
    badge.classList.add("warning");
    summary.textContent = "GTM API authorization connected";
    appendConnectionRow(body, "Page", view.containerIds.join(" · "));
    note.textContent = "No account or container was selected because the page exposes multiple GTM IDs.";
  } else if (view.kind === "recognition_failed") {
    badge.textContent = "Check failed";
    badge.classList.add("warning");
    summary.textContent = "GTM API authorization connected";
    appendConnectionRow(body, "Page", view.publicId);
    note.textContent = "The container access check was unavailable. No account or container was assumed.";
  } else if (view.kind === "not_accessible") {
    badge.textContent = "Not accessible";
    badge.classList.add("warning");
    summary.textContent = "GTM API authorization connected";
    appendConnectionRow(body, "Page", view.publicId);
    note.textContent = "This GTM ID was not found in the containers accessible to the authorized account.";
  } else if (view.kind === "ambiguous") {
    badge.textContent = "Ambiguous match";
    badge.classList.add("warning");
    summary.textContent = "GTM API authorization connected";
    appendConnectionRow(body, "Page", view.publicId);
    note.textContent = `${view.matchCount} accessible containers matched. None was selected.`;
  } else {
    badge.textContent = effectiveAccess(view.status);
    summary.textContent = "GTM API authorization connected";
    appendConnectionRow(body, "Page", view.publicId);
    appendConnectionRow(body, "Account", view.account.name);
    appendConnectionRow(body, "Container", view.container.name);
    appendConnectionRow(
      body,
      "GA4",
      view.measurementIds.length > 0 ? view.measurementIds.join(" · ") : "No live destination found",
    );
    note.textContent = `${accessExplanation(view.status)} Analytics reads are ${view.status.analyticsReadEnabled ? "enabled" : "off"}.`;
  }

  body.prepend(summary);
  if (note.textContent) body.append(note);
  gtmConnectionCard.append(heading, body);
}

async function loadGtmConnectionContext(force = false): Promise<void> {
  if (gtmConnectionLoaded && !force) return;
  const requestSequence = ++gtmConnectionRequestSequence;
  recognizedGtmContext = undefined;
  renderGtmConnection({ kind: "loading" });
  const runtime = inspectGtmRuntime();
  const containerIds = runtime.status === "detected" ? runtime.containerIds : [];
  let raw: unknown;
  try {
    raw = await chrome.runtime.sendMessage({ type: "GTM_CONNECTION_CONTEXT_REQUEST", containerIds });
  } catch {
    if (requestSequence !== gtmConnectionRequestSequence) return;
    gtmConnectionLoaded = true;
    renderGtmConnection({ kind: "offline" });
    return;
  }
  if (requestSequence !== gtmConnectionRequestSequence) return;
  gtmConnectionLoaded = true;
  if (isRecord(raw) && raw.ok === false && raw.error === "service_offline") {
    renderGtmConnection({ kind: "offline" });
    return;
  }
  const context = parseConnectionContext(raw, containerIds);
  if (!context) {
    renderGtmConnection({ kind: "check_failed" });
    return;
  }
  if (!context.status.configured) {
    renderGtmConnection({ kind: "unconfigured", containerIds });
    return;
  }
  if (!context.status.connected) {
    renderGtmConnection({ kind: "disconnected", containerIds });
    return;
  }
  if (containerIds.length === 0) {
    renderGtmConnection({ kind: "no_container", status: context.status });
    return;
  }
  if (containerIds.length > 1) {
    renderGtmConnection({ kind: "multiple_containers", status: context.status, containerIds });
    return;
  }
  if (context.recognitionError) {
    renderGtmConnection({ kind: "recognition_failed", status: context.status, publicId: containerIds[0]! });
    return;
  }
  if (context.result?.status === "not_accessible") {
    renderGtmConnection({ kind: "not_accessible", status: context.status, publicId: context.result.publicId });
    return;
  }
  if (context.result?.status === "ambiguous") {
    renderGtmConnection({
      kind: "ambiguous",
      status: context.status,
      publicId: context.result.publicId,
      matchCount: context.result.matchCount!,
    });
    return;
  }
  if (context.result?.status === "recognized" && context.result.account && context.result.container) {
    const view: Extract<GtmConnectionView, { kind: "recognized" }> = {
      kind: "recognized",
      status: context.status,
      publicId: context.result.publicId,
      account: context.result.account,
      container: context.result.container,
      measurementIds: context.result.measurementIds ?? [],
    };
    recognizedGtmContext = view;
    renderGtmConnection(view);
    return;
  }
  renderGtmConnection({ kind: "check_failed" });
}

function updateEvidenceStage(
  row: HTMLElement,
  state: "passed" | "pending" | "failed",
  detail: string,
): void {
  row.classList.toggle("passed", state === "passed");
  row.classList.toggle("pending", state === "pending");
  row.classList.toggle("failed", state === "failed");
  const icon = row.querySelector("i");
  const copy = row.querySelector("small");
  if (icon) icon.textContent = state === "passed" ? "✓" : state === "failed" ? "×" : "○";
  if (copy) copy.textContent = detail;
}

function workspaceResultDetail(result: GtmContainerResult): string {
  const workspace = result.workspace;
  if (!workspace) return "Container matched; workspace state unavailable";
  if (workspace.status === "available" && workspace.action === "reuse") {
    return `${workspace.workspace?.name ?? "Managed workspace"} is ready to reuse (${workspace.workspaceCount}/3 slots occupied)`;
  }
  if (workspace.status === "available") {
    return `Managed workspace can be prepared (${workspace.workspaceCount}/3 slots occupied)`;
  }
  if (workspace.status === "created") {
    return `${workspace.workspace?.name ?? "Managed workspace"} prepared (${workspace.workspaceCount}/3 slots occupied)`;
  }
  if (workspace.status === "reused") {
    return `${workspace.workspace?.name ?? "Managed workspace"} synchronized and reused`;
  }
  if (workspace.status === "capacity_blocked") {
    return `All ${workspace.workspaceCount} workspace slots are occupied; planning remains available`;
  }
  if (workspace.status === "sync_conflict") {
    return "Managed workspace has synchronization conflicts and was preserved for review";
  }
  return "Multiple managed ownership markers found; no workspace was changed";
}

function appendGtmAction(
  parent: HTMLElement,
  label: string,
  action: () => void,
): HTMLButtonElement {
  parent.querySelector(".gtm-action")?.remove();
  const button = document.createElement("button");
  button.className = "quick gtm-action";
  button.textContent = label;
  button.addEventListener("click", () => {
    button.remove();
    action();
  }, { once: true });
  parent.append(button);
  return button;
}

function navigationTargets(navigation: NavigationElement[]): PageTarget[] {
  return navigation.map((item) => ({ id: item.id, label: item.text, selector: item.selector }));
}

function formTargets(forms: FormCandidate[]): PageTarget[] {
  return forms.map((item) => ({ id: item.id, label: item.label, selector: item.selector }));
}

function recentAnalyticsRequests(since: number): BrowserEvidence["requests"] {
  return performance.getEntriesByType("resource")
    .filter((entry) => entry.startTime >= since && analyticsPattern.test(entry.name))
    .map((entry) => ({ url: entry.name, observedAt: new Date().toISOString() }));
}

function persistPreferences(): void {
  void chrome.storage.local.set({ overlayPreferences: preferences });
}

function applyPreferences(): void {
  if (!frame) return;
  frame.style.width = `${preferences.width}px`;
  frame.style.height = `${preferences.height}px`;
  frame.style.left = preferences.x === undefined ? "auto" : `${preferences.x}px`;
  frame.style.top = preferences.y === undefined ? "auto" : `${preferences.y}px`;
  frame.style.right = preferences.x === undefined ? "22px" : "auto";
  frame.style.bottom = preferences.y === undefined ? "22px" : "auto";
  frame.classList.toggle("collapsed", preferences.collapsed);
}

function setCollapsed(collapsed: boolean): void {
  preferences.collapsed = collapsed;
  if (!collapsed && !gtmConnectionLoaded) preferences.height = Math.max(preferences.height, 380);
  applyPreferences();
  persistPreferences();
  if (!collapsed) {
    void loadGtmConnectionContext();
    composer?.focus();
  }
}

function addMessage(copy: string, role: "assistant" | "user", id?: string): HTMLElement {
  const message = document.createElement("div");
  message.className = `message ${role === "assistant" ? "bot" : "user"}`;
  if (id) message.classList.add("streaming");
  message.textContent = copy;
  responseList?.append(message);
  responseList?.scrollTo({ top: responseList.scrollHeight });
  if (id) responseNodes.set(id, message);
  return message;
}

function updateTargetHighlights(): void {
  const shadow = targetHost?.shadowRoot;
  if (!shadow) return;
  shadow.querySelectorAll(".target").forEach((node) => node.remove());
  highlightedTargets.forEach((item, index) => {
    const element = document.querySelector<HTMLElement>(item.selector);
    if (!element || element.getBoundingClientRect().width === 0) return;
    const bounds = element.getBoundingClientRect();
    const marker = document.createElement("div");
    marker.className = `target ${highlightTone}`;
    marker.style.left = `${Math.max(2, bounds.left - 4)}px`;
    marker.style.top = `${Math.max(2, bounds.top - 4)}px`;
    marker.style.width = `${bounds.width + 8}px`;
    marker.style.height = `${bounds.height + 8}px`;
    marker.dataset.targetId = item.id;
    const label = document.createElement("span");
    label.textContent = `${highlightTone === "confirmed" ? "✓" : index + 1} ${item.label}`;
    marker.append(label);
    shadow.append(marker);
  });
}

function highlightTargets(targets: PageTarget[], tone: "candidate" | "confirmed"): void {
  highlightedTargets = targets;
  highlightTone = tone;
  if (!targetHost) {
    targetHost = document.createElement("div");
    targetHost.id = "gtm-observability-targets";
    const shadow = targetHost.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      :host { all: initial; pointer-events: none; }
      .target { position: fixed; z-index: 2147483646; box-sizing: border-box; border: 2px solid #f6c768; border-radius: 9px; background: rgba(246,199,104,.08); box-shadow: 0 0 0 3px rgba(246,199,104,.13), 0 8px 24px rgba(0,0,0,.16); transition: inset .12s ease, border-color .18s ease, background .18s ease; }
      .target.confirmed { border-color: #8de8bd; background: rgba(141,232,189,.1); box-shadow: 0 0 0 3px rgba(141,232,189,.14), 0 8px 24px rgba(0,0,0,.16); }
      .target span { position: absolute; left: -2px; bottom: calc(100% + 5px); max-width: 220px; padding: 4px 7px; overflow: hidden; border-radius: 7px; color: #201806; background: #f6c768; box-shadow: 0 5px 16px rgba(0,0,0,.2); font: 600 11px/1.2 Inter, ui-sans-serif, system-ui, sans-serif; text-overflow: ellipsis; white-space: nowrap; }
      .target.confirmed span { color: #092419; background: #8de8bd; }
    </style>`;
    document.documentElement.append(targetHost);
    window.addEventListener("scroll", updateTargetHighlights, { passive: true });
    window.addEventListener("resize", updateTargetHighlights, { passive: true });
  }
  updateTargetHighlights();
}

function clearTargetHighlights(): void {
  highlightedTargets = [];
  targetHost?.shadowRoot?.querySelectorAll(".target").forEach((node) => node.remove());
}

function renderEvidencePath(context: EvidencePathContext, requestId?: string): void {
  const path = document.createElement("section");
  path.className = "evidence-path";
  path.setAttribute("aria-label", "Tracking evidence path");
  const runtime = inspectGtmRuntime();
  const runtimeDetail = runtime.status === "detected"
    ? `Detected ${runtime.containerIds.join(", ")}`
    : runtime.status === "not_detected"
      ? "No GTM container detected on this page"
      : runtime.reason;
  const stages = [
    { state: "passed", label: "Intent understood", detail: context.intentDetail },
    { state: "passed", label: "Page inspected", detail: context.inspectedDetail },
    { state: "passed", label: "Targets confirmed", detail: context.confirmedDetail },
    { state: context.setupGenerated ? "passed" : "pending", label: "Setup generation", detail: context.setupDetail },
    { state: runtime.status === "detected" ? "passed" : "pending", label: "GTM runtime", detail: runtimeDetail },
    { state: "pending", label: "GTM access", detail: runtime.status === "detected" ? "Observed container has not been matched to Google access" : "Requires an observed container" },
    { state: "pending", label: "Browser verification", detail: "Ready for a guided browser run" },
    {
      state: "pending",
      label: "Platform confirmation",
      detail: recognizedGtmContext?.status.analyticsReadEnabled
        ? "Starts with a pre-run GA4 Realtime baseline"
        : "Analytics reads are not enabled on this backend",
    },
  ];
  const heading = document.createElement("div");
  heading.className = "evidence-heading";
  heading.innerHTML = `<span>Evidence path</span><small>What the assistant used</small>`;
  path.append(heading);
  let accessRow: HTMLElement | undefined;
  let browserRow: HTMLElement | undefined;
  let platformRow: HTMLElement | undefined;
  for (const stage of stages) {
    const row = document.createElement("div");
    row.className = `evidence-stage ${stage.state}`;
    const icon = document.createElement("i");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = stage.state === "passed" ? "✓" : "○";
    const copy = document.createElement("span");
    const label = document.createElement("strong");
    label.textContent = stage.label;
    const detail = document.createElement("small");
    detail.textContent = stage.detail;
    copy.append(label, detail);
    row.append(icon, copy);
    path.append(row);
    if (stage.label === "GTM access") accessRow = row;
    if (stage.label === "Browser verification") browserRow = row;
    if (stage.label === "Platform confirmation") platformRow = row;
  }
  const connected = recognizedGtmContext;
  if (runtime.status === "detected" && runtime.containerIds.length === 1 && accessRow
    && connected && connected.publicId === runtime.containerIds[0]) {
    const measurement = connected.measurementIds.length === 1
      ? ` · ${connected.measurementIds[0]}`
      : connected.measurementIds.length > 1
        ? " · multiple GA4 destinations"
        : " · no GA4 destination";
    updateEvidenceStage(
      accessRow,
      "passed",
      `${connected.account.name} → ${connected.container.name}${measurement}`,
    );
  } else if (runtime.status === "detected" && runtime.containerIds.length === 1 && accessRow) {
    const publicId = runtime.containerIds[0]!;
    const inspectAccess = (): void => {
      const action = path.querySelector<HTMLButtonElement>(".gtm-action");
      if (action) action.disabled = true;
      updateEvidenceStage(accessRow!, "pending", `Matching ${publicId} to connected Google access…`);
      void requestGtmContainer("inspect", publicId).then((response) => {
        if (!response.ok || !response.result) {
          updateEvidenceStage(accessRow!, "pending", response.error ?? "GTM access could not be checked");
          appendGtmAction(path, "Try GTM access again", inspectAccess);
          return;
        }
        const result = response.result;
        if (result.status === "not_accessible") {
          updateEvidenceStage(accessRow!, "pending", `${publicId} is not accessible through the connected Google account`);
          return;
        }
        if (result.status === "ambiguous") {
          updateEvidenceStage(accessRow!, "pending", `${publicId} matched ${result.matchCount ?? "multiple"} accessible containers; nothing was selected`);
          return;
        }
        updateEvidenceStage(
          accessRow!,
          "passed",
          `Recognized ${result.container?.name ?? result.publicId}. ${workspaceResultDetail(result)}`,
        );
        const canPrepare = result.workspace?.status === "available";
        if (canPrepare && response.containerWritesEnabled) {
          appendGtmAction(path, "Prepare managed workspace", () => {
            updateEvidenceStage(accessRow!, "pending", `Rechecking ${publicId} capacity and ownership…`);
            void requestGtmContainer("prepare", publicId).then((prepared) => {
              if (!prepared.ok || !prepared.result) {
                updateEvidenceStage(accessRow!, "pending", prepared.error ?? "Managed workspace could not be prepared");
                return;
              }
              updateEvidenceStage(
                accessRow!,
                prepared.result.status === "recognized" ? "passed" : "pending",
                prepared.result.status === "recognized"
                  ? `Recognized ${prepared.result.container?.name ?? prepared.result.publicId}. ${workspaceResultDetail(prepared.result)}`
                  : `${publicId} is no longer uniquely accessible; nothing was changed`,
              );
            });
          });
        } else if (canPrepare) {
          const note = document.createElement("small");
          note.className = "gtm-write-note";
          note.textContent = "Workspace preparation is disabled; planning and downloads remain available.";
          path.append(note);
        }
      });
    };
    appendGtmAction(path, "Check GTM access", inspectAccess);
  } else if (runtime.status === "detected" && runtime.containerIds.length > 1 && accessRow) {
    updateEvidenceStage(accessRow, "pending", "Multiple GTM containers were observed; choose one before checking Google access");
  }
  responseList?.append(path);
  if (requestId && browserRow && platformRow) evidencePaths.set(requestId, { browserRow, platformRow });
  preferences.height = Math.max(preferences.height, 520);
  applyPreferences();
  persistPreferences();
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

function confirmNavigation(navigation: NavigationElement[]): void {
  highlightTargets(navigationTargets(navigation), "confirmed");
  addMessage(`${navigation.length} navigation link${navigation.length === 1 ? "" : "s"} selected and highlighted on the page.`, "assistant");
  const proposal = navigationSetupProposal(navigation);
  renderEvidencePath({
    intentDetail: "Navigation clicks → navigation_click",
    inspectedDetail: `${navigation.length} matching link${navigation.length === 1 ? "" : "s"} found`,
    confirmedDetail: `${navigation.length} highlighted on this page`,
    setupGenerated: proposal !== undefined,
    setupDetail: proposal
      ? "Reviewable navigation_click setup generated"
      : "Connect a GTM container and GA4 measurement ID to generate setup",
  });
  if (proposal) renderNavigationSetupDownload(proposal);
}

function renderNavigationSetupDownload(proposal: SetupProposal): void {
  const row = document.createElement("div");
  row.className = "quick-actions";
  const download = document.createElement("a");
  download.className = "quick";
  download.textContent = "Download GTM setup";
  download.href = containerFileDownloadHref(proposal.containerFile);
  download.download = "gtm-observability-navigation-click.json";
  download.setAttribute("role", "button");
  download.addEventListener("click", () => {
    row.remove();
    addMessage("Downloaded the generated navigation_click setup. Nothing was applied or published.", "assistant");
  }, { once: true });
  row.append(download);
  responseList?.append(row);
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

function renderNavigationPicker(navigation: NavigationElement[]): void {
  highlightTargets(navigationTargets(navigation), "candidate");
  const picker = document.createElement("div");
  picker.className = "picker";
  for (const item of navigation) {
    const label = document.createElement("label");
    label.className = "pick";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.dataset.navigationId = item.id;
    input.addEventListener("change", () => {
      const selectedIds = new Set([...picker.querySelectorAll<HTMLInputElement>("input:checked")].map((node) => node.dataset.navigationId));
      highlightTargets(navigationTargets(navigation.filter((candidate) => selectedIds.has(candidate.id))), "candidate");
    });
    const copy = document.createElement("span");
    copy.textContent = item.text;
    const area = document.createElement("small");
    area.textContent = item.area;
    label.append(input, copy, area);
    picker.append(label);
  }
  const confirm = document.createElement("button");
  confirm.className = "quick primary-quick";
  confirm.textContent = "Confirm selection";
  confirm.addEventListener("click", () => {
    const selectedIds = new Set([...picker.querySelectorAll<HTMLInputElement>("input:checked")].map((node) => node.dataset.navigationId));
    const selected = navigation.filter((item) => selectedIds.has(item.id));
    if (!selected.length) { addMessage("Choose at least one link.", "assistant"); return; }
    picker.remove();
    confirmNavigation(selected);
  });
  picker.append(confirm);
  responseList?.append(picker);
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

function intakeResponse(result: ConversationIntakeResult): string {
  switch (result.state) {
    case "awaiting_target": return `I found ${result.options.length} forms. Which one represents the outcome you want to measure?`;
    case "awaiting_success_evidence": return `What proves ${result.target?.label ?? "the form"} succeeded?`;
    case "draft_ready": return `I'll treat a successful ${result.target?.label ?? "form"} submission as generate_lead. A submit attempt or validation error will not count.`;
    case "insufficient_evidence": return "I found the form, but I cannot safely observe what proves it succeeded. This needs a diagnostic handoff.";
    case "unsupported": return `I understand that as ${result.interaction.replaceAll("_", " ")} tracking. That tracking type is not implemented in this build yet.`;
    default: return "What kind of interaction should I track? Try navigation, form, phone, or email.";
  }
}

function renderIntakeStep(requestId: string, result: ConversationIntakeResult): void {
  intakeByRequest.set(requestId, result);
  addMessage(intakeResponse(result), "assistant");
  renderQuickActions(requestId, result.options);
}

function renderFormDraft(requestId: string, result: ConversationIntakeResult): void {
  const target = result.target;
  const success = result.successSignal;
  if (!target || !success) return;
  addMessage(`Draft specification\nInteraction: successful ${target.label} submission\nOutcome: qualified inquiry\nEvent: generate_lead\nSuccess evidence: ${success.label}`, "assistant");
  renderQuickActions(requestId, [{ id: "confirm-form-specification", label: "Confirm setup" }]);
}

function handleAssistantAction(actionId: string, requestId: string): void {
  if (actionId.startsWith("prompt:")) {
    if (composer) composer.value = actionId.slice("prompt:".length);
    submitPrompt();
    return;
  }
  if (actionId === "track-all-navigation") {
    confirmNavigation(navigationByRequest.get(requestId) ?? []);
    return;
  }
  if (actionId === "choose-navigation") {
    renderNavigationPicker(navigationByRequest.get(requestId) ?? []);
    return;
  }
  const intake = intakeByRequest.get(requestId);
  const forms = formsByRequest.get(requestId) ?? [];
  if (actionId.startsWith("target:") && intake) {
    const target = forms.find((form) => form.id === actionId.slice("target:".length));
    if (target) {
      highlightTargets(formTargets([target]), "confirmed");
      renderIntakeStep(requestId, selectConversationTarget(intake, target));
    }
    return;
  }
  if (actionId.startsWith("success:") && intake?.target) {
    const success = intake.target.successSignals.find((signal) => signal.id === actionId.slice("success:".length));
    if (success) renderIntakeStep(requestId, selectConversationSuccess(intake, intake.target, success));
    return;
  }
  if (actionId === "confirm-specification" && intake?.canConfirm) {
    renderFormDraft(requestId, intake);
    return;
  }
  if (actionId === "confirm-form-specification" && intake?.canConfirm) {
    addMessage("Form tracking specification confirmed.", "assistant");
    const proposal = formSetupProposal(intake);
    renderEvidencePath({
      intentDetail: `Successful ${intake.target?.label ?? "form"} submission → generate_lead`,
      inspectedDetail: `${forms.length} form${forms.length === 1 ? "" : "s"} found`,
      confirmedDetail: `${intake.target?.label ?? "Selected form"} highlighted on this page`,
      setupGenerated: proposal !== undefined,
      setupDetail: proposal
        ? "Reviewable generate_lead setup generated"
        : "Connect a GTM container and GA4 measurement ID to generate setup",
    }, requestId);
    renderQuickActions(requestId, [
      { id: "download-form-setup", label: "Download GTM setup" },
      { id: "start-form-verification", label: "Start verification" },
    ]);
    return;
  }
  if (actionId === "download-form-setup" && intake?.canConfirm) {
    if (!formSetupDownloadHref(intake)) {
      addMessage("Connect a GTM container and GA4 measurement ID before generating setup.", "assistant");
      return;
    }
    addMessage("Downloaded a reviewable GTM container import. Import with Merge into a new workspace; nothing was published.", "assistant");
    renderQuickActions(requestId, [{ id: "start-form-verification", label: "Start verification" }]);
    return;
  }
  if (actionId === "start-form-verification" && intake?.canConfirm) {
    void prepareFormVerification(requestId, intake);
    return;
  }
  if (actionId === "cancel") { clearTargetHighlights(); addMessage("Okay — nothing was selected.", "assistant"); }
}

function renderQuickActions(
  requestId: string,
  actions: Array<{ id: string; label: string }>,
): void {
  if (!actions.length) return;
  const row = document.createElement("div");
  row.className = "quick-actions";
  for (const action of actions) {
    const downloadHref = action.id === "download-form-setup"
      ? formSetupDownloadHref(intakeByRequest.get(requestId)!)
      : undefined;
    const control = downloadHref ? document.createElement("a") : document.createElement("button");
    control.className = "quick";
    control.textContent = action.label;
    if (control instanceof HTMLAnchorElement) {
      control.href = downloadHref!;
      control.download = "gtm-observability-generate-lead.json";
      control.setAttribute("role", "button");
    }
    control.addEventListener("click", () => {
      row.remove();
      handleAssistantAction(action.id, requestId);
    });
    row.append(control);
  }
  responseList?.append(row);
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

function connectAssistant(): chrome.runtime.Port {
  if (port) return port;
  port = chrome.runtime.connect({ name: "assistant" });
  port.onDisconnect.addListener(() => {
    port = undefined;
    for (const [requestId, node] of responseNodes) {
      node.classList.remove("streaming");
      node.textContent = "The assistant connection restarted. Please send that again.";
      responseNodes.delete(requestId);
      const timeout = requestTimeouts.get(requestId);
      if (timeout !== undefined) window.clearTimeout(timeout);
      requestTimeouts.delete(requestId);
    }
  });
  port.onMessage.addListener((message: {
    type?: string;
    requestId?: string;
    delta?: string;
    actions?: Array<{ id: string; label: string }>;
    navigation?: NavigationElement[];
    forms?: FormCandidate[];
    intake?: ConversationIntakeResult;
  }) => {
    if (!message.requestId) return;
    const node = responseNodes.get(message.requestId);
    if (message.type === "ASSISTANT_DELTA" && node && message.delta) {
      node.classList.remove("streaming");
      node.textContent += message.delta;
      responseList?.scrollTo({ top: responseList.scrollHeight });
    }
    if (message.type === "ASSISTANT_DONE") {
      node?.classList.remove("streaming");
      responseNodes.delete(message.requestId);
      const timeout = requestTimeouts.get(message.requestId);
      if (timeout !== undefined) window.clearTimeout(timeout);
      requestTimeouts.delete(message.requestId);
      navigationByRequest.set(message.requestId, message.navigation ?? []);
      formsByRequest.set(message.requestId, message.forms ?? []);
      if (message.intake) {
        intakeByRequest.set(message.requestId, message.intake);
        if (message.intake.state === "awaiting_target") {
          highlightTargets(formTargets(message.forms ?? []), "candidate");
        }
      }
      renderQuickActions(message.requestId, message.actions ?? []);
    }
  });
  return port;
}

function submitPrompt(): void {
  const prompt = composer?.value.trim();
  if (!prompt) return;
  clearTargetHighlights();
  composer!.value = "";
  addMessage(prompt, "user");
  const requestId = crypto.randomUUID();
  const pending = addMessage("", "assistant", requestId);
  requestTimeouts.set(requestId, window.setTimeout(() => {
    if (!responseNodes.has(requestId)) return;
    pending.classList.remove("streaming");
    pending.textContent = "The assistant did not respond. Please try again.";
    responseNodes.delete(requestId);
    requestTimeouts.delete(requestId);
    port?.disconnect();
  }, 8_000));
  const scan = scanNavigation();
  const forms = scanForms();
  connectAssistant().postMessage({
    type: "ASSISTANT_REQUEST",
    requestId,
    prompt,
    page: {
      title: scan.title,
      url: scan.pageUrl,
      navigation: scan.navigation,
      forms,
    },
  });
  preferences.height = Math.max(preferences.height, 420);
  applyPreferences();
  persistPreferences();
}

function enableDragging(handle: HTMLElement): void {
  handle.addEventListener("pointerdown", (event) => {
    if ((event.target as Element).closest("button")) return;
    const bounds = frame!.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left;
    const offsetY = event.clientY - bounds.top;
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent): void => {
      preferences.x = Math.max(8, Math.min(innerWidth - bounds.width - 8, moveEvent.clientX - offsetX));
      preferences.y = Math.max(8, Math.min(innerHeight - bounds.height - 8, moveEvent.clientY - offsetY));
      applyPreferences();
    };
    const end = (): void => { handle.removeEventListener("pointermove", move); persistPreferences(); };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end, { once: true });
  });
}

async function mountOverlay(): Promise<void> {
  if (host) return;
  const stored = await chrome.storage.local.get("overlayPreferences");
  preferences = { ...preferences, ...(stored.overlayPreferences as Partial<OverlayPreferences> | undefined) };
  host = document.createElement("div");
  host.id = "gtm-observability-root";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .assistant { position: fixed; z-index: 2147483647; min-width: 310px; min-height: 220px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); overflow: hidden; resize: both; border: 1px solid rgba(255,255,255,.19); border-radius: 22px; background: linear-gradient(145deg, rgba(26,32,38,.78), rgba(12,17,21,.7)); color: #f5f7f8; box-shadow: 0 24px 70px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.08); backdrop-filter: blur(26px) saturate(145%); -webkit-backdrop-filter: blur(26px) saturate(145%); font: 13px/1.45 Inter, ui-sans-serif, system-ui, sans-serif; display: grid; grid-template-rows: 30px 1fr auto; transition: width .18s ease, height .18s ease, border-color .18s ease, box-shadow .18s ease; }
      .assistant:focus-within { border-color: rgba(167,243,208,.32); box-shadow: 0 26px 76px rgba(0,0,0,.34), 0 0 0 1px rgba(167,243,208,.08), inset 0 1px 0 rgba(255,255,255,.1); }
      .drag { position: relative; cursor: grab; display: flex; justify-content: flex-end; align-items: center; padding: 0 9px; user-select: none; }
      .drag::before { content: ""; position: absolute; left: 50%; width: 34px; height: 3px; border-radius: 99px; transform: translateX(-50%); background: rgba(255,255,255,.16); }
      .drag:active { cursor: grabbing; }
      button { border: 0; cursor: pointer; font: inherit; }
      .icon { width: 24px; height: 24px; border-radius: 50%; color: #aab4bc; background: transparent; font-size: 17px; }
      .icon:hover { color: white; background: rgba(255,255,255,.08); }
      .messages { overflow-y: auto; overflow-x: hidden; padding: 4px 16px 12px; display: flex; flex-direction: column; gap: 10px; }
      .messages > * { min-width: 0; }
      .gtm-context { flex: none; display: grid; gap: 8px; padding: 11px 12px; border: 1px solid rgba(167,243,208,.16); border-radius: 14px; background: linear-gradient(145deg, rgba(21,36,32,.82), rgba(18,27,31,.78)); box-shadow: inset 0 1px 0 rgba(255,255,255,.045); }
      .gtm-context-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .gtm-context-heading > strong { color: #f1f7f4; font-size: 12px; font-weight: 650; }
      .gtm-context-controls { display: flex; align-items: center; gap: 5px; }
      .gtm-context-badge { padding: 3px 7px; border: 1px solid rgba(141,232,189,.2); border-radius: 999px; color: #baf3d7; background: rgba(53,105,82,.3); font-size: 9px; font-weight: 700; letter-spacing: .025em; text-transform: uppercase; }
      .gtm-context-badge.warning { border-color: rgba(251,191,36,.18); color: #f4cf75; background: rgba(120,77,18,.24); }
      .gtm-context-refresh { display: grid; place-items: center; width: 23px; height: 23px; border-radius: 8px; color: #9aa7af; background: transparent; font-size: 15px; }
      .gtm-context-refresh:hover { color: #eff6f2; background: rgba(255,255,255,.07); }
      .gtm-context-body { display: grid; gap: 4px; min-width: 0; }
      .gtm-context-body p { margin: 0 0 2px; color: #c9d4d0; font-size: 10px; }
      .gtm-context-row { display: grid; grid-template-columns: 60px minmax(0, 1fr); gap: 8px; align-items: baseline; }
      .gtm-context-row span { color: #7f8d94; font-size: 9px; text-transform: uppercase; }
      .gtm-context-row strong { min-width: 0; color: #e7eeeb; font-size: 11px; font-weight: 590; overflow-wrap: anywhere; }
      .gtm-context-body small { margin-top: 3px; color: #89969e; font-size: 9px; line-height: 1.4; }
      .message { max-width: 88%; padding: 9px 11px; border-radius: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
      .message.bot { align-self: flex-start; color: #e5ebef; background: rgba(41,50,57,.72); border: 1px solid rgba(255,255,255,.06); border-radius: 4px 14px 14px 14px; }
      .message.user { align-self: flex-end; color: #f5fff9; background: #28483d; border-radius: 13px 13px 4px 13px; }
      .message.streaming:empty { width: 64px; height: 16px; background: linear-gradient(100deg, rgba(52,63,71,.6) 20%, rgba(167,243,208,.18) 45%, rgba(52,63,71,.6) 70%); background-size: 220% 100%; animation: shimmer 1.15s linear infinite; }
      .quick-actions { display: flex; flex-wrap: wrap; gap: 7px; }
      .quick { padding: 7px 10px; border: 1px solid rgba(167,243,208,.22); border-radius: 10px; color: #dff9ec; background: rgba(40,72,61,.58); font-size: 12px; text-decoration: none; }
      .quick:hover { border-color: rgba(167,243,208,.42); background: rgba(47,88,73,.72); }
      .gtm-action { justify-self: start; margin-top: 3px; }
      .gtm-write-note { color: #89969e; font-size: 10px; }
      .primary-quick { margin-top: 3px; justify-self: start; }
      .picker { display: grid; gap: 6px; padding: 9px; border: 1px solid rgba(255,255,255,.09); border-radius: 13px; background: rgba(22,29,34,.62); }
      .pick { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; padding: 6px; border-radius: 8px; color: #e3eaee; }
      .pick:hover { background: rgba(255,255,255,.04); }
      .pick input { accent-color: #8de8bd; }
      .pick small { color: #87949d; font-size: 10px; text-transform: uppercase; }
      .evidence-path { display: grid; gap: 0; padding: 11px; border: 1px solid rgba(255,255,255,.1); border-radius: 14px; background: rgba(13,19,23,.66); box-shadow: inset 0 1px 0 rgba(255,255,255,.035); }
      .evidence-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 0 1px 9px; }
      .evidence-heading span { color: #f2f7f4; font-weight: 650; }
      .evidence-heading small { color: #7f8c94; font-size: 10px; }
      .evidence-stage { position: relative; display: grid; grid-template-columns: 22px 1fr; gap: 7px; min-height: 38px; }
      .evidence-stage:not(:last-child)::after { content: ""; position: absolute; top: 21px; bottom: -1px; left: 9px; width: 1px; background: rgba(255,255,255,.12); }
      .evidence-stage i { position: relative; z-index: 1; display: grid; place-items: center; width: 19px; height: 19px; border-radius: 50%; color: #092419; background: #8de8bd; font: 700 11px/1 Inter, sans-serif; }
      .evidence-stage.pending i { color: #849098; background: #253038; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); }
      .evidence-stage.failed i { color: #ffd7d7; background: #713838; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); }
      .evidence-stage span { display: grid; align-content: start; gap: 1px; padding-bottom: 8px; }
      .evidence-stage strong { color: #e8efec; font-size: 12px; font-weight: 600; }
      .evidence-stage small { color: #89969e; font-size: 10px; overflow-wrap: anywhere; }
      .composer { margin: 0 12px 12px; padding: 6px 6px 6px 12px; display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 8px; border: 1px solid rgba(255,255,255,.14); border-radius: 15px; background: rgba(31,39,45,.72); box-shadow: inset 0 1px 0 rgba(255,255,255,.035); transition: border-color .16s ease, background .16s ease, box-shadow .16s ease; }
      .composer:focus-within { border-color: rgba(167,243,208,.38); background: rgba(34,43,49,.88); box-shadow: 0 0 0 3px rgba(167,243,208,.06), inset 0 1px 0 rgba(255,255,255,.05); }
      textarea { resize: none; min-height: 38px; max-height: 120px; padding: 8px 0; border: 0; outline: 0; color: white; background: transparent; font: inherit; }
      textarea::placeholder { color: #87939c; }
      .send { width: 38px; height: 38px; border-radius: 12px; color: #0c1b15; background: linear-gradient(145deg, #c4fae0, #8de8bd); box-shadow: 0 5px 16px rgba(86,220,157,.16), inset 0 1px 0 rgba(255,255,255,.5); font-size: 20px; transition: transform .15s ease, box-shadow .15s ease; }
      .send:hover { transform: translateY(-1px); box-shadow: 0 7px 20px rgba(86,220,157,.24), inset 0 1px 0 rgba(255,255,255,.55); }
      .assistant.collapsed { width: 48px !important; height: 48px !important; min-width: 48px; min-height: 48px; resize: none; display: grid; place-items: center; border-radius: 16px; border-color: rgba(255,255,255,.24); background: linear-gradient(145deg, rgba(48,58,67,.76), rgba(17,23,28,.7)); box-shadow: 0 12px 34px rgba(0,0,0,.3), 0 0 0 1px rgba(167,243,208,.05), inset 0 1px 0 rgba(255,255,255,.14); backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%); }
      .collapsed .drag, .collapsed .messages, .collapsed .composer { display: none; }
      .orb { display: none; position: relative; width: 100%; height: 100%; border-radius: 16px; color: transparent; background: transparent; }
      .orb::before { content: ""; position: absolute; inset: 13px; border-radius: 7px; background: conic-gradient(from 210deg, #8de8bd, #8bbcf6, #bd9af8, #8de8bd); filter: saturate(.78); box-shadow: 0 0 16px rgba(141,232,189,.22); }
      .orb::after { content: ""; position: absolute; inset: 17px; border-radius: 5px; background: rgba(17,23,28,.9); box-shadow: inset 0 1px 0 rgba(255,255,255,.2); }
      .collapsed .orb { display: block; }
      .collapsed:hover { transform: translateY(-2px); border-color: rgba(167,243,208,.32); box-shadow: 0 16px 42px rgba(0,0,0,.34), 0 0 24px rgba(141,232,189,.1), inset 0 1px 0 rgba(255,255,255,.16); }
      @keyframes shimmer { to { background-position: -120% 0; } }
      @media (prefers-reduced-motion: reduce) { .assistant, .send { transition: none; } .message.streaming:empty { animation: none; } }
    </style>
    <section class="assistant collapsed" aria-label="Tracking assistant">
      <div class="drag" aria-label="Drag assistant"><button class="icon collapse" aria-label="Collapse assistant">−</button></div>
      <div class="messages" aria-live="polite"><section class="gtm-context" role="region" aria-label="GTM connection"></section><div class="message bot">What do you want to track on this page?</div></div>
      <div class="composer"><textarea aria-label="Tracking request" placeholder="Describe an action or outcome…"></textarea><button class="send" aria-label="Send request">↑</button></div>
      <button class="orb" aria-label="Open tracking assistant">G</button>
    </section>`;
  frame = shadow.querySelector<HTMLElement>(".assistant")!;
  responseList = shadow.querySelector<HTMLElement>(".messages")!;
  composer = shadow.querySelector<HTMLTextAreaElement>("textarea")!;
  gtmConnectionCard = shadow.querySelector<HTMLElement>(".gtm-context")!;
  renderGtmConnection({ kind: "loading" });
  shadow.querySelector(".orb")?.addEventListener("click", () => setCollapsed(false));
  shadow.querySelector(".collapse")?.addEventListener("click", () => setCollapsed(true));
  shadow.querySelector(".send")?.addEventListener("click", submitPrompt);
  composer.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitPrompt(); }
  });
  enableDragging(shadow.querySelector<HTMLElement>(".drag")!);
  new ResizeObserver(() => {
    if (!frame || preferences.collapsed) return;
    preferences.width = Math.round(frame.clientWidth);
    preferences.height = Math.round(frame.clientHeight);
    persistPreferences();
  }).observe(frame);
  document.documentElement.append(host);
  applyPreferences();
  if (!preferences.collapsed) void loadGtmConnectionContext();
}

document.addEventListener("click", (event) => {
  const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || verificationScope.size === 0) return;
  const expected = [...verificationScope.values()].find((item) => item.href === anchor.href && anchor.matches(item.selector));
  if (!expected) return;
  const startedAt = performance.now();
  const initial: BrowserEvidence = { navigationId: expected.id, clickedAt: new Date().toISOString(), pageUrl: location.href, linkText: (anchor.innerText || expected.text).trim(), linkUrl: anchor.href, requests: [] };
  evidence.set(expected.id, initial);
  void chrome.runtime.sendMessage({ type: "VERIFICATION_EVIDENCE", evidence: initial });
  window.setTimeout(() => {
    const item = { ...initial, requests: recentAnalyticsRequests(startedAt) };
    evidence.set(expected.id, item);
    void chrome.runtime.sendMessage({ type: "VERIFICATION_EVIDENCE", evidence: item });
  }, 1200);
}, true);

document.addEventListener("submit", (event) => {
  const active = activeFormVerification;
  const form = event.target instanceof HTMLFormElement ? event.target : undefined;
  const target = active?.intake.target;
  if (!active || !form || !target || !form.matches(target.selector)) return;
  const startedAt = new Date().toISOString();
  const startedAtPerformance = performance.now();
  window.setTimeout(
    () => settleFormVerification(
      active.requestId,
      active.intake,
      startedAt,
      startedAtPerformance,
      startedAtPerformance + 5_000,
    ),
    1_200,
  );
}, true);

if (!window.__gtmObservabilityInstalled) {
  window.__gtmObservabilityInstalled = true;
  void mountOverlay();
  chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse) => {
    if (request.type === "TOGGLE_OVERLAY") { void mountOverlay().then(() => setCollapsed(!preferences.collapsed)); sendResponse({ toggled: true }); return true; }
    if (request.type === "SCAN_NAVIGATION") { sendResponse(scanNavigation()); return; }
    if (request.type === "START_VERIFICATION") { evidence.clear(); verificationScope = new Map(request.navigation.map((item) => [item.id, item])); sendResponse({ started: true, count: verificationScope.size }); return; }
    if (request.type === "FORM_ANALYTICS_REQUEST") { recentFormRequests.push(request.request); sendResponse({ recorded: true }); return; }
    if (request.type === "GET_EVIDENCE") sendResponse({ evidence: [...evidence.values()] });
  });
}
