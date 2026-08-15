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
  | { type: "GET_EVIDENCE" };

const analyticsPattern = /(?:google-analytics\.com|analytics\.google\.com)\/g\/collect/i;
const evidence = new Map<string, BrowserEvidence>();
let verificationScope = new Map<string, NavigationElement>();

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
