import type {
  BrowserEvidence,
  NavigationArea,
  NavigationElement,
  SetupProposal,
} from "@gtm-observability/core";

declare global {
  interface Window {
    __gtmObservabilityInstalled?: boolean;
  }
}

interface ScanResponse {
  pageUrl: string;
  title: string;
  navigation: NavigationElement[];
}

type ExtensionRequest =
  | { type: "SCAN_NAVIGATION" }
  | { type: "START_VERIFICATION"; navigation: NavigationElement[] }
  | { type: "GET_EVIDENCE" }
  | { type: "TOGGLE_OVERLAY" };

const analyticsPattern = /(?:google-analytics\.com|analytics\.google\.com)\/g\/collect/i;
const evidence = new Map<string, BrowserEvidence>();
let verificationScope = new Map<string, NavigationElement>();
let overlayHost: HTMLDivElement | undefined;
let overlayProposal: SetupProposal | undefined;
const apiBase = "http://127.0.0.1:8787";

function areaFor(element: Element): NavigationArea {
  if (element.closest("header")) return "header";
  if (element.closest("footer")) return "footer";
  if (element.closest("nav, [role='navigation']")) return "nav";
  return "unknown";
}

function cssEscape(value: string): string {
  return CSS.escape(value);
}

function selectorFor(anchor: HTMLAnchorElement, index: number): string {
  if (anchor.id) return `#${cssEscape(anchor.id)}`;
  const area = anchor.closest("header, footer, nav, [role='navigation']");
  const prefix = area?.tagName.toLowerCase() ?? "body";
  const href = anchor.getAttribute("href");
  if (href) return `${prefix} a[href="${cssEscape(href)}"]`;
  return `${prefix} a:nth-of-type(${index + 1})`;
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
  const candidates = [
    ...document.querySelectorAll<HTMLAnchorElement>(
      "header a[href], nav a[href], [role='navigation'] a[href], footer a[href]",
    ),
  ];
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
      text: (anchor.innerText || anchor.getAttribute("aria-label") || "Untitled link")
        .replace(/\s+/g, " ")
        .trim(),
      href: anchor.href,
      area: areaFor(anchor),
      selector,
    });
  });

  return { pageUrl: location.href, title: document.title, navigation };
}

function markSelection(navigation: NavigationElement[], selected: Set<string>): void {
  document.querySelectorAll<HTMLElement>("[data-gtmo-selected]").forEach((element) => {
    delete element.dataset.gtmoSelected;
  });
  for (const item of navigation) {
    if (!selected.has(item.id)) continue;
    document.querySelectorAll<HTMLElement>(item.selector).forEach((element) => {
      if (element instanceof HTMLAnchorElement && element.href === item.href) {
        element.dataset.gtmoSelected = "true";
      }
    });
  }
}

function createOverlay(): HTMLDivElement {
  const host = document.createElement("div");
  host.id = "gtm-observability-overlay";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .shell { position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(680px, calc(100vw - 32px)); font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #202124; }
      .panel { display: none; max-height: min(560px, calc(100vh - 130px)); overflow: auto; margin-bottom: 10px; padding: 18px; border: 1px solid #e5e7eb; border-radius: 20px; background: rgba(255,255,255,.98); box-shadow: 0 20px 55px rgba(17,24,39,.18); }
      .panel.open { display: grid; gap: 14px; }
      .bar { display: grid; grid-template-columns: 36px 1fr auto; align-items: center; gap: 8px; padding: 10px 10px 10px 14px; border: 1px solid #d9dce1; border-radius: 999px; background: rgba(255,255,255,.98); box-shadow: 0 12px 38px rgba(17,24,39,.18); }
      .logo { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; color: white; background: #1f2937; font: 700 14px/1 system-ui; }
      input, select { box-sizing: border-box; width: 100%; border: 1px solid #d9dce1; border-radius: 10px; padding: 10px; background: white; color: #202124; font: 14px system-ui; }
      .intent { border: 0; outline: 0; padding: 8px 4px; font-size: 15px; }
      button { border: 0; border-radius: 999px; padding: 10px 14px; cursor: pointer; font: 700 13px system-ui; }
      button:disabled { opacity: .45; cursor: not-allowed; }
      .go, .primary { color: white; background: #1f2937; }
      .go { width: 38px; height: 38px; padding: 0; font-size: 18px; }
      .secondary { color: #1f2937; background: #eef0f3; }
      .heading { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
      h2, p { margin: 0; } h2 { font: 700 16px system-ui; } p, .status { color: #667085; font: 12px/1.45 system-ui; }
      .list { display: grid; gap: 7px; max-height: 210px; overflow: auto; }
      .item { display: grid; grid-template-columns: auto 1fr auto; gap: 9px; align-items: start; padding: 9px; border: 1px solid #e5e7eb; border-radius: 11px; font: 12px system-ui; }
      .item small { display: block; max-width: 470px; margin-top: 2px; overflow: hidden; color: #667085; text-overflow: ellipsis; white-space: nowrap; }
      .pill { padding: 2px 7px; border-radius: 999px; background: #f2f4f7; color: #667085; font-size: 10px; text-transform: uppercase; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .field { display: grid; gap: 5px; color: #344054; font: 700 11px system-ui; }
      .review { padding: 11px; border-left: 3px solid #1f2937; border-radius: 8px; background: #f8fafc; color: #475467; font: 12px/1.5 system-ui; }
      .actions { display: flex; justify-content: flex-end; gap: 8px; }
      .hidden { display: none !important; }
    </style>
    <div class="shell">
      <section class="panel" aria-live="polite">
        <div class="heading"><div><h2>Choose what to track</h2><p class="summary"></p></div><button class="close secondary" aria-label="Close">×</button></div>
        <div class="list"></div>
        <div class="grid config">
          <label class="field">GA4 measurement ID<input class="measurement" placeholder="G-XXXXXXXXXX"></label>
          <label class="field">GTM destination<select class="destination"><option value="">Connect Google to choose</option></select></label>
        </div>
        <div class="actions setup-actions"><button class="connect secondary">Connect Google</button><button class="review-button primary">Review setup</button></div>
        <div class="review hidden"></div>
        <div class="actions approval hidden"><button class="back secondary">Back</button><button class="create primary">Create in GTM</button></div>
        <p class="status"></p>
      </section>
      <div class="bar"><span class="logo">G</span><input class="intent" value="Track all navigation clicks" aria-label="What do you want to track?" placeholder="What do you want to track?"><button class="go" aria-label="Discover tracking">↑</button></div>
    </div>`;
  document.documentElement.append(host);
  if (!document.getElementById("gtmo-page-style")) {
    const style = document.createElement("style");
    style.id = "gtmo-page-style";
    style.textContent = `[data-gtmo-selected="true"] { outline: 3px solid #7c3aed !important; outline-offset: 3px !important; border-radius: 3px; }`;
    document.documentElement.append(style);
  }

  const query = <T extends Element>(selector: string): T => shadow.querySelector<T>(selector)!;
  const panel = query<HTMLElement>(".panel");
  const status = query<HTMLElement>(".status");
  let scanned: NavigationElement[] = [];

  const refreshGoogle = async (): Promise<void> => {
    try {
      const state = await fetch(`${apiBase}/api/google/status`).then((response) => response.json()) as { connected?: boolean; trackingSetupWritesEnabled?: boolean };
      if (!state.connected) return;
      const body = await fetch(`${apiBase}/api/google/accounts`).then((response) => response.json()) as { accounts?: Array<{ accountId: string; name: string; containers: Array<{ containerId: string; publicId: string; name: string }> }> };
      const select = query<HTMLSelectElement>(".destination");
      const destinations = (body.accounts ?? []).flatMap((account) => account.containers.map((container) => ({ ...container, accountId: account.accountId, accountName: account.name })));
      select.replaceChildren(...destinations.map((destination) => {
        const option = document.createElement("option");
        option.value = JSON.stringify(destination);
        option.textContent = `${destination.name} (${destination.publicId})`;
        return option;
      }));
      query<HTMLButtonElement>(".create").disabled = !state.trackingSetupWritesEnabled;
      query<HTMLButtonElement>(".connect").textContent = "Refresh Google";
    } catch { /* Connection remains an optional next action. */ }
  };

  const discover = (): void => {
    scanned = scanNavigation().navigation;
    overlayProposal = undefined;
    const list = query<HTMLElement>(".list");
    list.replaceChildren(...scanned.map((item) => {
      const label = document.createElement("label");
      label.className = "item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.dataset.id = item.id;
      checkbox.addEventListener("change", () => {
        const selected = new Set([...shadow.querySelectorAll<HTMLInputElement>(".item input:checked")].map((input) => input.dataset.id!));
        markSelection(scanned, selected);
      });
      const copy = document.createElement("span");
      const strong = document.createElement("strong"); strong.textContent = item.text;
      const small = document.createElement("small"); small.textContent = item.href;
      copy.append(strong, small);
      const area = document.createElement("span"); area.className = "pill"; area.textContent = item.area;
      label.append(checkbox, copy, area);
      return label;
    }));
    markSelection(scanned, new Set(scanned.map((item) => item.id)));
    query<HTMLElement>(".summary").textContent = `Found ${scanned.length} navigation elements. Uncheck anything you do not want.`;
    query<HTMLElement>(".review").classList.add("hidden");
    query<HTMLElement>(".approval").classList.add("hidden");
    query<HTMLElement>(".setup-actions").classList.remove("hidden");
    panel.classList.add("open");
    void refreshGoogle();
  };

  query<HTMLButtonElement>(".go").addEventListener("click", discover);
  query<HTMLInputElement>(".intent").addEventListener("keydown", (event) => { if (event.key === "Enter") discover(); });
  query<HTMLButtonElement>(".close").addEventListener("click", () => { host.remove(); overlayHost = undefined; markSelection(scanned, new Set()); });
  query<HTMLButtonElement>(".connect").addEventListener("click", () => { void chrome.runtime.sendMessage({ type: "OPEN_GOOGLE_AUTH" }); status.textContent = "Finish Google authorization, then click Refresh Google."; });
  query<HTMLButtonElement>(".review-button").addEventListener("click", async () => {
    try {
      const selected = new Set([...shadow.querySelectorAll<HTMLInputElement>(".item input:checked")].map((input) => input.dataset.id!));
      const navigation = scanned.filter((item) => selected.has(item.id));
      const destinationValue = query<HTMLSelectElement>(".destination").value;
      if (!destinationValue) throw new Error("Connect Google and choose a destination container.");
      const destination = JSON.parse(destinationValue) as { accountId: string; containerId: string; publicId: string; name: string };
      const response = await fetch(`${apiBase}/api/setups`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent: query<HTMLInputElement>(".intent").value, pageUrl: location.href, measurementId: query<HTMLInputElement>(".measurement").value, navigation, container: destination }) });
      const body = await response.json() as SetupProposal | { error: string };
      if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : "Unable to generate setup.");
      overlayProposal = body;
      query<HTMLElement>(".review").textContent = `Create an isolated unpublished workspace with ${body.navigation.length} scoped links, Click URL and Click Text variables, one navigation trigger, and one GA4 event tag.`;
      query<HTMLElement>(".review").classList.remove("hidden");
      query<HTMLElement>(".approval").classList.remove("hidden");
      query<HTMLElement>(".setup-actions").classList.add("hidden");
      status.textContent = "Review the changes. Nothing is created until you approve.";
    } catch (error) { status.textContent = error instanceof Error ? error.message : "Unable to review setup."; }
  });
  query<HTMLButtonElement>(".back").addEventListener("click", () => { query<HTMLElement>(".approval").classList.add("hidden"); query<HTMLElement>(".review").classList.add("hidden"); query<HTMLElement>(".setup-actions").classList.remove("hidden"); });
  query<HTMLButtonElement>(".create").addEventListener("click", async () => {
    try {
      if (!overlayProposal) throw new Error("Review the setup first.");
      const destination = JSON.parse(query<HTMLSelectElement>(".destination").value) as { accountId: string; containerId: string };
      const response = await fetch(`${apiBase}/api/google/accounts/${destination.accountId}/containers/${destination.containerId}/tracking-setups`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approval: "create-isolated-tracking-setup", workspaceName: `GTM Observability - Navigation - ${new Date().toISOString().slice(0, 19)}`, measurementId: overlayProposal.measurementId, linkUrls: overlayProposal.navigation.map((item) => item.href) }) });
      const body = await response.json() as { workspace?: { name: string }; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to create setup.");
      status.textContent = `Created in unpublished workspace “${body.workspace?.name ?? "GTM Observability"}”.`;
    } catch (error) { status.textContent = error instanceof Error ? error.message : "Unable to create setup."; }
  });
  return host;
}

function toggleOverlay(): void {
  if (overlayHost?.isConnected) {
    overlayHost.remove();
    overlayHost = undefined;
    document.querySelectorAll<HTMLElement>("[data-gtmo-selected]").forEach((element) => delete element.dataset.gtmoSelected);
    return;
  }
  overlayHost = createOverlay();
}

function recentAnalyticsRequests(since: number): BrowserEvidence["requests"] {
  return performance
    .getEntriesByType("resource")
    .filter((entry) => entry.startTime >= since && analyticsPattern.test(entry.name))
    .map((entry) => ({ url: entry.name, observedAt: new Date().toISOString() }));
}

document.addEventListener(
  "click",
  (event) => {
    const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || verificationScope.size === 0) return;

    const expected = [...verificationScope.values()].find(
      (item) => item.href === anchor.href && anchor.matches(item.selector),
    );
    if (!expected) return;

    const startedAt = performance.now();
    const clickedAt = new Date().toISOString();
    const initial: BrowserEvidence = {
      navigationId: expected.id,
      clickedAt,
      pageUrl: location.href,
      linkText: (anchor.innerText || expected.text).trim(),
      linkUrl: anchor.href,
      requests: [],
    };
    evidence.set(expected.id, initial);
    void chrome.runtime.sendMessage({ type: "VERIFICATION_EVIDENCE", evidence: initial });

    window.setTimeout(() => {
      const item: BrowserEvidence = {
        ...initial,
        requests: recentAnalyticsRequests(startedAt),
      };
      evidence.set(expected.id, item);
      void chrome.runtime.sendMessage({ type: "VERIFICATION_EVIDENCE", evidence: item });
    }, 1200);
  },
  true,
);

if (!window.__gtmObservabilityInstalled) {
  window.__gtmObservabilityInstalled = true;
  chrome.runtime.onMessage.addListener(
    (request: ExtensionRequest, _sender, sendResponse: (response: unknown) => void) => {
      if (request.type === "SCAN_NAVIGATION") {
        sendResponse(scanNavigation());
        return;
      }
      if (request.type === "START_VERIFICATION") {
        evidence.clear();
        verificationScope = new Map(request.navigation.map((item) => [item.id, item]));
        sendResponse({ started: true, count: verificationScope.size });
        return;
      }
      if (request.type === "GET_EVIDENCE") {
        sendResponse({ evidence: [...evidence.values()] });
        return;
      }
      if (request.type === "TOGGLE_OVERLAY") {
        toggleOverlay();
        sendResponse({ open: overlayHost?.isConnected ?? false });
      }
    },
  );
}
