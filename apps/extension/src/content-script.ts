import {
  type FormRun,
  createFormSetupProposal,
  thankYouUrlPattern,
  createSetupProposal,
  observeGtmRuntime,
  selectConversationSuccess,
  selectConversationTarget,
  type BrowserEvidence,
  type ConversationIntakeResult,
  type FormSetupRequest,
  type FormCandidate,
  type NavigationArea,
  type NavigationElement,
  type SuccessEvidence,
  type SetupProposal,
  type SetupRequest,
  type TrackingRunEvidenceV1,
  type TrackingSetupOperationV1,
  type TrackingSpecificationV1,
} from "@trimtale/core";
import {
  buildFormRunEvidence,
  FormEvidenceController,
  NavigationEvidenceController,
  type PostPublicationEvidenceCompletion,
} from "./evidence-capture.js";
import { FormSignalCapture, type FormAnalyticsRequest, type FormRunContext } from "./form-signal-capture.js";
import { registerPanelFonts } from "./panel-fonts.js";
import { panelStyles, targetHighlightStyles } from "./panel-styles.js";
import {
  presentPublicationReview,
  presentRollbackReview,
  presentSetupOperation,
  type PublicationReview,
  type SetupOperationAction,
} from "./setup-operation-presenter.js";
import { presentVerdict } from "./verdict-presenter.js";
import type { TrackingWorkflowRequest, WorkflowBridgeResponse, WorkflowResult } from "./workflow-bridge.js";

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
  workflowRequest?: TrackingWorkflowRequest;
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
  container?: { name: string; publicId: string };
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
    container: { name: string; publicId: string };
  };

type ExtensionRequest =
  | { type: "SCAN_NAVIGATION" }
  | { type: "START_VERIFICATION"; navigation: NavigationElement[] }
  | { type: "GET_EVIDENCE" }
  | { type: "VERIFICATION_EVIDENCE"; evidence: BrowserEvidence }
  | { type: "FORM_ANALYTICS_REQUEST"; request: FormAnalyticsRequest }
  | { type: "FORM_ANALYTICS_DELIVERY"; id: string; delivered: boolean }
  | { type: "TOGGLE_OVERLAY" };

const analyticsPattern = /(?:google-analytics\.com|analytics\.google\.com)\/g\/collect/i;
const navigationEvidence = new NavigationEvidenceController();
const formEvidence = new FormEvidenceController();
let formCapture: FormSignalCapture | undefined;
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
let activeFormVerification: { requestId: string; intake: ConversationIntakeResult } | undefined;
let gtmConnectionLoaded = false;
let gtmConnectionRequestSequence = 0;
let currentGtmConnection: GtmConnectionContext | undefined;

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

function formSetupRequest(result: ConversationIntakeResult): FormSetupRequest | undefined {
  const specification = confirmedFormSpecification(result);
  const measurementId = fixtureMeta("gtm-observability-measurement-id");
  const publicId = fixtureMeta("gtm-observability-container-id");
  if (!specification || !measurementId || !publicId) return undefined;
  return {
    specification,
    measurementId,
    container: { accountId: "0", containerId: "0", publicId, name: "Trimtale import" },
  };
}

function formSetupProposal(result: ConversationIntakeResult) {
  const request = formSetupRequest(result);
  return request ? createFormSetupProposal(request) : undefined;
}

function navigationSetupRequest(navigation: NavigationElement[]): SetupRequest | undefined {
  const measurementId = fixtureMeta("gtm-observability-measurement-id");
  const runtime = inspectGtmRuntime();
  const publicId = runtime.status === "detected" && runtime.containerIds.length === 1
    ? runtime.containerIds[0]
    : fixtureMeta("gtm-observability-container-id");
  if (!measurementId || !publicId || navigation.length === 0) return undefined;
  return {
    intent: "Track navigation links",
    pageUrl: location.href,
    measurementId,
    navigation,
    container: { accountId: "0", containerId: "0", publicId, name: "Trimtale import" },
  };
}

function navigationSetupProposal(navigation: NavigationElement[]): SetupProposal | undefined {
  const request = navigationSetupRequest(navigation);
  return request ? createSetupProposal(request) : undefined;
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

/** Text in backticks is evidence (event or parameter names) and renders as mono code. */
function appendRichText(parent: HTMLElement, copy: string): void {
  copy.split("`").forEach((part, index) => {
    if (!part) return;
    if (index % 2 === 1) {
      const code = document.createElement("code");
      code.textContent = part;
      parent.append(code);
    } else {
      parent.append(document.createTextNode(part));
    }
  });
}

let findingSequence = 0;

/**
 * A run verdict, led by the plain-language outcome: observed → why → fix → verify.
 * The raw contract fields (verdict code, browser and platform states) sit behind
 * "Show evidence" in mono.
 */
function renderFinding(evidence: TrackingRunEvidenceV1, targetLabel?: string): HTMLElement {
  const finding = presentVerdict(evidence, targetLabel ? { targetLabel } : {});
  const id = `trimtale-finding-${++findingSequence}`;
  const article = document.createElement("article");
  article.className = `finding explanation ${finding.status}`;
  article.dataset.verdictCode = finding.code;
  article.setAttribute("aria-labelledby", `${id}-title`);

  const tag = document.createElement("span");
  tag.className = `tag ${finding.status}`;
  const symbol = document.createElement("span");
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = finding.symbol;
  tag.append(symbol, document.createTextNode(finding.statusLabel));

  const title = document.createElement("h2");
  title.id = `${id}-title`;
  title.className = "finding-title";
  title.textContent = finding.title;

  const steps = document.createElement("dl");
  steps.className = "steps";
  for (const [label, copy] of [
    ["Observed", finding.observed],
    ["Why", finding.consequence],
    ["Fix", finding.fix],
    ["Verify", finding.verify],
  ] as const) {
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    appendRichText(detail, copy);
    steps.append(term, detail);
  }

  const evidenceList = document.createElement("dl");
  evidenceList.id = `${id}-evidence`;
  evidenceList.className = "evidence";
  evidenceList.hidden = true;
  for (const row of finding.evidence) {
    const term = document.createElement("dt");
    term.dataset.field = row.label;
    // Field paths may wrap only at their dots.
    row.label.split(".").forEach((part, index) => {
      if (index > 0) term.append(".", document.createElement("wbr"));
      term.append(part);
    });
    const detail = document.createElement("dd");
    detail.textContent = row.value;
    evidenceList.append(term, detail);
  }

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "disclosure";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", evidenceList.id);
  toggle.textContent = "Show evidence";
  toggle.addEventListener("click", () => {
    const open = evidenceList.hidden;
    evidenceList.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Hide evidence" : "Show evidence";
  });

  article.append(tag, title, steps, toggle, evidenceList);
  responseList?.append(article);
  window.requestAnimationFrame(() => article.scrollIntoView({ block: "start" }));
  return article;
}

function renderFormEvidence(evidence: TrackingRunEvidenceV1, targetLabel?: string): HTMLElement {
  return renderFinding(evidence, targetLabel);
}

function finishFormRun(run: FormRun, context: FormRunContext): void {
  if (context.mode === "post_publication") {
    if (!formEvidence.postPublicationRequest && context.operationId && context.request) {
      formEvidence.resumePostPublication(context.operationId, context.request);
    }
    const completion = formEvidence.finishPostPublication(run);
    if (!completion) return;
    const request = completion.request;
    renderFormEvidence(completion.evidence, "specification" in request ? request.specification.targets[0]?.label : undefined);
    void recordPostPublicationBrowserEvidence(completion.operationId, completion.evidence, completion.request);
    return;
  }
  renderFormEvidence(buildFormRunEvidence({
    specification: context.specification,
    target: context.target,
    success: context.success,
    run,
  }), context.target.label);
  activeFormVerification = undefined;
}

function finishPostPublicationNavigationVerification(expected: NavigationElement, item: BrowserEvidence): void {
  const completion = navigationEvidence.completePostPublication(expected, item);
  if (!completion) return;
  recordPostPublicationNavigationCompletion(completion);
}

function recordPostPublicationNavigationCompletion(completion: PostPublicationEvidenceCompletion): void {
  const request = completion.request;
  const targetId = completion.evidence.observations.interaction.targetId;
  const link = "navigation" in request ? request.navigation.find((item) => item.id === targetId) : undefined;
  renderFinding(completion.evidence, link?.text);
  void recordPostPublicationBrowserEvidence(completion.operationId, completion.evidence, completion.request);
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

/** A same-origin form action that names a thank-you/success page, e.g. action="/thank-you". */
function thankYouPageSignal(form: HTMLFormElement): FormCandidate["successSignals"][number] | undefined {
  const action = form.getAttribute("action");
  if (!action) return undefined;
  try {
    const url = new URL(action, location.href);
    if (url.origin !== location.origin) return undefined;
    if (!/(?:thank|success|confirm|complete)/i.test(url.pathname)) return undefined;
    return { id: "thank-you-url", label: "Thank-you page", type: "thank_you_url", value: thankYouUrlPattern(url.href) };
  } catch {
    return undefined;
  }
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
    const thankYou = thankYouPageSignal(form);
    if (thankYou) successSignals.push(thankYou);
    const adjacent = adjacentFormSuccessSignal(form);
    if (adjacent) successSignals.push(adjacent);
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

async function requestSetupOperation(
  action: "start" | "resume" | "get" | "approve" | "publish" | "approveRollback" | "rollback",
  value: TrackingWorkflowRequest | string,
  approval?: { versionFingerprint?: string; targetVersionFingerprint?: string; confirmation?: string },
): Promise<WorkflowBridgeResponse> {
  return chrome.runtime.sendMessage({
    type: "GTM_WORKFLOW_REQUEST",
    action,
    ...(typeof value === "string" ? { operationId: value } : { request: value }),
    ...approval,
  }) as Promise<WorkflowBridgeResponse>;
}

async function requestBrowserVerification(
  operationId: string,
  evidence: TrackingRunEvidenceV1,
): Promise<WorkflowBridgeResponse> {
  return chrome.runtime.sendMessage({
    type: "GTM_WORKFLOW_REQUEST",
    action: "browserVerification",
    operationId,
    evidence,
  }) as Promise<WorkflowBridgeResponse>;
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
    || typeof value.tokenPersistenceEnabled !== "boolean") return undefined;
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
  if (!isBoundedText(value.account.accountId, 64)
    || !isBoundedText(value.account.name)
    || !isBoundedText(value.container.name)
    || value.container.publicId !== publicId) return undefined;
  return {
    status: value.status,
    publicId,
    account: { accountId: value.account.accountId, name: value.account.name },
    container: { name: value.container.name, publicId },
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

function appendConnectionRow(parent: HTMLElement, label: string, value: string, mono = label === "Page"): void {
  const row = document.createElement("div");
  row.className = "gtm-context-row";
  const term = document.createElement("span");
  term.textContent = label;
  const detail = document.createElement("strong");
  if (mono) detail.className = "mono";
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
    note.textContent = accessExplanation(view.status);
  }

  const badgeWord = badge.textContent ?? "";
  const badgeSymbol = badge.classList.contains("warning") ? "!" : view.kind === "loading" ? "" : "□";
  if (!badge.classList.contains("warning") && view.kind !== "loading") badge.classList.add("observed");
  badge.replaceChildren();
  if (badgeSymbol) {
    const symbol = document.createElement("span");
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = badgeSymbol;
    badge.append(symbol);
  }
  const word = document.createElement("span");
  word.textContent = badgeWord;
  badge.append(word);
  body.prepend(summary);
  if (note.textContent) body.append(note);
  gtmConnectionCard.append(heading, body);
}

async function loadGtmConnectionContext(force = false): Promise<void> {
  if (gtmConnectionLoaded && !force) return;
  const requestSequence = ++gtmConnectionRequestSequence;
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
    currentGtmConnection = undefined;
    renderGtmConnection({ kind: "check_failed" });
    return;
  }
  currentGtmConnection = context;
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
    renderGtmConnection({
      kind: "recognized",
      status: context.status,
      publicId: context.result.publicId,
      account: context.result.account,
      container: context.result.container,
    });
    return;
  }
  renderGtmConnection({ kind: "check_failed" });
}

function updateEvidenceStage(
  row: HTMLElement,
  state: "passed" | "pending",
  detail: string,
): void {
  row.classList.toggle("passed", state === "passed");
  row.classList.toggle("pending", state === "pending");
  const icon = row.querySelector("i");
  const copy = row.querySelector("small");
  if (icon) icon.textContent = state === "passed" ? "✓" : "○";
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

function appendInlineAction(
  parent: HTMLElement,
  label: string,
  action: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "quick";
  button.textContent = label;
  button.addEventListener("click", () => {
    button.disabled = true;
    action();
  }, { once: true });
  parent.append(button);
  return button;
}

function operationStorageKey(request: TrackingWorkflowRequest): string {
  const specificationId = "specification" in request
    ? request.specification.id
    : createSetupProposal(request).specification.id;
  return `trackingOperation:${request.container.publicId}:${specificationId}`;
}

function renderSetupOperation(result: WorkflowResult, request?: TrackingWorkflowRequest): void {
  responseList?.querySelectorAll("section[aria-label=\"Setup operation\"]").forEach((element) => element.remove());
  const presentation = presentSetupOperation(result);
  const path = document.createElement("section");
  path.className = "evidence-path";
  path.setAttribute("aria-label", "Setup operation");
  const heading = document.createElement("div");
  heading.className = "evidence-heading";
  const title = document.createElement("span");
  title.textContent = "Setup operation";
  const label = document.createElement("small");
  label.textContent = presentation.label;
  heading.append(title, label);
  path.append(heading);

  for (const stage of presentation.stages) {
    const row = document.createElement("div");
    row.className = `evidence-stage ${stage.passed ? "passed" : "pending"}`;
    const icon = document.createElement("i");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = stage.passed ? "✓" : "○";
    const copy = document.createElement("span");
    const stageLabel = document.createElement("strong");
    stageLabel.textContent = stage.label;
    const detail = document.createElement("small");
    detail.textContent = stage.detail;
    copy.append(stageLabel, detail);
    row.append(icon, copy);
    path.append(row);
  }

  const guidance = document.createElement("p");
  guidance.className = "evidence-note";
  guidance.textContent = presentation.guidance;
  path.append(guidance);

  addMessage(presentation.assistantMessage, "assistant");
  for (const action of presentation.actions) appendSetupOperationAction(path, action, result, request);
  responseList?.append(path);
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

function appendSetupOperationAction(
  parent: HTMLElement,
  action: SetupOperationAction,
  result: WorkflowResult,
  request?: TrackingWorkflowRequest,
): void {
  appendInlineAction(parent, action.label, () => {
    if (action.kind === "resume") {
      void runSetupOperation("resume", action.operationId, request);
    } else if (action.kind === "review") {
      const operation = result.operation;
      if (operation) renderPublicationReview(operation, request);
    } else if (action.kind === "publish") {
      void runPublishOperation(action.operationId, action.versionFingerprint, request);
    } else if (action.kind === "browserVerification" && result.status === "published") {
      void startPostPublicationBrowserVerification(result.operation, request);
    } else if (action.kind === "rollbackReview") {
      const operation = result.operation;
      if (operation) renderRollbackReview(operation, request);
    } else if (action.kind === "rollback") {
      void runRollbackOperation(action.operationId, action.targetVersionFingerprint, request);
    }
  });
}

async function rememberOperation(request: TrackingWorkflowRequest, operationId: string): Promise<void> {
  await chrome.storage.local.set({ [operationStorageKey(request)]: operationId });
}

async function renderStoredOperation(request: TrackingWorkflowRequest): Promise<void> {
  const stored = await chrome.storage.local.get(operationStorageKey(request));
  const operationId = stored[operationStorageKey(request)];
  if (typeof operationId !== "string") return;
  const response = await requestSetupOperation("get", operationId);
  if (response.ok) renderSetupOperation(response.result, request);
}

async function runSetupOperation(
  action: "start" | "resume",
  value: TrackingWorkflowRequest | string,
  request?: TrackingWorkflowRequest,
): Promise<void> {
  addMessage(action === "start" ? "Preparing a durable GTM setup operation…" : "Resuming the GTM setup operation…", "assistant");
  const response = await requestSetupOperation(action, value);
  if (!response.ok) {
    addMessage(`${response.error} Nothing was published.`, "assistant");
    return;
  }
  const operation = response.result.operation;
  if (operation && request) await rememberOperation(request, operation.id);
  renderSetupOperation(response.result, request);
}

/**
 * The explicit confirmation step before any approval: exactly what would publish, and a
 * typed container ID. Approving records approval only; publishing is a later request.
 */
function renderPublicationReview(operation: TrackingSetupOperationV1, request?: TrackingWorkflowRequest): void {
  renderConfirmationReview({
    review: presentPublicationReview(operation),
    region: "Publication review",
    unavailable: "This version can no longer be approved. Reload the setup operation.",
    cancelled: "Approval cancelled. Nothing was approved or published.",
    approve: (confirmation) => operation.version
      ? runApproveOperation(operation.id, operation.version.fingerprint, confirmation, request)
      : Promise.resolve(),
  });
}

/**
 * The same deliberate step before a rollback: what the rollback restores and replaces, and
 * the typed container ID. Approving records approval only; rolling back is a later request.
 */
function renderRollbackReview(operation: TrackingSetupOperationV1, request?: TrackingWorkflowRequest): void {
  renderConfirmationReview({
    review: presentRollbackReview(operation),
    region: "Rollback review",
    unavailable: "This rollback can no longer be approved. Reload the setup operation.",
    cancelled: "Rollback approval cancelled. Nothing was approved or rolled back.",
    approve: (confirmation) => operation.rollback
      ? runApproveRollback(operation.id, operation.rollback.targetVersionFingerprint, confirmation, request)
      : Promise.resolve(),
  });
}

function renderConfirmationReview({ review, region, unavailable, cancelled, approve: submit }: {
  review: PublicationReview | undefined;
  region: "Publication review" | "Rollback review";
  unavailable: string;
  cancelled: string;
  approve: (confirmation: string) => Promise<void>;
}): void {
  responseList?.querySelectorAll("section[aria-label=\"Publication review\"], section[aria-label=\"Rollback review\"]")
    .forEach((element) => element.remove());
  if (!review) {
    addMessage(unavailable, "assistant");
    return;
  }
  const id = `trimtale-review-${++findingSequence}`;
  const section = document.createElement("section");
  section.className = "finding publication-review";
  section.setAttribute("aria-label", region);

  const tag = document.createElement("span");
  tag.className = "tag review";
  const symbol = document.createElement("span");
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = "!";
  tag.append(symbol, document.createTextNode("Changes the live container"));

  const title = document.createElement("h2");
  title.className = "finding-title";
  title.textContent = review.title;
  const consequence = document.createElement("p");
  consequence.className = "review-copy";
  consequence.textContent = review.consequence;

  const rows = document.createElement("dl");
  rows.className = "evidence review-rows";
  for (const row of review.rows) {
    const term = document.createElement("dt");
    term.textContent = row.label;
    const detail = document.createElement("dd");
    // GTM paths may wrap only after a slash.
    row.value.split("/").forEach((part, index) => {
      if (index > 0) detail.append("/", document.createElement("wbr"));
      detail.append(part);
    });
    rows.append(term, detail);
  }

  // A rollback restores a whole prior version, so it lists no per-entity changes.
  const changeList: HTMLElement[] = [];
  if (review.changes.length > 0) {
    const changesHeading = document.createElement("h3");
    changesHeading.className = "review-heading";
    changesHeading.textContent = `${review.changes.length} change${review.changes.length === 1 ? "" : "s"} in this version`;
    const changes = document.createElement("ul");
    changes.className = "review-changes";
    for (const change of review.changes) {
      const item = document.createElement("li");
      item.textContent = change;
      changes.append(item);
    }
    changeList.push(changesHeading, changes);
  }

  const note = document.createElement("p");
  note.className = "evidence-note";
  note.textContent = review.approvalNote;

  const label = document.createElement("label");
  label.className = "review-confirm";
  label.htmlFor = `${id}-confirm`;
  label.textContent = `Type ${review.confirmation} to confirm`;
  const input = document.createElement("input");
  input.id = `${id}-confirm`;
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.className = "review-input";

  const actions = document.createElement("div");
  actions.className = "quick-actions";
  const approve = document.createElement("button");
  approve.type = "button";
  approve.className = "quick primary-quick";
  approve.textContent = review.approveLabel;
  approve.disabled = true;
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "quick";
  cancel.textContent = "Cancel";
  actions.append(approve, cancel);

  input.addEventListener("input", () => {
    approve.disabled = input.value.trim() !== review.confirmation;
  });
  cancel.addEventListener("click", () => {
    section.remove();
    addMessage(cancelled, "assistant");
  });
  approve.addEventListener("click", () => {
    if (input.value.trim() !== review.confirmation) return;
    approve.disabled = true;
    input.disabled = true;
    void submit(input.value.trim()).finally(() => section.remove());
  });

  section.append(tag, title, consequence, rows, ...changeList, note, label, input, actions);
  responseList?.append(section);
  window.requestAnimationFrame(() => {
    section.scrollIntoView({ block: "start" });
    input.focus();
  });
}

async function runApproveOperation(
  operationId: string,
  versionFingerprint: string,
  confirmation: string,
  request?: TrackingWorkflowRequest,
): Promise<void> {
  addMessage(`Recording approval for ${versionFingerprint}. Nothing is published in this step.`, "assistant");
  const response = await requestSetupOperation("approve", operationId, { versionFingerprint, confirmation });
  if (!response.ok) {
    addMessage(`${response.error} Nothing was approved or published.`, "assistant");
    return;
  }
  renderSetupOperation(response.result, request);
}

async function runPublishOperation(
  operationId: string,
  versionFingerprint: string,
  request?: TrackingWorkflowRequest,
): Promise<void> {
  addMessage(`Publishing approved version ${versionFingerprint}…`, "assistant");
  const response = await requestSetupOperation("publish", operationId, { versionFingerprint });
  if (!response.ok) {
    addMessage(`${response.error} Browser verification and platform confirmation remain pending.`, "assistant");
    return;
  }
  const operation = response.result.operation;
  if (operation && request) await rememberOperation(request, operation.id);
  renderSetupOperation(response.result, request);
}

async function runApproveRollback(
  operationId: string,
  targetVersionFingerprint: string,
  confirmation: string,
  request?: TrackingWorkflowRequest,
): Promise<void> {
  addMessage(`Recording rollback approval for ${targetVersionFingerprint}. Nothing is rolled back in this step.`, "assistant");
  const response = await requestSetupOperation("approveRollback", operationId, { targetVersionFingerprint, confirmation });
  if (!response.ok) {
    addMessage(`${response.error} Nothing was approved or rolled back.`, "assistant");
    return;
  }
  renderSetupOperation(response.result, request);
}

async function runRollbackOperation(
  operationId: string,
  targetVersionFingerprint: string,
  request?: TrackingWorkflowRequest,
): Promise<void> {
  addMessage(`Rolling back to approved version ${targetVersionFingerprint}…`, "assistant");
  const response = await requestSetupOperation("rollback", operationId, { targetVersionFingerprint });
  if (!response.ok) {
    addMessage(`${response.error} The failed publication still requires recovery.`, "assistant");
    return;
  }
  renderSetupOperation(response.result, request);
}

function isNavigationWorkflowRequest(request: TrackingWorkflowRequest | undefined): request is SetupRequest {
  return Boolean(request && "navigation" in request);
}

function isFormWorkflowRequest(request: TrackingWorkflowRequest | undefined): request is FormSetupRequest {
  return Boolean(request && "specification" in request && request.specification.interaction.type === "form_submission");
}

async function recordPostPublicationBrowserEvidence(
  operationId: string,
  evidence: TrackingRunEvidenceV1,
  request: TrackingWorkflowRequest,
): Promise<void> {
  const response = await requestBrowserVerification(operationId, evidence);
  if (!response.ok) {
    addMessage(`${response.error} The published version still needs review; platform confirmation remains unavailable.`, "assistant");
    return;
  }
  renderSetupOperation(response.result, request);
}

async function startPostPublicationBrowserVerification(
  operation: TrackingSetupOperationV1,
  request?: TrackingWorkflowRequest,
): Promise<void> {
  if (isNavigationWorkflowRequest(request)) {
    navigationEvidence.startPostPublication(operation.id, request);
    highlightTargets(navigationTargets(request.navigation), "confirmed");
    addMessage("Browser verification is ready. Click one confirmed navigation link once.", "assistant");
    return;
  }
  if (isFormWorkflowRequest(request)) {
    formEvidence.startPostPublication(operation.id, request);
    const target = request.specification.targets[0];
    const success = request.specification.successEvidence[0];
    if (target && success) {
      formCapture?.arm({ mode: "post_publication", specification: request.specification, target, success, operationId: operation.id, request });
    }
    if (target) highlightTargets([{ id: target.id, label: target.label, selector: target.selector }], "confirmed");
    addMessage(`Browser verification is ready. Submit ${target?.label ?? "the selected form"} once.`, "assistant");
    return;
  }
  addMessage("Reload the confirmed tracking request before starting browser verification for this published operation.", "assistant");
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
    targetHost.id = "trimtale-targets";
    const shadow = targetHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = targetHighlightStyles;
    shadow.append(style);
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

function renderEvidencePath(context: EvidencePathContext): void {
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
    { state: "pending", label: "Browser verification", detail: "Runs after the GTM setup is installed" },
    { state: "pending", label: "Platform confirmation", detail: "Unverified — browser evidence cannot confirm GA4 processing" },
  ];
  const heading = document.createElement("div");
  heading.className = "evidence-heading";
  heading.innerHTML = `<span>Evidence path</span><small>What the assistant used</small>`;
  path.append(heading);
  let accessRow: HTMLElement | undefined;
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
  }
  if (runtime.status === "detected" && runtime.containerIds.length === 1 && accessRow) {
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
          if (context.workflowRequest) {
            appendInlineAction(path, "Prepare GTM version", () => {
              void runSetupOperation("start", context.workflowRequest!, context.workflowRequest);
            });
            void renderStoredOperation(context.workflowRequest);
          }
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
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

function confirmNavigation(navigation: NavigationElement[]): void {
  highlightTargets(navigationTargets(navigation), "confirmed");
  addMessage(`${navigation.length} navigation link${navigation.length === 1 ? "" : "s"} selected and highlighted on the page.`, "assistant");
  const request = navigationSetupRequest(navigation);
  const proposal = request ? createSetupProposal(request) : undefined;
  renderEvidencePath({
    intentDetail: "Navigation clicks → navigation_click",
    inspectedDetail: `${navigation.length} matching link${navigation.length === 1 ? "" : "s"} found`,
    confirmedDetail: `${navigation.length} highlighted on this page`,
    setupGenerated: proposal !== undefined,
    setupDetail: proposal
      ? "Reviewable navigation_click setup generated"
      : "Connect a GTM container and GA4 measurement ID to generate setup",
    ...(request ? { workflowRequest: request } : {}),
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
  download.download = "trimtale-navigation-click.json";
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
    const request = formSetupRequest(intake);
    const proposal = request ? createFormSetupProposal(request) : undefined;
    renderEvidencePath({
      intentDetail: `Successful ${intake.target?.label ?? "form"} submission → generate_lead`,
      inspectedDetail: `${forms.length} form${forms.length === 1 ? "" : "s"} found`,
      confirmedDetail: `${intake.target?.label ?? "Selected form"} highlighted on this page`,
      setupGenerated: proposal !== undefined,
      setupDetail: proposal
        ? "Reviewable generate_lead setup generated"
        : "Connect a GTM container and GA4 measurement ID to generate setup",
      ...(request ? { workflowRequest: request } : {}),
    });
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
    const specification = confirmedFormSpecification(intake);
    const target = specification?.targets[0];
    const success = successEvidenceFor(intake);
    if (!specification || !target || !success) return;
    formCapture?.arm({ mode: "interactive", specification, target, success });
    activeFormVerification = { requestId, intake };
    addMessage(`Verification is ready. Submit ${intake.target?.label ?? "the selected form"} once.`, "assistant");
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
      control.download = "trimtale-generate-lead.json";
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
  host.id = "trimtale-root";
  const shadow = host.attachShadow({ mode: "open" });
  registerPanelFonts();
  const style = document.createElement("style");
  style.textContent = panelStyles;
  const template = document.createElement("template");
  template.innerHTML = `
    <section class="assistant collapsed" aria-label="Tracking assistant">
      <div class="drag" aria-label="Drag assistant"><span class="product">Trimtale</span><button class="icon collapse" type="button" aria-label="Collapse assistant">−</button></div>
      <div class="messages" aria-live="polite"><section class="gtm-context" role="region" aria-label="GTM connection"></section><div class="message bot">What do you want to track on this page?</div></div>
      <div class="composer"><textarea aria-label="Tracking request" placeholder="Describe an action or outcome…"></textarea><button class="send" type="button" aria-label="Send request">↑</button></div>
      <button class="orb" type="button" aria-label="Open tracking assistant">T</button>
    </section>`;
  shadow.append(style, template.content);
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
  // Only settled sizes are preferences. Recording intermediate sizes while the
  // open/resize transition runs let a later applyPreferences() freeze the panel
  // part-way open (e.g. when a prompt is submitted within the 180ms transition).
  // Sizes are read in the same content-box terms applyPreferences() writes, so
  // re-applying a remembered size does not grow the panel by its border width.
  const rememberSettledSize = (): void => {
    if (!frame || preferences.collapsed) return;
    const style = getComputedStyle(frame);
    preferences.width = Math.round(Number.parseFloat(style.width));
    preferences.height = Math.round(Number.parseFloat(style.height));
    persistPreferences();
  };
  const sizeTransitionRunning = (): boolean => frame?.getAnimations().some((animation) =>
    animation instanceof CSSTransition
    && (animation.transitionProperty === "width" || animation.transitionProperty === "height")) ?? false;
  new ResizeObserver(() => {
    if (sizeTransitionRunning()) return;
    rememberSettledSize();
  }).observe(frame);
  frame.addEventListener("transitionend", (event) => {
    if (event.target === frame && (event.propertyName === "width" || event.propertyName === "height")) {
      rememberSettledSize();
    }
  });
  document.documentElement.append(host);
  applyPreferences();
  if (!preferences.collapsed) void loadGtmConnectionContext();
}

document.addEventListener("click", (event) => {
  const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || navigationEvidence.scopeSize === 0) return;
  const expected = navigationEvidence.expectedForAnchor(anchor);
  if (!expected) return;
  const startedAt = performance.now();
  const initial: BrowserEvidence = { navigationId: expected.id, clickedAt: new Date().toISOString(), pageUrl: location.href, linkText: (anchor.innerText || expected.text).trim(), linkUrl: anchor.href, requests: [] };
  navigationEvidence.recordClick(expected, initial);
  void chrome.runtime.sendMessage({ type: "VERIFICATION_EVIDENCE", evidence: initial });
  window.setTimeout(() => {
    const item = { ...initial, requests: recentAnalyticsRequests(startedAt) };
    navigationEvidence.recordClick(expected, item);
    if (item.requests.length > 0) finishPostPublicationNavigationVerification(expected, item);
  }, 180);
  window.setTimeout(() => {
    const item = { ...initial, requests: recentAnalyticsRequests(startedAt) };
    navigationEvidence.recordClick(expected, item);
    void chrome.runtime.sendMessage({ type: "VERIFICATION_EVIDENCE", evidence: item });
    if (item.requests.length > 0) finishPostPublicationNavigationVerification(expected, item);
  }, 1200);
}, true);


async function resumeFormRun(): Promise<void> {
  let response: { saved?: unknown; requests?: FormAnalyticsRequest[] } | undefined;
  try {
    response = await chrome.runtime.sendMessage({ type: "FORM_RUN_RESUME" }) as typeof response;
  } catch {
    return;
  }
  const context = formCapture?.resume(response?.saved, response?.requests ?? []);
  if (!context) return;
  setCollapsed(false);
  addMessage(`The form submission opened ${location.pathname}. Continuing verification of ${context.target.label} here.`, "assistant");
}

if (!window.__gtmObservabilityInstalled) {
  window.__gtmObservabilityInstalled = true;
  formCapture = new FormSignalCapture(finishFormRun);
  void mountOverlay().then(resumeFormRun);
  chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse) => {
    if (request.type === "TOGGLE_OVERLAY") { void mountOverlay().then(() => setCollapsed(!preferences.collapsed)); sendResponse({ toggled: true }); return true; }
    if (request.type === "SCAN_NAVIGATION") { sendResponse(scanNavigation()); return; }
    if (request.type === "START_VERIFICATION") { const count = navigationEvidence.startVerification(request.navigation); sendResponse({ started: true, count }); return; }
    if (request.type === "VERIFICATION_EVIDENCE" && request.evidence) {
      const completion = navigationEvidence.recordEvidence(request.evidence);
      if (completion) recordPostPublicationNavigationCompletion(completion);
      sendResponse({ recorded: true });
      return;
    }
    if (request.type === "FORM_ANALYTICS_REQUEST") { formCapture?.recordAnalyticsRequest(request.request); sendResponse({ recorded: true }); return; }
    if (request.type === "FORM_ANALYTICS_DELIVERY") { formCapture?.recordAnalyticsDelivery(request.id, request.delivered); sendResponse({ recorded: true }); return; }
    if (request.type === "GET_EVIDENCE") sendResponse({ evidence: navigationEvidence.evidence });
  });
}
