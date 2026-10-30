import {
  FormRun,
  isFormEndpointRequest,
  matchesSuccessUrl,
  type FormRunState,
  type FormSetupRequest,
  type PageSignal,
  type SuccessEvidence,
  type TrackingSpecificationV1,
} from "@trimtale/core";
import { pageSignalBridge } from "./page-signal-bridge.js";

// Captures a lead-form verification run from real browser signals:
// - the submit attempt: the form's own `submit` event, or `invalid` events from
//   the browser's constraint validation;
// - the outcome: the confirmed success element becoming visible, the thank-you URL
//   (including after a full navigation), or the confirmed dataLayer event;
// - failures: field `aria-invalid`, and the form endpoint's HTTP status from the
//   page's Resource Timing entries (fetch/XHR to the form's action origin, or the document a
//   native POST returned); a failed endpoint response outranks the page's own success signal
//   (see `FormRun` in @trimtale/core for the full precedence order);
// - dataLayer events and Consent Mode commands, from the MAIN-world page observer over its
//   private MessagePort (page-signal-bridge.ts); page scripts can neither forge nor read them;
// - GA4 collection request attempts and their delivery, from the service worker.
// No form field value is read into the run.

export interface FormRunContext {
  mode: "interactive" | "post_publication";
  specification: TrackingSpecificationV1;
  target: TrackingSpecificationV1["targets"][number];
  success: SuccessEvidence;
  operationId?: string;
  request?: FormSetupRequest;
}

interface SavedFormRun { context: FormRunContext; state: FormRunState; baseline: string | null; }

export interface FormAnalyticsRequest { id: string; url: string; observedAt: string; delivery?: "pending" | "delivered" | "failed" }

const runWindowMs = 2_500;
const resumedWindowMs = 2_000;
const deliveryGraceMs = 1_500;
const pollMs = 100;
const analyticsUrl = /\/g\/collect(?:[?#]|$)/;

function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement) || element.hidden) return false;
  if (typeof element.checkVisibility === "function") return element.checkVisibility();
  return element.getClientRects().length > 0;
}

/** A value-free snapshot of the success signal, compared before and after the submit. */
function successSnapshot(success: SuccessEvidence): string | null {
  if (success.type === "visible_element") {
    let element: Element | null = null;
    try {
      element = document.querySelector(success.selector);
    } catch {
      return null;
    }
    if (!element || !isVisible(element)) return null;
    return `visible:${(element.textContent ?? "").trim().length}`;
  }
  if (success.type === "thank_you_url") return matchesSuccessUrl(success.urlPattern, location.href) ? "url" : null;
  return null;
}

/**
 * The URL the form submits to. Read from the attribute: `form.action` can be shadowed by a field
 * named "action". An absent or empty action submits to the page itself.
 */
function formActionUrl(form: HTMLFormElement): string {
  try {
    return new URL(form.getAttribute("action") ?? "", document.baseURI).href;
  } catch {
    return location.href;
  }
}

function hasValidationFailure(form: HTMLFormElement | null): boolean {
  if (!form) return false;
  if (form.querySelector('[aria-invalid="true"]')) return true;
  return form.noValidate && form.querySelector(":invalid") !== null;
}

export class FormSignalCapture {
  #pageConsent: "granted" | "denied" | "unknown" = "unknown";
  #armed: FormRunContext | undefined;
  #run: FormRun | undefined;
  #context: FormRunContext | undefined;
  #baseline: string | null = null;
  #startUrl = "";
  #startPerformance = 0;
  /** The resolved URL the target form submits to; fetch/XHR to its origin is the form endpoint. */
  #formAction = "";
  #deadline = 0;
  #finishAt = 0;
  #timer: number | undefined;
  #resourceObserver: PerformanceObserver | undefined;
  readonly #onFinish: (run: FormRun, context: FormRunContext) => void;

  constructor(onFinish: (run: FormRun, context: FormRunContext) => void) {
    this.#onFinish = onFinish;
    pageSignalBridge()?.subscribe((signal) => this.#recordSignal(signal));
    // Only the browser's own submit and constraint-validation events count: a page script can
    // dispatch synthetic ones (isTrusted === false) without anyone submitting the form.
    document.addEventListener("submit", (event) => { if (event.isTrusted) this.#onSubmit(event); }, true);
    document.addEventListener("invalid", (event) => { if (event.isTrusted) this.#onInvalid(event); }, true);
    window.addEventListener("pagehide", () => this.#persist());
  }

  get active(): boolean {
    return Boolean(this.#run);
  }

  arm(context: FormRunContext): void {
    this.#armed = context;
    pageSignalBridge()?.start();
  }

  disarm(): void {
    this.#armed = undefined;
  }

  recordAnalyticsRequest(request: FormAnalyticsRequest): void {
    if (!this.#run) return;
    this.#run.recordAnalyticsRequest(request);
    if (request.delivery === "delivered" || request.delivery === "failed") {
      this.#run.recordAnalyticsDelivery(request.id, request.delivery === "delivered");
    }
  }

  recordAnalyticsDelivery(id: string, delivered: boolean): void {
    this.#run?.recordAnalyticsDelivery(id, delivered);
  }

  /** Continues a run that was interrupted by a full page navigation (e.g. a thank-you redirect). */
  resume(saved: unknown, requests: FormAnalyticsRequest[]): FormRunContext | undefined {
    if (this.#run || typeof saved !== "object" || saved === null) return undefined;
    const value = saved as Partial<SavedFormRun>;
    const run = FormRun.restore(value.state);
    if (!run || !value.context) return undefined;
    this.#run = run;
    this.#context = value.context;
    this.#baseline = value.baseline ?? null;
    this.#startUrl = location.href;
    this.#startPerformance = 0;
    run.recordTransport("redirect");
    const navigation = performance.getEntriesByType("navigation")[0] as (PerformanceNavigationTiming & { responseStatus?: number }) | undefined;
    if (navigation?.responseStatus) run.recordResponseStatus(navigation.responseStatus);
    for (const request of requests) this.recordAnalyticsRequest(request);
    pageSignalBridge()?.start();
    this.#watch(resumedWindowMs);
    return value.context;
  }

  #recordSignal(signal: PageSignal): void {
    if (signal.kind === "consent") this.#pageConsent = signal.analyticsStorage;
    const run = this.#run;
    if (!run) return;
    // Signals arrive in dataLayer order, so a consent state that arrives during the run is the
    // current one even if the observer read it just before the submit.
    run.recordPageSignal(signal.kind === "consent" ? { ...signal, at: Math.max(signal.at, run.startedAtMs) } : signal);
    const success = this.#context?.success;
    if (signal.kind === "datalayer_event" && success?.type === "data_layer_event" && signal.event === success.eventName && signal.at >= run.startedAtMs) {
      run.recordOutcome();
    }
  }

  #targetForm(event: Event): HTMLFormElement | undefined {
    const context = this.#context ?? this.#armed;
    if (!context) return undefined;
    const node = event.target;
    const form = node instanceof HTMLFormElement ? node : node instanceof Element ? node.closest("form") : null;
    if (!form) return undefined;
    try {
      return form.matches(context.target.selector) ? form : undefined;
    } catch {
      return undefined;
    }
  }

  #begin(form: HTMLFormElement): FormRun | undefined {
    if (this.#run) return this.#run;
    const context = this.#armed;
    if (!context) return undefined;
    this.#context = context;
    this.#armed = undefined;
    this.#formAction = formActionUrl(form);
    this.#baseline = successSnapshot(context.success);
    this.#startUrl = location.href;
    this.#startPerformance = performance.now();
    pageSignalBridge()?.start();
    this.#run = new FormRun(context.specification.event.name, new Date().toISOString(), this.#pageConsent);
    this.#run.recordTransport("native");
    this.#observeResponses();
    this.#watch(runWindowMs);
    return this.#run;
  }

  #onSubmit(event: Event): void {
    const form = this.#targetForm(event);
    if (!form) return;
    this.#begin(form)?.recordAttempt();
    this.#persist();
  }

  #onInvalid(event: Event): void {
    const form = this.#targetForm(event);
    if (!form) return;
    this.#begin(form)?.recordValidationFailure();
  }

  #observeResponses(): void {
    if (this.#resourceObserver || typeof PerformanceObserver === "undefined") return;
    this.#resourceObserver = new PerformanceObserver((list) => {
      const run = this.#run;
      if (!run) return;
      for (const entry of list.getEntries() as Array<PerformanceResourceTiming & { responseStatus?: number }>) {
        if (entry.startTime < this.#startPerformance) continue;
        if (entry.initiatorType !== "fetch" && entry.initiatorType !== "xmlhttprequest") continue;
        if (analyticsUrl.test(entry.name)) continue;
        if (location.href === this.#startUrl) run.recordTransport("ajax");
        if (entry.responseStatus) {
          run.recordResponseStatus(entry.responseStatus, {
            endpoint: entry.name,
            attributable: isFormEndpointRequest(entry.name, this.#formAction),
          });
        }
      }
    });
    try {
      this.#resourceObserver.observe({ type: "resource", buffered: false });
    } catch {
      this.#resourceObserver = undefined;
    }
  }

  #watch(windowMs: number): void {
    const now = Date.now();
    this.#finishAt = now + windowMs;
    this.#deadline = this.#finishAt + deliveryGraceMs;
    if (this.#timer !== undefined) window.clearInterval(this.#timer);
    this.#timer = window.setInterval(() => this.#tick(), pollMs);
  }

  #checkOutcome(): void {
    const run = this.#run;
    const context = this.#context;
    if (!run || !context) return;
    if (location.href !== this.#startUrl && this.#startPerformance > 0) run.recordTransport("spa");
    const snapshot = successSnapshot(context.success);
    if (snapshot !== null && snapshot !== this.#baseline) run.recordOutcome();
  }

  #tick(): void {
    const run = this.#run;
    const context = this.#context;
    if (!run || !context) return;
    this.#checkOutcome();
    const now = Date.now();
    if (now < this.#finishAt) return;
    if (run.hasPendingDeliveries() && now < this.#deadline) return;
    const form = (() => {
      try {
        return document.querySelector<HTMLFormElement>(context.target.selector);
      } catch {
        return null;
      }
    })();
    if (!run.outcomeObserved && hasValidationFailure(form)) {
      run.recordValidationFailure();
    }
    this.#stop();
    void chrome.runtime.sendMessage({ type: "FORM_RUN_CLEAR" }).catch(() => undefined);
    this.#onFinish(run, context);
  }

  #stop(): void {
    if (this.#timer !== undefined) window.clearInterval(this.#timer);
    this.#timer = undefined;
    this.#resourceObserver?.disconnect();
    this.#resourceObserver = undefined;
    this.#run = undefined;
    this.#context = undefined;
  }

  #persist(): void {
    const run = this.#run;
    const context = this.#context;
    if (!run || !context) return;
    const saved: SavedFormRun = { context, state: run.toJSON(), baseline: this.#baseline };
    void chrome.runtime.sendMessage({ type: "FORM_RUN_SAVE", saved }).catch(() => undefined);
  }
}
