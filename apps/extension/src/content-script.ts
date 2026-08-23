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
import {
  decodeIntakeEvaluationDetailResponse,
  decodeIntakeEvaluationListResponse,
  intakeProviderDisplayState,
  type IntakeEvaluationReportSummaryV1,
  type IntakeEvaluationReportV1,
  type IntakeProviderDisplayState,
  type IntakeProviderEvaluationSummaryV1,
} from "./intake-evaluation-view.js";

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
  container?: { name: string; publicId: string };
  workspace?: GtmWorkspaceResult;
}

interface GtmBridgeResponse {
  ok: boolean;
  error?: string;
  result?: GtmContainerResult;
  containerWritesEnabled?: boolean;
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
let reportPanel: HTMLElement | undefined;
let reportContent: HTMLElement | undefined;
let reportToggle: HTMLButtonElement | undefined;
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
let reportRequestSequence = 0;

interface IntakeEvaluationBridgeResponse {
  ok: boolean;
  status: number;
  body?: unknown;
}

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

function formSetupProposal(result: ConversationIntakeResult) {
  const specification = confirmedFormSpecification(result);
  const measurementId = fixtureMeta("gtm-observability-measurement-id");
  const publicId = fixtureMeta("gtm-observability-container-id");
  if (!specification || !measurementId || !publicId) return undefined;
  return createFormSetupProposal({
    specification,
    measurementId,
    container: { accountId: "0", containerId: "0", publicId, name: "GTM Observability import" },
  });
}

function navigationSetupProposal(navigation: NavigationElement[]): SetupProposal | undefined {
  const measurementId = fixtureMeta("gtm-observability-measurement-id");
  const runtime = inspectGtmRuntime();
  const publicId = runtime.status === "detected" && runtime.containerIds.length === 1
    ? runtime.containerIds[0]
    : fixtureMeta("gtm-observability-container-id");
  if (!measurementId || !publicId || navigation.length === 0) return undefined;
  return createSetupProposal({
    intent: "Track navigation links",
    pageUrl: location.href,
    measurementId,
    navigation,
    container: { accountId: "0", containerId: "0", publicId, name: "GTM Observability import" },
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

function formExplanation(verdict: TrackingRunEvidenceV1["verdict"]): string {
  if (verdict.code === "browser_verified") {
    return "Browser verification passed because one generate_lead request was observed. Platform confirmation remains unverified.";
  }
  if (verdict.code === "expected_non_conversion") {
    return "The form was stopped by validation, so this attempt was not counted. Correct the input and submit again. Platform confirmation remains unverified.";
  }
  return `${verdict.code.replaceAll("_", " ")}. ${verdict.nextAction} Platform confirmation remains unverified.`;
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

function finishFormVerification(result: ConversationIntakeResult, startedAt: string): void {
  const specification = confirmedFormSpecification(result);
  const target = result.target;
  const success = result.successSignal;
  if (!specification || !target || !success) return;
  const pageState = document.documentElement.dataset;
  const requestUrls = recentFormRequests
    .filter((request) => Date.parse(request.observedAt) >= Date.parse(startedAt))
    .map((request) => request.url);
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
    submitAttempted: pageState.submitAttempted === "true",
    submissionResult: classifySubmissionResult(pageState.submissionResult),
    outcomeObserved: pageState.outcomeObserved === "true",
    outcomeObservable: pageState.outcomeObservable !== "false",
    outcomeEvidenceType: success.type,
    dataLayerEvents: pageState.dataLayerEvent === "true"
      ? [{ event: "generate_lead", form_id: target.id, form_name: target.label.replaceAll(" ", "_") }]
      : [],
    tagFired: pageState.tagFired === "true" ? true : pageState.tagFired === "false" ? false : null,
    networkUrls: requestUrls,
    consent: classifyConsent(pageState.consent),
  }, provisionalVerdict);
  const verdict = determineFormVerdict(provisional.observations);
  const verdictMessage = addMessage(
    `Verdict: ${verdict.code}\nBrowser verification: ${verdict.browserVerification}\nPlatform confirmation: ${verdict.platformConfirmation}\nNext action: ${verdict.nextAction}`,
    "assistant",
  );
  addMessage(formExplanation(verdict), "assistant").classList.add("explanation");
  window.requestAnimationFrame(() => verdictMessage.scrollIntoView({ block: "start" }));
  activeFormVerification = undefined;
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
  if (collapsed && reportPanel && !reportPanel.hidden) setEvaluationPanelOpen(false, false);
  preferences.collapsed = collapsed;
  applyPreferences();
  persistPreferences();
  if (!collapsed) composer?.focus();
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
    recentFormRequests.length = 0;
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

function clearElement(element: HTMLElement): void {
  while (element.firstChild) element.firstChild.remove();
}

function evaluationButton(label: string, className: string, action: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

function evaluationTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value)).replace(", 24:", ", 00:") + " UTC";
}

function evaluationDuration(value: number): string {
  if (value < 1_000) return `${Math.round(value)} ms`;
  return `${Math.round(value / 100) / 10} s`;
}

function evaluationCost(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 6 : 2,
  }).format(value);
}

function evaluationStateCopy(state: IntakeProviderDisplayState): { label: string; detail: string } {
  if (state === "passing") return { label: "Passing", detail: "Every acceptance case passed" };
  if (state === "hard_failure") return { label: "Safety failure", detail: "At least one gating failure needs review" };
  if (state === "inconclusive") return { label: "Inconclusive", detail: "At least one provider call did not complete" };
  return { label: "Degraded", detail: "At least one semantic case did not pass" };
}

function evaluationOutcomeLabel(value: string): string {
  if (value === "hard_failure") return "Hard failure";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function evaluationFailureDetail(item: IntakeEvaluationReportV1["providers"][number]["cases"][number]): string {
  if (item.hardFailures.length > 0) return item.hardFailures.join(", ").replaceAll("_", " ");
  if (item.harnessFailureCode) return item.harnessFailureCode.replaceAll("_", " ");
  return item.outcome === "fail" ? "Semantic mismatch" : "No completed provider result";
}

async function requestEvaluationReports(reportId?: string): Promise<unknown> {
  const response: unknown = await chrome.runtime.sendMessage({
    type: "INTAKE_EVALUATION_REPORTS_REQUEST",
    ...(reportId ? { reportId } : {}),
  });
  if (typeof response !== "object" || response === null || Array.isArray(response)) {
    throw new Error("reports_unavailable");
  }
  const bridge = response as Partial<IntakeEvaluationBridgeResponse>;
  if (bridge.ok !== true || bridge.status !== 200 || !("body" in bridge)) {
    throw new Error("reports_unavailable");
  }
  return bridge.body;
}

function renderEvaluationNotice(
  title: string,
  copy: string,
  options: { retry?: boolean; empty?: boolean } = {},
): void {
  if (!reportContent) return;
  clearElement(reportContent);
  const state = document.createElement("section");
  state.className = `evaluation-notice${options.empty ? " empty" : " unavailable"}`;
  state.setAttribute("role", "status");
  const marker = document.createElement("span");
  marker.className = "evaluation-notice-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = options.empty ? "○" : "!";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = copy;
  state.append(marker, heading, paragraph);
  if (options.retry) {
    state.append(evaluationButton("Try again", "evaluation-action", () => { void loadEvaluationReports(); }));
  }
  reportContent.append(state);
}

function renderEvaluationLoading(target: HTMLElement, copy = "Loading evaluation evidence…"): void {
  clearElement(target);
  const loading = document.createElement("div");
  loading.className = "evaluation-loading";
  loading.setAttribute("role", "status");
  loading.textContent = copy;
  target.append(loading);
}

function appendEvaluationMetric(parent: HTMLElement, label: string, value: string): void {
  const metric = document.createElement("div");
  metric.className = "evaluation-metric";
  const metricValue = document.createElement("strong");
  metricValue.textContent = value;
  const metricLabel = document.createElement("span");
  metricLabel.textContent = label;
  metric.append(metricValue, metricLabel);
  parent.append(metric);
}

function renderProviderCard(provider: IntakeEvaluationReportV1["providers"][number]): HTMLElement {
  const state = intakeProviderDisplayState(provider);
  const stateCopy = evaluationStateCopy(state);
  const card = document.createElement("section");
  card.className = `evaluation-provider ${state}`;
  card.setAttribute("aria-label", `Provider ${provider.providerId}: ${stateCopy.label}`);

  const heading = document.createElement("div");
  heading.className = "evaluation-provider-heading";
  const identity = document.createElement("div");
  const providerName = document.createElement("h3");
  providerName.textContent = provider.providerId;
  const providerDetail = document.createElement("p");
  providerDetail.textContent = stateCopy.detail;
  identity.append(providerName, providerDetail);
  const badge = document.createElement("span");
  badge.className = "evaluation-badge";
  badge.textContent = stateCopy.label;
  heading.append(identity, badge);

  const score = document.createElement("div");
  score.className = "evaluation-score";
  const scoreValue = document.createElement("strong");
  scoreValue.textContent = String(provider.averageScore);
  const scoreLabel = document.createElement("span");
  scoreLabel.textContent = "/100 average";
  score.append(scoreValue, scoreLabel);

  const outcomes = document.createElement("div");
  outcomes.className = "evaluation-outcomes";
  for (const [label, value, tone] of [
    ["Pass", provider.outcomes.pass, "pass"],
    ["Fail", provider.outcomes.fail, "fail"],
    ["Hard", provider.outcomes.hardFailure, "hard"],
    ["Unknown", provider.outcomes.inconclusive, "unknown"],
  ] as const) {
    const item = document.createElement("div");
    item.className = `evaluation-outcome ${tone}`;
    const count = document.createElement("strong");
    count.textContent = String(value);
    const copy = document.createElement("span");
    copy.textContent = label;
    item.append(count, copy);
    outcomes.append(item);
  }

  const metrics = document.createElement("div");
  metrics.className = "evaluation-metrics";
  appendEvaluationMetric(metrics, "p95 latency", evaluationDuration(provider.latency.p95Ms));
  appendEvaluationMetric(metrics, "estimated cost", evaluationCost(provider.usage.estimatedCostUsd));
  appendEvaluationMetric(
    metrics,
    "usage coverage",
    `${provider.usage.reportedCaseCount}/${provider.caseCount}`,
  );

  const caseEvidence = document.createElement("div");
  caseEvidence.className = "evaluation-cases";
  const nonPassing = provider.cases.filter((item) => item.outcome !== "pass");
  const casesHeading = document.createElement("h4");
  casesHeading.textContent = nonPassing.length === 0 ? "Case evidence" : `Needs review · ${nonPassing.length}`;
  caseEvidence.append(casesHeading);
  if (nonPassing.length === 0) {
    const allPassed = document.createElement("p");
    allPassed.textContent = `All ${provider.caseCount} acceptance cases passed.`;
    caseEvidence.append(allPassed);
  } else {
    for (const item of nonPassing) {
      const row = document.createElement("div");
      row.className = `evaluation-case ${item.outcome}`;
      const caseIdentity = document.createElement("div");
      const caseId = document.createElement("strong");
      caseId.textContent = item.inputId;
      const failure = document.createElement("span");
      failure.textContent = evaluationFailureDetail(item);
      caseIdentity.append(caseId, failure);
      const result = document.createElement("div");
      const outcome = document.createElement("strong");
      outcome.textContent = evaluationOutcomeLabel(item.outcome);
      const points = document.createElement("span");
      points.textContent = `${item.score}/100`;
      result.append(outcome, points);
      row.append(caseIdentity, result);
      caseEvidence.append(row);
    }
  }

  card.append(heading, score, outcomes, metrics, caseEvidence);
  return card;
}

function renderEvaluationReport(report: IntakeEvaluationReportV1, target: HTMLElement): void {
  clearElement(target);
  const overview = document.createElement("section");
  overview.className = "evaluation-overview";
  const eyebrow = document.createElement("span");
  eyebrow.className = "evaluation-eyebrow";
  eyebrow.textContent = "Offline acceptance evidence";
  const heading = document.createElement("h2");
  heading.textContent = "Model evaluation report";
  const metadata = document.createElement("p");
  metadata.textContent = `${evaluationTimestamp(report.createdAt)} · ${report.corpusCaseCount} cases · ${report.providers.length} providers`;
  const boundary = document.createElement("div");
  boundary.className = "evaluation-boundary";
  boundary.textContent = "Models cannot confirm specifications, change GTM, or prove platform receipt.";
  overview.append(eyebrow, heading, metadata, boundary);
  target.append(overview);
  for (const provider of report.providers) target.append(renderProviderCard(provider));
}

async function loadEvaluationDetail(reportId: string, target: HTMLElement, sequence: number): Promise<void> {
  renderEvaluationLoading(target, "Loading case evidence…");
  try {
    const raw = await requestEvaluationReports(reportId);
    const report = decodeIntakeEvaluationDetailResponse(raw);
    if (!report || report.id !== reportId) throw new Error("reports_unavailable");
    if (sequence !== reportRequestSequence || reportPanel?.hidden) return;
    renderEvaluationReport(report, target);
  } catch {
    if (sequence !== reportRequestSequence || reportPanel?.hidden) return;
    renderEvaluationNotice(
      "Reports unavailable",
      "The local report API could not be reached or its stored evidence failed validation. No model call was started.",
      { retry: true },
    );
  }
}

function reportOptionLabel(report: IntakeEvaluationReportSummaryV1): string {
  return `${evaluationTimestamp(report.createdAt)} · ${report.id}`;
}

async function loadEvaluationReports(): Promise<void> {
  if (!reportContent || reportPanel?.hidden) return;
  const sequence = ++reportRequestSequence;
  renderEvaluationLoading(reportContent);
  try {
    const raw = await requestEvaluationReports();
    const reports = decodeIntakeEvaluationListResponse(raw);
    if (!reports) throw new Error("reports_unavailable");
    if (sequence !== reportRequestSequence || reportPanel?.hidden) return;
    if (reports.length === 0) {
      renderEvaluationNotice(
        "No model evaluations yet",
        "Run the owner-only backend evaluation workflow when you are ready. This panel can read reports, but it cannot start a model call.",
        { empty: true },
      );
      return;
    }

    clearElement(reportContent);
    const controls = document.createElement("div");
    controls.className = "evaluation-controls";
    const label = document.createElement("label");
    label.textContent = "Evaluation report";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Evaluation report");
    for (const report of reports) {
      const option = document.createElement("option");
      option.value = report.id;
      option.textContent = reportOptionLabel(report);
      select.append(option);
    }
    label.append(select);
    controls.append(label);
    const detail = document.createElement("div");
    detail.className = "evaluation-detail";
    reportContent.append(controls, detail);
    select.addEventListener("change", () => {
      const detailSequence = ++reportRequestSequence;
      void loadEvaluationDetail(select.value, detail, detailSequence);
    });
    await loadEvaluationDetail(reports[0]!.id, detail, sequence);
  } catch {
    if (sequence !== reportRequestSequence || reportPanel?.hidden) return;
    renderEvaluationNotice(
      "Reports unavailable",
      "The local report API could not be reached or its stored evidence failed validation. No model call was started.",
      { retry: true },
    );
  }
}

function setEvaluationPanelOpen(open: boolean, returnFocus = true): void {
  if (!reportPanel || !reportToggle || !responseList || !composer) return;
  reportPanel.hidden = !open;
  reportToggle.setAttribute("aria-expanded", String(open));
  responseList.inert = open;
  const composerRegion = composer.closest<HTMLElement>(".composer");
  if (composerRegion) composerRegion.inert = open;
  if (open) {
    preferences.width = Math.max(preferences.width, 440);
    preferences.height = Math.max(preferences.height, 560);
    applyPreferences();
    persistPreferences();
    reportPanel.querySelector<HTMLElement>("h2")?.focus();
    void loadEvaluationReports();
  } else {
    reportRequestSequence += 1;
    if (returnFocus) reportToggle.focus();
  }
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
      .drag { position: relative; cursor: grab; display: flex; justify-content: space-between; align-items: center; padding: 0 9px; user-select: none; }
      .drag::before { content: ""; position: absolute; left: 50%; width: 34px; height: 3px; border-radius: 99px; transform: translateX(-50%); background: rgba(255,255,255,.16); }
      .drag:active { cursor: grabbing; }
      button { border: 0; cursor: pointer; font: inherit; }
      .icon { width: 24px; height: 24px; border-radius: 50%; color: #aab4bc; background: transparent; font-size: 17px; }
      .icon:hover { color: white; background: rgba(255,255,255,.08); }
      .reports-toggle { position: relative; z-index: 1; padding: 3px 8px; border: 1px solid rgba(167,243,208,.16); border-radius: 999px; color: #bcd2c8; background: rgba(18,29,25,.52); font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .reports-toggle:hover, .reports-toggle[aria-expanded="true"] { color: #e8fff3; border-color: rgba(167,243,208,.38); background: rgba(40,72,61,.68); }
      .messages { overflow: auto; padding: 4px 16px 12px; display: flex; flex-direction: column; gap: 10px; }
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
      .evidence-stage span { display: grid; align-content: start; gap: 1px; padding-bottom: 8px; }
      .evidence-stage strong { color: #e8efec; font-size: 12px; font-weight: 600; }
      .evidence-stage small { color: #89969e; font-size: 10px; }
      .composer { margin: 0 12px 12px; padding: 6px 6px 6px 12px; display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 8px; border: 1px solid rgba(255,255,255,.14); border-radius: 15px; background: rgba(31,39,45,.72); box-shadow: inset 0 1px 0 rgba(255,255,255,.035); transition: border-color .16s ease, background .16s ease, box-shadow .16s ease; }
      .composer:focus-within { border-color: rgba(167,243,208,.38); background: rgba(34,43,49,.88); box-shadow: 0 0 0 3px rgba(167,243,208,.06), inset 0 1px 0 rgba(255,255,255,.05); }
      textarea { resize: none; min-height: 38px; max-height: 120px; padding: 8px 0; border: 0; outline: 0; color: white; background: transparent; font: inherit; }
      textarea::placeholder { color: #87939c; }
      .send { width: 38px; height: 38px; border-radius: 12px; color: #0c1b15; background: linear-gradient(145deg, #c4fae0, #8de8bd); box-shadow: 0 5px 16px rgba(86,220,157,.16), inset 0 1px 0 rgba(255,255,255,.5); font-size: 20px; transition: transform .15s ease, box-shadow .15s ease; }
      .send:hover { transform: translateY(-1px); box-shadow: 0 7px 20px rgba(86,220,157,.24), inset 0 1px 0 rgba(255,255,255,.55); }
      .evaluation-panel { position: absolute; z-index: 4; inset: 30px 0 0; overflow: hidden; display: grid; grid-template-rows: auto minmax(0,1fr); color: #eef4f1; background: linear-gradient(160deg, #141b1f, #0a0f12); border-top: 1px solid rgba(255,255,255,.08); }
      .evaluation-panel[hidden] { display: none; }
      .evaluation-panel-header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 16px 12px; border-bottom: 1px solid rgba(255,255,255,.08); background: #1a2227; }
      .evaluation-panel-header span { display: block; color: #83c8a7; font-size: 9px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
      .evaluation-panel-header h2 { margin: 1px 0 0; outline: none; color: #f4f8f6; font-size: 15px; font-weight: 680; }
      .evaluation-panel-actions { display: flex; gap: 5px; }
      .evaluation-panel-actions button { width: 28px; height: 28px; border-radius: 9px; color: #aeb9b5; background: rgba(255,255,255,.045); }
      .evaluation-panel-actions button:hover, .evaluation-panel-actions button:focus-visible { color: white; background: rgba(255,255,255,.1); outline: 2px solid rgba(167,243,208,.28); outline-offset: 1px; }
      .evaluation-content { min-height: 0; overflow: auto; padding: 14px 16px 20px; display: grid; align-content: start; gap: 12px; }
      .evaluation-loading { min-height: 210px; display: grid; place-items: center; color: #9daaa5; background: linear-gradient(100deg, rgba(45,55,59,.2), rgba(167,243,208,.08), rgba(45,55,59,.2)); background-size: 220% 100%; animation: shimmer 1.15s linear infinite; border: 1px solid rgba(255,255,255,.06); border-radius: 15px; }
      .evaluation-notice { min-height: 300px; padding: 24px; display: grid; place-items: center; align-content: center; gap: 8px; text-align: center; border: 1px solid rgba(255,255,255,.08); border-radius: 17px; background: rgba(26,34,38,.62); }
      .evaluation-notice-marker { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 13px; color: #f6c768; background: rgba(246,199,104,.1); box-shadow: inset 0 0 0 1px rgba(246,199,104,.2); font-size: 17px; font-weight: 750; }
      .evaluation-notice.empty .evaluation-notice-marker { color: #8de8bd; background: rgba(141,232,189,.09); box-shadow: inset 0 0 0 1px rgba(141,232,189,.18); }
      .evaluation-notice h3 { margin: 4px 0 0; color: #f2f6f4; font-size: 15px; }
      .evaluation-notice p { max-width: 310px; margin: 0; color: #98a5a0; font-size: 11px; }
      .evaluation-action { margin-top: 7px; padding: 7px 11px; border: 1px solid rgba(167,243,208,.26); border-radius: 9px; color: #e2faed; background: rgba(40,72,61,.6); font-size: 11px; }
      .evaluation-controls { display: flex; align-items: end; justify-content: space-between; gap: 10px; }
      .evaluation-controls label { width: 100%; display: grid; gap: 4px; color: #8e9b96; font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .evaluation-controls select { width: 100%; min-height: 34px; padding: 6px 30px 6px 9px; border: 1px solid rgba(255,255,255,.11); border-radius: 10px; outline: none; color: #e7efeb; background: #20292d; font: 500 10px/1.2 Inter, ui-sans-serif, system-ui, sans-serif; }
      .evaluation-controls select:focus { border-color: rgba(167,243,208,.42); box-shadow: 0 0 0 3px rgba(167,243,208,.07); }
      .evaluation-detail { display: grid; gap: 12px; }
      .evaluation-overview { padding: 13px; border: 1px solid rgba(141,232,189,.16); border-radius: 15px; background: linear-gradient(145deg, rgba(40,72,61,.3), rgba(22,31,34,.5)); }
      .evaluation-eyebrow { color: #86caaa; font-size: 9px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
      .evaluation-overview h2 { margin: 3px 0 2px; color: #f3f8f5; font-size: 17px; }
      .evaluation-overview p { margin: 0; color: #99a7a1; font-size: 10px; }
      .evaluation-boundary { margin-top: 10px; padding: 8px 9px; border-left: 2px solid #8de8bd; border-radius: 5px 9px 9px 5px; color: #b8c8c1; background: rgba(10,19,16,.48); font-size: 10px; }
      .evaluation-provider { display: grid; gap: 11px; padding: 13px; border: 1px solid rgba(255,255,255,.09); border-radius: 15px; background: rgba(25,33,37,.72); box-shadow: inset 0 1px 0 rgba(255,255,255,.025); }
      .evaluation-provider.hard_failure { border-color: rgba(246,127,127,.3); }
      .evaluation-provider.inconclusive { border-color: rgba(246,199,104,.28); }
      .evaluation-provider-heading { display: flex; align-items: start; justify-content: space-between; gap: 10px; }
      .evaluation-provider-heading h3 { margin: 0; color: #f0f5f2; font-size: 13px; overflow-wrap: anywhere; }
      .evaluation-provider-heading p { margin: 2px 0 0; color: #87958f; font-size: 9px; }
      .evaluation-badge { flex: none; padding: 3px 7px; border-radius: 999px; color: #9cf0c5; background: rgba(63,130,96,.18); box-shadow: inset 0 0 0 1px rgba(141,232,189,.2); font-size: 9px; font-weight: 700; }
      .hard_failure .evaluation-badge { color: #ffaaaa; background: rgba(137,45,45,.18); box-shadow: inset 0 0 0 1px rgba(246,127,127,.25); }
      .inconclusive .evaluation-badge, .degraded .evaluation-badge { color: #f6d58f; background: rgba(133,96,32,.18); box-shadow: inset 0 0 0 1px rgba(246,199,104,.24); }
      .evaluation-score { display: flex; align-items: baseline; gap: 4px; }
      .evaluation-score strong { color: #f5faf7; font-size: 27px; line-height: 1; letter-spacing: -.04em; }
      .evaluation-score span { color: #7f8d87; font-size: 9px; }
      .evaluation-outcomes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
      .evaluation-outcome { padding: 6px; display: grid; gap: 1px; border-radius: 9px; background: rgba(255,255,255,.035); }
      .evaluation-outcome strong { color: #dfe8e3; font-size: 13px; }
      .evaluation-outcome span { color: #7e8b86; font-size: 8px; text-transform: uppercase; }
      .evaluation-outcome.pass strong { color: #8de8bd; }
      .evaluation-outcome.fail strong, .evaluation-outcome.unknown strong { color: #f6c768; }
      .evaluation-outcome.hard strong { color: #f67f7f; }
      .evaluation-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
      .evaluation-metric { min-width: 0; display: grid; gap: 1px; }
      .evaluation-metric strong { overflow: hidden; color: #dce5e0; font-size: 10px; text-overflow: ellipsis; }
      .evaluation-metric span { color: #77857f; font-size: 8px; text-transform: uppercase; }
      .evaluation-cases { padding-top: 9px; display: grid; gap: 5px; border-top: 1px solid rgba(255,255,255,.07); }
      .evaluation-cases h4 { margin: 0 0 2px; color: #a9b7b0; font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
      .evaluation-cases > p { margin: 0; color: #8c9a94; font-size: 10px; }
      .evaluation-case { padding: 7px 8px; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; border-radius: 9px; background: rgba(255,255,255,.03); }
      .evaluation-case > div { min-width: 0; display: grid; gap: 1px; }
      .evaluation-case > div:last-child { text-align: right; }
      .evaluation-case strong { overflow-wrap: anywhere; color: #dce5e0; font-size: 9px; }
      .evaluation-case span { color: #7f8d87; font-size: 8px; }
      .evaluation-case.hard_failure > div:last-child strong { color: #f67f7f; }
      .evaluation-case.fail > div:last-child strong, .evaluation-case.inconclusive > div:last-child strong { color: #f6c768; }
      .assistant.collapsed { width: 48px !important; height: 48px !important; min-width: 48px; min-height: 48px; resize: none; display: grid; place-items: center; border-radius: 16px; border-color: rgba(255,255,255,.24); background: linear-gradient(145deg, rgba(48,58,67,.76), rgba(17,23,28,.7)); box-shadow: 0 12px 34px rgba(0,0,0,.3), 0 0 0 1px rgba(167,243,208,.05), inset 0 1px 0 rgba(255,255,255,.14); backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%); }
      .collapsed .drag, .collapsed .messages, .collapsed .composer { display: none; }
      .orb { display: none; position: relative; width: 100%; height: 100%; border-radius: 16px; color: transparent; background: transparent; }
      .orb::before { content: ""; position: absolute; inset: 13px; border-radius: 7px; background: conic-gradient(from 210deg, #8de8bd, #8bbcf6, #bd9af8, #8de8bd); filter: saturate(.78); box-shadow: 0 0 16px rgba(141,232,189,.22); }
      .orb::after { content: ""; position: absolute; inset: 17px; border-radius: 5px; background: rgba(17,23,28,.9); box-shadow: inset 0 1px 0 rgba(255,255,255,.2); }
      .collapsed .orb { display: block; }
      .collapsed:hover { transform: translateY(-2px); border-color: rgba(167,243,208,.32); box-shadow: 0 16px 42px rgba(0,0,0,.34), 0 0 24px rgba(141,232,189,.1), inset 0 1px 0 rgba(255,255,255,.16); }
      @keyframes shimmer { to { background-position: -120% 0; } }
      @media (max-width: 520px) { .evaluation-outcomes, .evaluation-metrics { grid-template-columns: repeat(2, 1fr); } }
      @media (prefers-reduced-motion: reduce) { .assistant, .send { transition: none; } .message.streaming:empty, .evaluation-loading { animation: none; } }
    </style>
    <section class="assistant collapsed" aria-label="Tracking assistant">
      <div class="drag" aria-label="Drag assistant"><button class="reports-toggle" aria-label="Open model evaluation reports" aria-expanded="false">Evals</button><button class="icon collapse" aria-label="Collapse assistant">−</button></div>
      <div class="messages" aria-live="polite"><div class="message bot">What do you want to track on this page?</div></div>
      <div class="composer"><textarea aria-label="Tracking request" placeholder="Describe an action or outcome…"></textarea><button class="send" aria-label="Send request">↑</button></div>
      <section class="evaluation-panel" aria-label="Model evaluation reports" hidden>
        <header class="evaluation-panel-header">
          <div><span>Evidence lab</span><h2 tabindex="-1">Model evaluations</h2></div>
          <div class="evaluation-panel-actions"><button class="evaluation-refresh" aria-label="Refresh model evaluation reports">↻</button><button class="evaluation-close" aria-label="Close model evaluation reports">×</button></div>
        </header>
        <div class="evaluation-content"></div>
      </section>
      <button class="orb" aria-label="Open tracking assistant">G</button>
    </section>`;
  frame = shadow.querySelector<HTMLElement>(".assistant")!;
  responseList = shadow.querySelector<HTMLElement>(".messages")!;
  composer = shadow.querySelector<HTMLTextAreaElement>("textarea")!;
  reportPanel = shadow.querySelector<HTMLElement>(".evaluation-panel")!;
  reportContent = shadow.querySelector<HTMLElement>(".evaluation-content")!;
  reportToggle = shadow.querySelector<HTMLButtonElement>(".reports-toggle")!;
  shadow.querySelector(".orb")?.addEventListener("click", () => setCollapsed(false));
  shadow.querySelector(".collapse")?.addEventListener("click", () => setCollapsed(true));
  reportToggle.addEventListener("click", () => setEvaluationPanelOpen(reportPanel?.hidden ?? true));
  shadow.querySelector(".evaluation-close")?.addEventListener("click", () => setEvaluationPanelOpen(false));
  shadow.querySelector(".evaluation-refresh")?.addEventListener("click", () => { void loadEvaluationReports(); });
  shadow.querySelector(".send")?.addEventListener("click", submitPrompt);
  composer.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitPrompt(); }
  });
  enableDragging(shadow.querySelector<HTMLElement>(".drag")!);
  new ResizeObserver(() => {
    if (!frame || preferences.collapsed) return;
    const bounds = frame.getBoundingClientRect();
    preferences.width = Math.round(bounds.width);
    preferences.height = Math.round(bounds.height);
    persistPreferences();
  }).observe(frame);
  document.documentElement.append(host);
  applyPreferences();
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
  window.setTimeout(() => finishFormVerification(active.intake, startedAt), 800);
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
