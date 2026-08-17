import type { BrowserEvidence, NavigationArea, NavigationElement } from "@gtm-observability/core";

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

type ExtensionRequest =
  | { type: "SCAN_NAVIGATION" }
  | { type: "START_VERIFICATION"; navigation: NavigationElement[] }
  | { type: "GET_EVIDENCE" }
  | { type: "TOGGLE_OVERLAY" };

const analyticsPattern = /(?:google-analytics\.com|analytics\.google\.com)\/g\/collect/i;
const evidence = new Map<string, BrowserEvidence>();
let verificationScope = new Map<string, NavigationElement>();
let preferences: OverlayPreferences = { width: 380, height: 260, collapsed: true };
let host: HTMLDivElement | undefined;
let frame: HTMLElement | undefined;
let responseList: HTMLElement | undefined;
let composer: HTMLTextAreaElement | undefined;
let port: chrome.runtime.Port | undefined;
const responseNodes = new Map<string, HTMLElement>();

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

function connectAssistant(): chrome.runtime.Port {
  if (port) return port;
  port = chrome.runtime.connect({ name: "assistant" });
  port.onDisconnect.addListener(() => { port = undefined; });
  port.onMessage.addListener((message: { type?: string; requestId?: string; delta?: string }) => {
    if (!message.requestId) return;
    const node = responseNodes.get(message.requestId);
    if (message.type === "ASSISTANT_DELTA" && node && message.delta) {
      node.textContent += message.delta;
      responseList?.scrollTo({ top: responseList.scrollHeight });
    }
    if (message.type === "ASSISTANT_DONE") {
      node?.classList.remove("streaming");
      responseNodes.delete(message.requestId);
    }
  });
  return port;
}

function submitPrompt(): void {
  const prompt = composer?.value.trim();
  if (!prompt) return;
  composer!.value = "";
  addMessage(prompt, "user");
  const requestId = crypto.randomUUID();
  addMessage("", "assistant", requestId);
  const scan = scanNavigation();
  connectAssistant().postMessage({
    type: "ASSISTANT_REQUEST",
    requestId,
    prompt,
    page: { title: scan.title, url: scan.pageUrl, navigationCount: scan.navigation.length },
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
      .messages { overflow: auto; padding: 4px 16px 12px; display: flex; flex-direction: column; gap: 10px; }
      .message { max-width: 88%; padding: 9px 11px; border-radius: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
      .message.bot { align-self: flex-start; color: #e5ebef; background: rgba(41,50,57,.72); border: 1px solid rgba(255,255,255,.06); border-radius: 4px 14px 14px 14px; }
      .message.user { align-self: flex-end; color: #f5fff9; background: #28483d; border-radius: 13px 13px 4px 13px; }
      .message.streaming:empty { width: 64px; height: 16px; background: linear-gradient(100deg, rgba(52,63,71,.6) 20%, rgba(167,243,208,.18) 45%, rgba(52,63,71,.6) 70%); background-size: 220% 100%; animation: shimmer 1.15s linear infinite; }
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
      <div class="messages" aria-live="polite"><div class="message bot">What do you want to track on this page?</div></div>
      <div class="composer"><textarea aria-label="Tracking request" placeholder="Describe an action or outcome…"></textarea><button class="send" aria-label="Send request">↑</button></div>
      <button class="orb" aria-label="Open tracking assistant">G</button>
    </section>`;
  frame = shadow.querySelector<HTMLElement>(".assistant")!;
  responseList = shadow.querySelector<HTMLElement>(".messages")!;
  composer = shadow.querySelector<HTMLTextAreaElement>("textarea")!;
  shadow.querySelector(".orb")?.addEventListener("click", () => setCollapsed(false));
  shadow.querySelector(".collapse")?.addEventListener("click", () => setCollapsed(true));
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

if (!window.__gtmObservabilityInstalled) {
  window.__gtmObservabilityInstalled = true;
  void mountOverlay();
  chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse) => {
    if (request.type === "TOGGLE_OVERLAY") { void mountOverlay().then(() => setCollapsed(!preferences.collapsed)); sendResponse({ toggled: true }); return true; }
    if (request.type === "SCAN_NAVIGATION") { sendResponse(scanNavigation()); return; }
    if (request.type === "START_VERIFICATION") { evidence.clear(); verificationScope = new Map(request.navigation.map((item) => [item.id, item])); sendResponse({ started: true, count: verificationScope.size }); return; }
    if (request.type === "GET_EVIDENCE") sendResponse({ evidence: [...evidence.values()] });
  });
}
