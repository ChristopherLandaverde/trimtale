import type { BrowserEvidence, NavigationArea, NavigationElement } from "@gtm-observability/core";

declare global {
  interface Window {
    __gtmObservabilityInstalled?: boolean;
    google_tag_manager?: Record<string, unknown>;
  }
}

interface ScanResponse {
  pageUrl: string;
  title: string;
  navigation: NavigationElement[];
  signals: PageTrackingSignals;
}

interface PageTrackingSignals {
  gtmContainers: string[];
  ga4MeasurementIds: string[];
}

type ExtensionRequest =
  | { type: "SCAN_NAVIGATION" }
  | { type: "START_VERIFICATION"; navigation: NavigationElement[] }
  | { type: "GET_EVIDENCE" }
  | { type: "TOGGLE_WORKBENCH"; tabId: number }
  | { type: "HIDE_WORKBENCH" };

const analyticsPattern = /(?:google-analytics\.com|analytics\.google\.com)\/g\/collect/i;
const gtmPattern = /GTM-[A-Z0-9]+/gi;
const ga4Pattern = /G-[A-Z0-9]+/gi;
const evidence = new Map<string, BrowserEvidence>();
let verificationScope = new Map<string, NavigationElement>();
let workbenchHost: HTMLDivElement | undefined;

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

  return { pageUrl: location.href, title: document.title, navigation, signals: trackingSignals() };
}

function addMatches(target: Set<string>, value: string | null | undefined, pattern: RegExp): void {
  if (!value) return;
  for (const match of value.matchAll(pattern)) {
    target.add(match[0]!.toUpperCase());
  }
}

function trackingSignals(): PageTrackingSignals {
  const gtmContainers = new Set<string>();
  const ga4MeasurementIds = new Set<string>();
  for (const script of document.scripts) {
    addMatches(gtmContainers, script.src, gtmPattern);
    addMatches(gtmContainers, script.textContent, gtmPattern);
    addMatches(ga4MeasurementIds, script.src, ga4Pattern);
    addMatches(ga4MeasurementIds, script.textContent, ga4Pattern);
  }
  for (const frame of document.querySelectorAll<HTMLIFrameElement>("noscript iframe[src], iframe[src]")) {
    addMatches(gtmContainers, frame.src, gtmPattern);
  }
  for (const key of Object.keys(window.google_tag_manager ?? {})) {
    addMatches(gtmContainers, key, gtmPattern);
  }
  return {
    gtmContainers: [...gtmContainers].sort(),
    ga4MeasurementIds: [...ga4MeasurementIds].sort(),
  };
}

function recentAnalyticsRequests(since: number): BrowserEvidence["requests"] {
  return performance
    .getEntriesByType("resource")
    .filter((entry) => entry.startTime >= since && analyticsPattern.test(entry.name))
    .map((entry) => ({ url: entry.name, observedAt: new Date().toISOString() }));
}

function showWorkbench(tabId: number): void {
  if (workbenchHost) {
    workbenchHost.hidden = !workbenchHost.hidden;
    return;
  }

  const host = document.createElement("div");
  host.id = "gtm-observability-workbench-host";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      position: fixed;
      inset: 16px 16px auto auto;
      z-index: 2147483647;
      width: min(420px, calc(100vw - 32px));
      height: min(760px, calc(100vh - 32px));
      border: 1px solid rgb(189 198 208);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 18px 56px rgb(23 33 43 / 24%);
      background: white;
    }
    :host([hidden]) {
      display: none;
    }
    iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      background: white;
    }
  `;
  const frame = document.createElement("iframe");
  frame.title = "GTM Observability workbench";
  frame.src = chrome.runtime.getURL(`workbench.html?tabId=${tabId}&embedded=1`);
  shadow.append(style, frame);
  document.documentElement.append(host);
  workbenchHost = host;
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
      if (request.type === "TOGGLE_WORKBENCH") {
        showWorkbench(request.tabId);
        sendResponse({ visible: Boolean(workbenchHost) });
        return;
      }
      if (request.type === "HIDE_WORKBENCH") {
        if (workbenchHost) workbenchHost.hidden = true;
        sendResponse({ visible: false });
      }
    },
  );
}
