import {
  evaluateEvidence,
  type BrowserEvidence,
  type NavigationElement,
  type SetupProposal,
} from "@trimtale/core";

declare const __GTM_OBSERVABILITY_API_BASE__: string;

const apiBase = __GTM_OBSERVABILITY_API_BASE__;
const targetTabId = Number.parseInt(new URLSearchParams(location.search).get("tabId") ?? "", 10);
const siteConfigPrefix = "siteConfig:";
const proposalSessionKey = Number.isFinite(targetTabId) ? `proposal:${targetTabId}` : "";
const verificationSessionKey = Number.isFinite(targetTabId) ? `verification:${targetTabId}` : "";
let pageUrl = "";
let navigation: NavigationElement[] = [];
let proposal: SetupProposal | undefined;
let pageSignals: PageTrackingSignals = { gtmContainers: [], ga4MeasurementIds: [] };
const evidence = new Map<string, BrowserEvidence>();

interface SiteConfig {
  measurementId: string;
  containerId: string;
}

interface PageTrackingSignals {
  gtmContainers: string[];
  ga4MeasurementIds: string[];
}

interface DownloadPayload {
  filename: string;
  content: string;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

const status = byId<HTMLParagraphElement>("status");
const siteHost = byId<HTMLParagraphElement>("site-host");
const configState = byId<HTMLElement>("config-state");
const scopeSummary = byId<HTMLParagraphElement>("scope-summary");
const configSummary = byId<HTMLParagraphElement>("config-summary");
const detectedGtm = byId<HTMLElement>("detected-gtm");
const detectedGa4 = byId<HTMLElement>("detected-ga4");
const configReadiness = byId<HTMLElement>("config-readiness");
const scopeCard = byId<HTMLElement>("scope-card");
const configurationCard = byId<HTMLElement>("configuration-card");
const proposalCard = byId<HTMLElement>("proposal-card");
const importCard = byId<HTMLElement>("import-card");
const verificationCard = byId<HTMLElement>("verification-card");
const generateButton = byId<HTMLButtonElement>("generate");
const downloadReportButton = byId<HTMLButtonElement>("download-report");
const progressSteps = {
  discover: byId<HTMLElement>("step-discover"),
  configure: byId<HTMLElement>("step-configure"),
  import: byId<HTMLElement>("step-import"),
  verify: byId<HTMLElement>("step-verify"),
};

function setStatus(message: string, error = false): void {
  status.textContent = message;
  status.classList.toggle("error", error);
}

function setProgress(active: keyof typeof progressSteps): void {
  const order = ["discover", "configure", "import", "verify"] as const;
  const activeIndex = order.indexOf(active);
  for (const [index, key] of order.entries()) {
    progressSteps[key].classList.toggle("active", index === activeIndex);
    progressSteps[key].classList.toggle("done", index < activeIndex);
  }
}

function setSiteContext(url: string): void {
  const parsed = new URL(url);
  siteHost.textContent = parsed.hostname;
}

function setConfigState(config?: SiteConfig): void {
  if (!config) {
    configState.textContent = "Detecting";
    configState.classList.remove("ready");
    configSummary.textContent = "Detected and saved automatically for this site.";
    return;
  }
  configState.textContent = "Ready";
  configState.classList.add("ready");
  configSummary.textContent = `Using ${config.containerId.toUpperCase()} and ${config.measurementId.toUpperCase()}.`;
}

function currentConfig(): SiteConfig {
  return {
    measurementId: byId<HTMLInputElement>("measurement-id").value.trim(),
    containerId: byId<HTMLInputElement>("container-id").value.trim(),
  };
}

function describeSignal(ids: string[], configuredId: string): { text: string; className: "match" | "mismatch" | "unknown" } {
  const normalized = configuredId.trim().toUpperCase();
  if (ids.length === 0) return { text: "None found", className: "unknown" };
  if (!normalized) return { text: ids.join(", "), className: "unknown" };
  return ids.includes(normalized)
    ? { text: `${normalized} matched`, className: "match" }
    : { text: `${ids.join(", ")} found`, className: "mismatch" };
}

function renderTrackingSignals(): void {
  const containerId = byId<HTMLInputElement>("container-id").value;
  const measurementId = byId<HTMLInputElement>("measurement-id").value;
  const gtm = describeSignal(pageSignals.gtmContainers, containerId);
  const ga4 = describeSignal(pageSignals.ga4MeasurementIds, measurementId);
  detectedGtm.textContent = gtm.text;
  detectedGtm.className = gtm.className;
  detectedGa4.textContent = ga4.text;
  detectedGa4.className = ga4.className;
}

function autoFillDetectedConfig(): void {
  const measurement = byId<HTMLInputElement>("measurement-id");
  const container = byId<HTMLInputElement>("container-id");
  if (!container.value.trim() && pageSignals.gtmContainers.length === 1) {
    container.value = pageSignals.gtmContainers[0]!;
  }
  if (!measurement.value.trim() && pageSignals.ga4MeasurementIds.length === 1) {
    measurement.value = pageSignals.ga4MeasurementIds[0]!;
  }
}

function configReady(): boolean {
  const { measurementId, containerId } = currentConfig();
  return Boolean(measurementId && containerId);
}

function updateConfigReadiness(): void {
  const { measurementId, containerId } = currentConfig();
  generateButton.disabled = !measurementId || !containerId;
  configReadiness.classList.toggle("ready", Boolean(measurementId && containerId));
  configReadiness.classList.toggle("blocked", Boolean(containerId && !measurementId));
  if (measurementId && containerId) {
    configReadiness.textContent = "Ready. Site configuration was inferred or restored for this page.";
    setConfigState({ measurementId, containerId });
    return;
  }
  setConfigState(undefined);
  if (containerId && !measurementId) {
    configReadiness.textContent = "GTM is installed, but GA4 is not visible from the page. The next product step is GTM account connection to resolve the destination automatically.";
    return;
  }
  if (!containerId && measurementId) {
    configReadiness.textContent = "GA4 is visible, but no GTM container was detected on this page.";
    return;
  }
  configReadiness.textContent = "No GTM or GA4 configuration is visible yet.";
}

function trackingSignalStatus(config: SiteConfig): string {
  const containerId = config.containerId.toUpperCase();
  const measurementId = config.measurementId.toUpperCase();
  const gtmMatched = pageSignals.gtmContainers.includes(containerId);
  const ga4Matched = pageSignals.ga4MeasurementIds.includes(measurementId);
  if (gtmMatched && ga4Matched) return "Detected matching GTM and GA4 IDs on this page.";
  if (gtmMatched) return "Detected matching GTM on this page; GA4 was not visible in page source.";
  if (pageSignals.gtmContainers.length > 0) return "Detected a different GTM container on this page.";
  return "No GTM container was visible on this page.";
}

function siteConfigKey(url: string): string {
  return `${siteConfigPrefix}${new URL(url).hostname}`;
}

async function loadSiteConfig(url: string): Promise<SiteConfig | undefined> {
  const result = await chrome.storage.local.get(siteConfigKey(url));
  const stored = result[siteConfigKey(url)] as Partial<SiteConfig> | undefined;
  if (!stored?.measurementId || !stored?.containerId) return undefined;
  return { measurementId: stored.measurementId, containerId: stored.containerId };
}

async function saveSiteConfig(url: string, config: SiteConfig): Promise<void> {
  await chrome.storage.local.set({ [siteConfigKey(url)]: config });
}

async function prefillSiteConfig(url: string): Promise<boolean> {
  const stored = await loadSiteConfig(url);
  setConfigState(stored);
  if (!stored) return false;
  byId<HTMLInputElement>("measurement-id").value = stored.measurementId;
  byId<HTMLInputElement>("container-id").value = stored.containerId;
  renderTrackingSignals();
  updateConfigReadiness();
  return true;
}

async function activeTab(): Promise<chrome.tabs.Tab> {
  if (!Number.isFinite(targetTabId)) {
    throw new Error("Open Trimtale from the toolbar on the site you want to inspect.");
  }
  const tab = await chrome.tabs.get(targetTabId);
  if (!tab.url?.startsWith("http")) throw new Error("Open a public HTTP or HTTPS website first.");
  if (!tab?.id) throw new Error("Open a public HTTP or HTTPS website first.");
  return tab;
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "GET_EVIDENCE" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content-script.js"] });
  }
}

function selectedNavigation(): NavigationElement[] {
  const selected = new Set(
    [...document.querySelectorAll<HTMLInputElement>("input[data-navigation-id]:checked")]
      .map((input) => input.dataset.navigationId),
  );
  return navigation.filter((item) => selected.has(item.id));
}

function renderNavigation(): void {
  const list = byId<HTMLDivElement>("navigation-list");
  list.replaceChildren();
  scopeSummary.textContent = navigation.length === 1
    ? "1 navigation element found."
    : `${navigation.length} navigation elements found.`;
  for (const item of navigation) {
    const row = document.createElement("label");
    row.className = "navigation-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.navigationId = item.id;
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = item.text;
    const href = document.createElement("small");
    href.textContent = item.href;
    copy.append(title, href);
    const area = document.createElement("span");
    area.className = "area";
    area.textContent = item.area;
    row.append(checkbox, copy, area);
    list.append(row);
  }
}

function renderVerification(): void {
  if (!proposal) return;
  const list = byId<HTMLDivElement>("verification-list");
  list.replaceChildren();
  const counts = { passed: 0, failed: 0, incomplete: 0 };
  for (const item of proposal.navigation) {
    const verdict = evaluateEvidence(item, evidence.get(item.id));
    counts[verdict.status] += 1;
    const row = document.createElement("div");
    row.className = "navigation-item";
    const icon = document.createElement("span");
    icon.textContent = verdict.status === "passed" ? "✓" : verdict.status === "failed" ? "!" : "○";
    icon.className = verdict.status === "passed" ? "result-pass" : verdict.status === "failed" ? "result-fail" : "";
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = item.text;
    const detail = document.createElement("small");
    detail.textContent = verdict.checks.map((check) => check.detail).join(" ");
    copy.append(title, detail);
    const state = document.createElement("span");
    state.className = "area";
    state.textContent = verdict.status;
    row.append(icon, copy, state);
    list.append(row);
  }
  byId<HTMLElement>("summary-passed").textContent = counts.passed.toString();
  byId<HTMLElement>("summary-failed").textContent = counts.failed.toString();
  byId<HTMLElement>("summary-pending").textContent = counts.incomplete.toString();
  downloadReportButton.disabled = evidence.size === 0;
}

function renderProposal(): void {
  if (!proposal) return;
  const checks = byId<HTMLUListElement>("preflight-list");
  checks.replaceChildren(...proposal.preflight.checks.map((check) => {
    const item = document.createElement("li");
    item.textContent = check;
    return item;
  }));
  proposalCard.classList.remove("hidden");
  importCard.classList.remove("hidden");
  setProgress("import");
}

function verificationReport(): string {
  if (!proposal) return "";
  const generatedAt = new Date().toISOString();
  const rows = proposal.navigation.map((item) => {
    const itemEvidence = evidence.get(item.id);
    const verdict = evaluateEvidence(item, itemEvidence);
    return {
      id: item.id,
      text: item.text,
      href: item.href,
      area: item.area,
      status: verdict.status,
      browserVerification: verdict.browserVerification,
      platformConfirmation: verdict.platformConfirmation,
      clickedAt: itemEvidence?.clickedAt,
      observedRequests: itemEvidence?.requests ?? [],
      checks: verdict.checks,
    };
  });
  const summary = rows.reduce(
    (counts, row) => {
      counts[row.status] += 1;
      return counts;
    },
    { passed: 0, failed: 0, incomplete: 0 },
  );

  return JSON.stringify(
    {
      reportType: "gtm-observability-browser-verification",
      generatedAt,
      setupId: proposal.id,
      pageUrl: proposal.pageUrl,
      eventName: proposal.eventName,
      measurementId: proposal.measurementId,
      summary,
      platformConfirmation: "unverified",
      boundary: "Browser evidence does not independently confirm GA4 platform processing.",
      navigation: rows,
    },
    null,
    2,
  );
}

async function downloadJson(filename: string, content: string): Promise<void> {
  (window as Window & { __gtmObservabilityLastDownload?: DownloadPayload }).__gtmObservabilityLastDownload = {
    filename,
    content,
  };

  try {
    const response = await chrome.runtime.sendMessage({ type: "DOWNLOAD_JSON", filename, content }) as
      | { downloadId: number }
      | { error: string };
    if ("downloadId" in response) return;
    if (response?.error) setStatus(response.error, true);
  } catch {
    // Fall back to a browser-initiated download when the service worker is unavailable.
  }

  const url = `data:application/json;charset=utf-8,${encodeURIComponent(content)}`;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

byId<HTMLButtonElement>("scan").addEventListener("click", async () => {
  try {
    setStatus("Inspecting this page…");
    const tab = await activeTab();
    await ensureContentScript(tab.id!);
    const result = (await chrome.tabs.sendMessage(tab.id!, { type: "SCAN_NAVIGATION" })) as {
      pageUrl: string;
      navigation: NavigationElement[];
      signals?: PageTrackingSignals;
    };
    pageUrl = result.pageUrl;
    navigation = result.navigation;
    pageSignals = result.signals ?? { gtmContainers: [], ga4MeasurementIds: [] };
    if (navigation.length === 0) throw new Error("No header, navigation, or footer links were found.");
    setSiteContext(pageUrl);
    renderNavigation();
    const foundSiteConfig = await prefillSiteConfig(pageUrl);
    autoFillDetectedConfig();
    const savedConfig = foundSiteConfig ? currentConfig() : undefined;
    renderTrackingSignals();
    updateConfigReadiness();
    scopeCard.classList.remove("hidden");
    configurationCard.classList.remove("hidden");
    proposalCard.classList.add("hidden");
    importCard.classList.add("hidden");
    verificationCard.classList.add("hidden");
    setStatus(
      savedConfig
        ? `Loaded saved GTM configuration. ${trackingSignalStatus(savedConfig)}`
        : configReady()
          ? `Detected site configuration. ${trackingSignalStatus(currentConfig())}`
          : "Confirm scope. GTM was detected when available; GA4 may require GTM account connection.",
    );
    setProgress("configure");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unable to inspect this page.", true);
  }
});

byId<HTMLButtonElement>("toggle-all").addEventListener("click", (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  const inputs = [...document.querySelectorAll<HTMLInputElement>("input[data-navigation-id]")];
  const shouldSelect = inputs.some((input) => !input.checked);
  inputs.forEach((input) => { input.checked = shouldSelect; });
  button.textContent = shouldSelect ? "Clear all" : "Select all";
});

byId<HTMLButtonElement>("generate").addEventListener("click", async () => {
  try {
    const confirmed = selectedNavigation();
    if (confirmed.length === 0) throw new Error("Confirm at least one navigation element.");
    setStatus("Generating a scoped GTM setup…");
    const { measurementId, containerId } = currentConfig();
    if (!measurementId || !containerId) {
      throw new Error("GTM and GA4 configuration must be inferred, restored, or supplied through the advanced fallback before generation.");
    }
    const response = await fetch(`${apiBase}/api/setups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: byId<HTMLTextAreaElement>("intent").value,
        pageUrl,
        measurementId,
        navigation: confirmed,
        container: {
          accountId: "0",
          containerId: "0",
          publicId: containerId,
          name: "Trimtale navigation setup",
        },
      }),
    });
    const body = (await response.json()) as SetupProposal | { error: string };
    if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : "Generation failed.");
    proposal = body;
    await saveSiteConfig(pageUrl, { measurementId, containerId });
    if (proposalSessionKey) {
      await chrome.storage.local.set({ [proposalSessionKey]: proposal });
    }
    setConfigState({ measurementId, containerId });
    renderTrackingSignals();
    updateConfigReadiness();
    renderProposal();
    setStatus(`${trackingSignalStatus({ measurementId, containerId })} Download the file, import it with Merge, then connect GTM Preview.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unable to generate the setup.", true);
  }
});

byId<HTMLButtonElement>("download").addEventListener("click", () => {
  if (!proposal) return;
  void downloadJson(
    `gtm-navigation-${new URL(proposal.pageUrl).hostname}.json`,
    JSON.stringify(proposal.containerFile, null, 2),
  );
});

downloadReportButton.addEventListener("click", () => {
  if (!proposal || evidence.size === 0) return;
  void downloadJson(`gtm-verification-${new URL(proposal.pageUrl).hostname}.json`, verificationReport());
});

byId<HTMLButtonElement>("verify").addEventListener("click", async () => {
  try {
    if (!proposal) return;
    const tab = await activeTab();
    await ensureContentScript(tab.id!);
    await chrome.tabs.sendMessage(tab.id!, { type: "START_VERIFICATION", navigation: proposal.navigation });
    evidence.clear();
    if (verificationSessionKey) {
      await chrome.storage.local.set({ [verificationSessionKey]: true });
    }
    verificationCard.classList.remove("hidden");
    renderVerification();
    await chrome.tabs.sendMessage(tab.id!, { type: "HIDE_WORKBENCH" });
    setProgress("verify");
    setStatus("Verification started. Click the confirmed links in the GTM Preview tab.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unable to start verification.", true);
  }
});

chrome.runtime.onMessage.addListener((message: { type?: string; evidence?: BrowserEvidence }) => {
  if (message.type !== "VERIFICATION_EVIDENCE" || !message.evidence) return;
  evidence.set(message.evidence.navigationId, message.evidence);
  renderVerification();
});

void (async () => {
  if (!proposalSessionKey || !verificationSessionKey) return;
  const stored = await chrome.storage.local.get([proposalSessionKey, verificationSessionKey]);
  const storedProposal = stored[proposalSessionKey] as SetupProposal | undefined;
  if (!storedProposal) return;

  proposal = storedProposal;
  pageUrl = proposal.pageUrl;
  navigation = proposal.navigation;
  setSiteContext(pageUrl);
  byId<HTMLInputElement>("measurement-id").value = proposal.measurementId;
  byId<HTMLInputElement>("container-id").value = proposal.containerFile.containerVersion.container.publicId;
  setConfigState({
    measurementId: proposal.measurementId,
    containerId: proposal.containerFile.containerVersion.container.publicId,
  });
  renderTrackingSignals();
  updateConfigReadiness();
  renderNavigation();
  scopeCard.classList.remove("hidden");
  configurationCard.classList.remove("hidden");
  renderProposal();

  if (stored[verificationSessionKey]) {
    const result = await chrome.runtime.sendMessage({ type: "GET_TAB_EVIDENCE", tabId: targetTabId }) as {
      evidence?: BrowserEvidence[];
    };
    for (const item of result.evidence ?? []) {
      evidence.set(item.navigationId, item);
    }
    verificationCard.classList.remove("hidden");
    renderVerification();
    setProgress("verify");
    setStatus("Restored verification state for this tab.");
  } else {
    setStatus("Restored the generated setup for this tab.");
  }
})();

byId<HTMLInputElement>("measurement-id").addEventListener("input", () => {
  renderTrackingSignals();
  updateConfigReadiness();
});
byId<HTMLInputElement>("container-id").addEventListener("input", () => {
  renderTrackingSignals();
  updateConfigReadiness();
});
