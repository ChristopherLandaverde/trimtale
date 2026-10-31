import type { BrowserEvidence, SetupRequest } from "@trimtale/core";
import type { WorkflowResult } from "./workflow-bridge.js";

/**
 * A post-publication navigation check that may outlive its page: clicking the confirmed
 * link usually navigates, so the service worker keeps the run in session storage and the
 * next page in the same tab finishes it.
 */
export interface NavigationRun {
  operationId: string;
  request: SetupRequest;
  /** The evidence captured on the click, before the page unloaded. */
  evidence: BrowserEvidence;
  savedAt: number;
  /**
   * The document that was clicked, as the service worker saw the sender. Only collection
   * requests that document sent count, so the destination page's own hits never do.
   */
  documentId?: string;
  /** The recorded browser-verification result, once the API answered. */
  result?: WorkflowResult;
}

/** What the next page receives: the run plus either the recorded result or the evidence to record. */
export interface NavigationRunResume {
  run?: Pick<NavigationRun, "operationId" | "request">;
  evidence?: BrowserEvidence;
  result?: WorkflowResult;
}

export const NAVIGATION_RUN_LIFETIME_MS = 60_000;
/** Matches the content script's last evidence sample after the click. */
export const NAVIGATION_RUN_SETTLE_MS = 1_200;

/**
 * A page's own click listener can send its collection request in the same event dispatch,
 * a moment before the assistant stamps the click. Requests this close before the click
 * still belong to it.
 */
export const NAVIGATION_CLICK_LEAD_MS = 100;

/** The earliest request time that belongs to a click. */
export function navigationRequestsFrom(clickedAt: string): string {
  const stamped = Date.parse(clickedAt);
  return Number.isFinite(stamped) ? new Date(stamped - NAVIGATION_CLICK_LEAD_MS).toISOString() : clickedAt;
}

/**
 * The specification fingerprint hashes navigation items in their key order, and
 * `chrome.storage` does not keep key order. Rebuild each item in the order the page scan
 * creates it so a stored request maps to the same specification as the original.
 */
export function canonicalNavigationRequest(request: SetupRequest): SetupRequest {
  return {
    ...request,
    navigation: request.navigation.map(({ id, text, href, area, selector, ...rest }) => ({ id, text, href, area, selector, ...rest })),
  };
}

export const navigationRunKey = (tabId: number): string => `navigationRun:${tabId}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNavigationRun(value: unknown, now = Date.now()): value is NavigationRun {
  if (!isRecord(value) || !isRecord(value.request) || !isRecord(value.evidence)) return false;
  return typeof value.operationId === "string" && value.operationId.length > 0
    && Array.isArray(value.request.navigation)
    && typeof value.evidence.navigationId === "string"
    && typeof value.evidence.clickedAt === "string"
    && Array.isArray(value.evidence.requests)
    && typeof value.evidence.linkUrl === "string"
    && (value.documentId === undefined || typeof value.documentId === "string")
    && typeof value.savedAt === "number"
    && now - value.savedAt >= 0
    && now - value.savedAt <= NAVIGATION_RUN_LIFETIME_MS;
}

/** How long to wait before the run's evidence has had the same time to settle as on its own page. */
export function navigationRunSettleDelay(run: Pick<NavigationRun, "evidence">, now = Date.now()): number {
  const clickedAt = Date.parse(run.evidence.clickedAt);
  if (!Number.isFinite(clickedAt)) return 0;
  return Math.min(NAVIGATION_RUN_SETTLE_MS, Math.max(0, clickedAt + NAVIGATION_RUN_SETTLE_MS - now));
}

/** A collection request as the service worker observed it, with the document that sent it. */
export interface DocumentRequest {
  url: string;
  observedAt: string;
  documentId?: string;
}

/**
 * The requests that belong to the run's click: sent by the clicked document, from just
 * before the click stamp on. Without a known document, nothing counts.
 */
export function navigationRunRequests(
  run: Pick<NavigationRun, "evidence" | "documentId">,
  requests: DocumentRequest[],
): BrowserEvidence["requests"] {
  if (!run.documentId) return [];
  const earliest = Date.parse(navigationRequestsFrom(run.evidence.clickedAt));
  return requests
    .filter((request) => request.documentId === run.documentId && Date.parse(request.observedAt) >= earliest)
    .map(({ url, observedAt }) => ({ url, observedAt }));
}

/** A run resumes only on a page from the clicked link's origin, never on an unrelated site. */
export function navigationRunResumableAt(run: Pick<NavigationRun, "evidence">, pageUrl: string | undefined): boolean {
  try {
    return pageUrl !== undefined && new URL(pageUrl).origin === new URL(run.evidence.linkUrl).origin;
  } catch {
    return false;
  }
}

/** The click evidence plus collection requests that belong to the click, without duplicates. */
export function mergeNavigationEvidence(
  evidence: BrowserEvidence,
  ...requests: BrowserEvidence["requests"][]
): BrowserEvidence {
  const seen = new Set<string>();
  const earliest = Date.parse(navigationRequestsFrom(evidence.clickedAt));
  const merged = [evidence.requests, ...requests].flat().filter((request) => {
    const key = `${request.observedAt}\u0000${request.url}`;
    if (seen.has(key) || Date.parse(request.observedAt) < earliest) return false;
    seen.add(key);
    return true;
  });
  return { ...evidence, requests: merged };
}
