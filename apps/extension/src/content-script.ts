import type { BrowserEvidence, NavigationArea, NavigationElement } from "@gtm-observability/core";

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
let overlayExpanded = false;

function setOverlayExpanded(expanded: boolean): void {
  if (!overlayHost) return;
  overlayExpanded = expanded;
  const root = overlayHost.shadowRoot;
  root?.querySelector(".orb")?.classList.toggle("hidden", expanded);
  root?.querySelector(".workspace")?.classList.toggle("open", expanded);
}

function ensureOverlay(): void {
  if (overlayHost) return;
  overlayHost = document.createElement("div");
  overlayHost.id = "gtm-observability-orb-root";
  const root = overlayHost.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .orb, .workspace { position: fixed; right: 24px; z-index: 2147483647; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      .orb { bottom: 24px; width: 58px; height: 58px; border: 1px solid rgba(255,255,255,.26); border-radius: 50%; cursor: pointer; color: white; background: radial-gradient(circle at 34% 27%, #79838d 0 7%, #313840 25%, #11161b 68%, #050709 100%); box-shadow: 0 16px 38px rgba(0,0,0,.34), inset 0 1px 1px rgba(255,255,255,.26); display: grid; place-items: center; transition: transform .18s ease, box-shadow .18s ease; }
      .orb:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 19px 44px rgba(0,0,0,.4), 0 0 0 5px rgba(40,211,153,.12), inset 0 1px 1px rgba(255,255,255,.28); }
      .orb-mark { width: 25px; height: 25px; border-radius: 50%; display: grid; place-items: center; color: #b8ffe6; font: 800 14px/1 Inter, sans-serif; border: 1px solid rgba(184,255,230,.42); background: rgba(22,34,33,.72); }
      .workspace { bottom: 24px; width: min(390px, calc(100vw - 32px)); height: min(720px, calc(100vh - 48px)); border-radius: 22px; overflow: hidden; opacity: 0; transform: translateY(18px) scale(.94); transform-origin: bottom right; pointer-events: none; background: #f4f6f8; border: 1px solid rgba(255,255,255,.72); box-shadow: 0 28px 80px rgba(0,0,0,.32); transition: opacity .2s ease, transform .2s ease; }
      .workspace.open { opacity: 1; transform: none; pointer-events: auto; }
      .workspace iframe { width: 100%; height: 100%; border: 0; background: #f4f6f8; }
      .hidden { display: none; }
      @media (max-width: 540px) { .orb { right: 16px; bottom: 16px; } .workspace { inset: 12px; width: auto; height: auto; border-radius: 18px; } }
    </style>
    <button class="orb" type="button" aria-label="Open GTM Observability"><span class="orb-mark">G</span></button>
    <section class="workspace" aria-label="GTM Observability workspace">
      <iframe src="${chrome.runtime.getURL("sidepanel.html")}" title="GTM Observability"></iframe>
    </section>`;
  root.querySelector<HTMLButtonElement>(".orb")?.addEventListener("click", () => setOverlayExpanded(true));
  document.documentElement.append(overlayHost);
}

window.addEventListener("message", (event) => {
  if (event.data?.source === "gtm-observability" && event.data?.type === "COLLAPSE_OVERLAY") {
    setOverlayExpanded(false);
  }
});

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
      if (request.type === "TOGGLE_OVERLAY") {
        ensureOverlay();
        setOverlayExpanded(!overlayExpanded);
        sendResponse({ expanded: overlayExpanded });
        return;
      }
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
      }
    },
  );
}
