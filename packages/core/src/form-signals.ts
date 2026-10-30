import type { SuccessEvidence } from "./contracts.js";
import { safeRequestUrl, type RawFormRunObservation } from "./form-evidence.js";
import type { PageSignal } from "./page-signals.js";

export * from "./page-signals.js";

type Transport = RawFormRunObservation["transport"];
type Consent = RawFormRunObservation["consent"];
type ResponseFailure = "validation_error" | "server_error";
type Delivery = "pending" | "delivered" | "failed";

interface RunEvent { event: string; form_id?: string; form_name?: string; at: number }
interface RunRequest { id: string; url: string; observedAt: string; delivery: Delivery }
/** An HTTP response seen after the submit. `attributable` is false when it cannot be tied to the form. */
interface RunResponse { status: number; attributable: boolean }
type SubmissionResult = RawFormRunObservation["submissionResult"];

/** Serializable state of one form verification run (survives a page navigation). */
export interface FormRunState {
  eventName: string;
  startedAt: string;
  attempted: boolean;
  validationFailed: boolean;
  /**
   * Failure responses still standing when the state was saved. The endpoints themselves stay in
   * memory only, so no request path or query reaches persistence.
   */
  responses: RunResponse[];
  outcomeObserved: boolean;
  transport: Transport;
  consent: Consent;
  events: RunEvent[];
  requests: RunRequest[];
}

/** Reads the analytics_storage digit of a GA4 `gcs` parameter (G1<ad><analytics>). */
export function consentFromCollectUrl(url: string): Consent {
  try {
    const match = /^G1[01]([01])$/.exec(new URL(url).searchParams.get("gcs") ?? "");
    if (!match) return "unknown";
    return match[1] === "1" ? "granted" : "denied";
  } catch {
    return "unknown";
  }
}

/** Maps a form endpoint's HTTP status to a submission failure, if it signals one. */
export function classifyFormResponseStatus(status: number): ResponseFailure | undefined {
  if (status >= 500 && status <= 599) return "server_error";
  if (status === 400 || status === 422) return "validation_error";
  return undefined;
}

/**
 * Whether a fetch/XHR response can be attributed to the form's submission: it went to the origin
 * the form submits to (its resolved `action`, which defaults to the page itself). Responses from
 * other origins (analytics, chat or error-reporting widgets) are not form evidence.
 */
export function isFormEndpointRequest(requestUrl: string, formActionUrl: string): boolean {
  try {
    return new URL(requestUrl).origin === new URL(formActionUrl).origin;
  } catch {
    return false;
  }
}

/** One key per endpoint (origin + path), so a retry to the same endpoint replaces its earlier status. */
function endpointKey(endpoint: string | undefined): string {
  if (endpoint === undefined) return "document";
  try {
    const url = new URL(endpoint);
    return `${url.origin}${url.pathname}`;
  } catch {
    return `unparsed:${endpoint}`;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A GTM-compatible regex (RE2 subset) matching one page URL, with any query or fragment. */
export function thankYouUrlPattern(href: string): string {
  const url = new URL(href);
  return `^${escapeRegex(`${url.origin}${url.pathname}`)}(?:[?#].*)?$`;
}

export function matchesSuccessUrl(pattern: string, href: string): boolean {
  try {
    return new RegExp(pattern).test(href);
  } catch {
    return false;
  }
}

function eventNameOf(url: string): string | undefined {
  try {
    return new URL(url).searchParams.get("en") ?? undefined;
  } catch {
    return undefined;
  }
}

const transports: readonly Transport[] = ["native", "redirect", "ajax", "spa", "unobservable"];
const consents: readonly Consent[] = ["granted", "denied", "unknown"];

export class FormRun {
  #state: Omit<FormRunState, "responses">;
  /** Latest status per endpoint key (see `endpointKey`). */
  readonly #responses = new Map<string, RunResponse>();

  constructor(eventName: string, startedAt: string, consent: Consent) {
    this.#state = {
      eventName,
      startedAt,
      attempted: false,
      validationFailed: false,
      outcomeObserved: false,
      transport: "unobservable",
      consent,
      events: [],
      requests: [],
    };
  }

  static restore(value: unknown): FormRun | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const state = value as Partial<FormRunState>;
    if (typeof state.eventName !== "string" || typeof state.startedAt !== "string" || Number.isNaN(Date.parse(state.startedAt))) return undefined;
    if (!transports.includes(state.transport as Transport) || !consents.includes(state.consent as Consent)) return undefined;
    if (!Array.isArray(state.events) || !Array.isArray(state.requests)) return undefined;
    const run = new FormRun(state.eventName, state.startedAt, state.consent as Consent);
    run.#state = {
      ...run.#state,
      attempted: state.attempted === true,
      validationFailed: state.validationFailed === true,
      outcomeObserved: state.outcomeObserved === true,
      transport: state.transport as Transport,
    };
    (Array.isArray(state.responses) ? state.responses : []).forEach((response, index) => {
      if (!response || typeof response.status !== "number") return;
      run.#recordResponse(`restored:${index}`, response.status, response.attributable !== false);
    });
    for (const event of state.events) {
      if (event && typeof event.event === "string" && typeof event.at === "number") {
        run.recordPageSignal({ kind: "datalayer_event", event: event.event, ...(event.form_id ? { formId: event.form_id } : {}), ...(event.form_name ? { formName: event.form_name } : {}), at: event.at });
      }
    }
    for (const request of state.requests) {
      if (!request || typeof request.id !== "string" || typeof request.url !== "string" || typeof request.observedAt !== "string") continue;
      run.recordAnalyticsRequest(request);
      if (request.delivery === "delivered" || request.delivery === "failed") run.recordAnalyticsDelivery(request.id, request.delivery === "delivered");
    }
    return run;
  }

  toJSON(): FormRunState {
    const responses = [...this.#responses.values()].filter((response) => classifyFormResponseStatus(response.status));
    return { ...structuredClone(this.#state), responses: structuredClone(responses) };
  }

  get outcomeObserved(): boolean {
    return this.#state.outcomeObserved;
  }

  get startedAtMs(): number {
    return Date.parse(this.#state.startedAt);
  }

  recordAttempt(): void {
    this.#state.attempted = true;
  }

  recordValidationFailure(): void {
    this.#state.attempted = true;
    this.#state.validationFailed = true;
  }

  /**
   * Records an HTTP response seen after the submit: a fetch/XHR (pass its URL as `endpoint`) or,
   * without an endpoint, the document a native POST navigated to. A later response from the same
   * endpoint (origin + path) replaces the earlier one, so a successful retry clears a failure.
   * Pass `attributable: false` for a response that cannot be tied to the form (see
   * `isFormEndpointRequest`); it never outranks an observed success.
   */
  recordResponseStatus(status: number, options: { endpoint?: string; attributable?: boolean } = {}): void {
    this.#recordResponse(endpointKey(options.endpoint), status, options.attributable !== false);
  }

  #recordResponse(key: string, status: number, attributable: boolean): void {
    if (!Number.isInteger(status) || status < 100 || status > 599) return;
    this.#responses.set(key, { status, attributable });
  }

  recordOutcome(): void {
    this.#state.outcomeObserved = true;
  }

  recordTransport(transport: Transport): void {
    if (this.#state.transport === "redirect") return;
    this.#state.transport = transport;
  }

  recordPageSignal(signal: PageSignal | undefined): void {
    if (!signal || signal.at < this.startedAtMs) return;
    if (signal.kind === "consent") {
      this.#state.consent = signal.analyticsStorage;
      return;
    }
    this.#state.events.push({
      event: signal.event,
      ...(signal.formId ? { form_id: signal.formId } : {}),
      ...(signal.formName ? { form_name: signal.formName } : {}),
      at: signal.at,
    });
  }

  /** Records a GA4 collection request attempt. Only an allowlisted part of the URL is kept. */
  recordAnalyticsRequest(request: { id: string; url: string; observedAt: string }): void {
    if (Date.parse(request.observedAt) < this.startedAtMs) return;
    if (this.#state.requests.some((item) => item.id === request.id)) return;
    const url = safeRequestUrl(request.url);
    if (!url) return;
    this.#state.requests.push({ id: request.id, url, observedAt: request.observedAt, delivery: "pending" });
  }

  recordAnalyticsDelivery(id: string, delivered: boolean): void {
    const request = this.#state.requests.find((item) => item.id === id);
    if (request) request.delivery = delivered ? "delivered" : "failed";
  }

  hasPendingDeliveries(): boolean {
    return this.#relevantRequests().some((request) => request.delivery === "pending");
  }

  #relevantRequests(): RunRequest[] {
    return this.#state.requests.filter((request) => eventNameOf(request.url) === this.#state.eventName);
  }

  #consent(): Consent {
    if (this.#state.consent !== "unknown") return this.#state.consent;
    const fromRequests = this.#state.requests.map((request) => consentFromCollectUrl(request.url));
    if (fromRequests.includes("denied")) return "denied";
    return fromRequests.includes("granted") ? "granted" : "unknown";
  }

  /** The most severe failure among the latest responses: any 5xx outranks a 400/422. */
  #responseFailure(attributable: boolean): { result: ResponseFailure; status: number } | undefined {
    let found: { result: ResponseFailure; status: number } | undefined;
    for (const response of this.#responses.values()) {
      if (response.attributable !== attributable) continue;
      const result = classifyFormResponseStatus(response.status);
      if (result && (!found || (result === "server_error" && found.result !== "server_error"))) found = { result, status: response.status };
    }
    return found;
  }

  /**
   * Submission result precedence. What the browser saw the form endpoint answer outranks what
   * the page reports about itself: the success element, the thank-you URL and the dataLayer
   * event are all set by page code, which can show success after a failed request.
   *
   *   1. 5xx from the form endpoint (fetch/XHR to the form's origin, or the document a native
   *      POST returned)                                                       -> server_error
   *   2. 400/422 from the form endpoint                                       -> validation_error
   *   3. the confirmed success signal (element, thank-you URL, dataLayer event) -> success
   *   4. client-side validation (`invalid` events, `aria-invalid`)           -> validation_error
   *   5. 5xx, then 400/422, from a response not attributable to the form     -> server_error / validation_error
   *   6. otherwise                                                            -> unknown
   *
   * A conflicting success signal stays in the evidence (`outcome.observed`, dataLayer events,
   * GA4 requests), and the response status is reported as `responseStatus`.
   */
  #submissionResult(): { result: SubmissionResult; responseStatus?: number } {
    const endpointFailure = this.#responseFailure(true);
    if (endpointFailure) return { result: endpointFailure.result, responseStatus: endpointFailure.status };
    if (this.#state.outcomeObserved) return { result: "success" };
    if (this.#state.validationFailed) return { result: "validation_error" };
    const otherFailure = this.#responseFailure(false);
    if (otherFailure) return { result: otherFailure.result, responseStatus: otherFailure.status };
    return { result: "unknown" };
  }

  observation(input: { runId: string; specificationId: string; targetId: string; success: SuccessEvidence }): RawFormRunObservation {
    const relevant = this.#relevantRequests();
    // A request still pending at the end of the run is counted as delivered: the browser
    // sent it and reported no failure within the observation window.
    const delivered = relevant.filter((request) => request.delivery !== "failed");
    const submission = this.#submissionResult();
    return {
      runId: input.runId,
      specificationId: input.specificationId,
      startedAt: this.#state.startedAt,
      transport: this.#state.transport,
      targetId: input.targetId,
      submitAttempted: this.#state.attempted,
      submissionResult: submission.result,
      ...(submission.responseStatus !== undefined ? { responseStatus: submission.responseStatus } : {}),
      outcomeObserved: this.#state.outcomeObserved,
      outcomeObservable: input.success.type !== "same_page_success",
      outcomeEvidenceType: input.success.type,
      dataLayerEvents: this.#state.events
        .filter((event) => event.event === this.#state.eventName)
        .map(({ at: _at, ...event }) => event),
      tagFired: relevant.length > 0,
      networkUrls: delivered.map((request) => request.url),
      consent: this.#consent(),
    };
  }
}
