import {
  evaluateEvidence,
  type BrowserEvidence,
  type NavigationElement,
  type SetupProposal,
} from "@gtm-observability/core";

const apiBase = "http://127.0.0.1:8787";
let pageUrl = "";
let navigation: NavigationElement[] = [];
let proposal: SetupProposal | undefined;
const evidence = new Map<string, BrowserEvidence>();
let googleConnected = false;

interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  trackingSetupWritesEnabled: boolean;
}

interface GtmDestination {
  accountId: string;
  containerId: string;
  publicId: string;
  name: string;
  accountName: string;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

const status = byId<HTMLParagraphElement>("status");
const scopeCard = byId<HTMLElement>("scope-card");
const configurationCard = byId<HTMLElement>("configuration-card");
const proposalCard = byId<HTMLElement>("proposal-card");
const verificationCard = byId<HTMLElement>("verification-card");
const googleStatus = byId<HTMLParagraphElement>("google-status");
const googleDestination = byId<HTMLElement>("google-destination");
const destinationSelect = byId<HTMLSelectElement>("gtm-destination");
const createGtm = byId<HTMLButtonElement>("create-gtm");
const connectGoogle = byId<HTMLButtonElement>("connect-google");

function setStatus(message: string, error = false): void {
  status.textContent = message;
  status.classList.toggle("error", error);
}

function selectedDestination(): GtmDestination | undefined {
  const option = destinationSelect.selectedOptions[0];
  if (!option?.value) return undefined;
  return JSON.parse(option.value) as GtmDestination;
}

async function refreshGoogle(): Promise<void> {
  try {
    const statusResponse = await fetch(`${apiBase}/api/google/status`);
    const state = await statusResponse.json() as GoogleStatus;
    if (!state.configured) {
      googleStatus.textContent = "The local backend needs Google OAuth configuration.";
      return;
    }
    if (!state.connected) {
      googleConnected = false;
      connectGoogle.textContent = "Connect Google";
      googleStatus.textContent = "Connect your Google account to choose a GTM container.";
      return;
    }
    googleConnected = true;
    connectGoogle.textContent = "Refresh";
    googleStatus.textContent = "Connected. Loading your GTM containers…";
    const accountsResponse = await fetch(`${apiBase}/api/google/accounts`);
    const body = await accountsResponse.json() as {
      accounts?: Array<{ accountId: string; name: string; containers: Array<Omit<GtmDestination, "accountName">> }>;
      error?: string;
    };
    if (!accountsResponse.ok || !body.accounts) throw new Error(body.error ?? "Unable to load containers.");
    const destinations = body.accounts.flatMap((account) => account.containers.map((container) => ({
      ...container,
      accountName: account.name,
    })));
    destinationSelect.replaceChildren(...destinations.map((destination) => {
      const option = document.createElement("option");
      option.value = JSON.stringify(destination);
      option.textContent = `${destination.accountName} — ${destination.name} (${destination.publicId})`;
      return option;
    }));
    googleDestination.classList.toggle("hidden", destinations.length === 0);
    createGtm.disabled = !state.trackingSetupWritesEnabled || destinations.length === 0;
    googleStatus.textContent = destinations.length === 0
      ? "Connected, but no web containers were found."
      : state.trackingSetupWritesEnabled
        ? "Connected. You will approve any GTM changes before creation."
        : "Connected read-only. Setup creation is disabled on the local backend.";
  } catch (error) {
    googleStatus.textContent = error instanceof Error ? error.message : "Unable to check Google connection.";
  }
}

async function activeTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const tab = tabs.find((candidate) => candidate.active && candidate.url?.startsWith("http")) ??
    tabs.find((candidate) => candidate.url?.startsWith("http"));
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
  for (const item of proposal.navigation) {
    const verdict = evaluateEvidence(item, evidence.get(item.id));
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
}

byId<HTMLButtonElement>("scan").addEventListener("click", async () => {
  try {
    setStatus("Inspecting this page…");
    const tab = await activeTab();
    await ensureContentScript(tab.id!);
    const result = (await chrome.tabs.sendMessage(tab.id!, { type: "SCAN_NAVIGATION" })) as {
      pageUrl: string;
      navigation: NavigationElement[];
    };
    pageUrl = result.pageUrl;
    navigation = result.navigation;
    if (navigation.length === 0) throw new Error("No header, navigation, or footer links were found.");
    renderNavigation();
    scopeCard.classList.remove("hidden");
    configurationCard.classList.remove("hidden");
    proposalCard.classList.add("hidden");
    verificationCard.classList.add("hidden");
    setStatus(`Found ${navigation.length} candidate navigation element(s). Confirm the scope below.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unable to inspect this page.", true);
  }
});

connectGoogle.addEventListener("click", async () => {
  if (!googleConnected) {
    await chrome.tabs.create({ url: `${apiBase}/api/google/oauth/start` });
    googleStatus.textContent = "Finish Google authorization, then click Connect Google again to refresh.";
  }
  await refreshGoogle();
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
    const destination = selectedDestination();
    setStatus("Generating a scoped GTM setup…");
    const response = await fetch(`${apiBase}/api/setups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: byId<HTMLTextAreaElement>("intent").value,
        pageUrl,
        measurementId: byId<HTMLInputElement>("measurement-id").value.trim(),
        navigation: confirmed,
        container: {
          accountId: destination?.accountId ?? "0",
          containerId: destination?.containerId ?? "0",
          publicId: destination?.publicId ?? byId<HTMLInputElement>("container-id").value.trim(),
          name: destination?.name ?? "GTM Observability navigation setup",
        },
      }),
    });
    const body = (await response.json()) as SetupProposal | { error: string };
    if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : "Generation failed.");
    proposal = body;
    const checks = byId<HTMLUListElement>("preflight-list");
    checks.replaceChildren(...proposal.preflight.checks.map((check) => {
      const item = document.createElement("li");
      item.textContent = check;
      return item;
    }));
    proposalCard.classList.remove("hidden");
    setStatus("Preflight passed. Review exactly what will be created before approving it.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unable to generate the setup.", true);
  }
});

createGtm.addEventListener("click", async () => {
  try {
    if (!proposal) throw new Error("Generate and review a setup first.");
    const destination = selectedDestination();
    if (!destination) throw new Error("Choose a GTM destination container.");
    createGtm.disabled = true;
    const result = byId<HTMLParagraphElement>("creation-result");
    result.textContent = "Creating an isolated, unpublished GTM workspace…";
    const response = await fetch(
      `${apiBase}/api/google/accounts/${destination.accountId}/containers/${destination.containerId}/tracking-setups`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval: "create-isolated-tracking-setup",
          workspaceName: `GTM Observability - Navigation - ${new Date().toISOString().slice(0, 19)}`,
          measurementId: byId<HTMLInputElement>("measurement-id").value.trim(),
          linkUrls: proposal.navigation.map((item) => item.href),
        }),
      },
    );
    const body = await response.json() as { workspace?: { name: string }; error?: string };
    if (!response.ok) throw new Error(body.error ?? "Unable to create the GTM setup.");
    result.textContent = `Created in unpublished workspace “${body.workspace?.name ?? "GTM Observability"}”.`;
    setStatus("GTM setup created. Nothing has been published; continue to Preview and verification.");
  } catch (error) {
    byId<HTMLParagraphElement>("creation-result").textContent =
      error instanceof Error ? error.message : "Unable to create the GTM setup.";
    createGtm.disabled = false;
  }
});

byId<HTMLButtonElement>("download").addEventListener("click", () => {
  if (!proposal) return;
  const blob = new Blob([JSON.stringify(proposal.containerFile, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `gtm-navigation-${new URL(proposal.pageUrl).hostname}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});

byId<HTMLButtonElement>("verify").addEventListener("click", async () => {
  try {
    if (!proposal) return;
    const tab = await activeTab();
    await ensureContentScript(tab.id!);
    await chrome.tabs.sendMessage(tab.id!, { type: "START_VERIFICATION", navigation: proposal.navigation });
    evidence.clear();
    verificationCard.classList.remove("hidden");
    renderVerification();
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

void refreshGoogle();
