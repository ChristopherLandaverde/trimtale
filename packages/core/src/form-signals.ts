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

/** Serializable state of one form verification run (survives a page navigation). */
export interface FormRunState {
  eventName: string;
  startedAt: string;
  attempted: boolean;
  validationFailed: boolean;
  responseFailure?: ResponseFailure;
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
  #state: FormRunState;

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
      ...(state.responseFailure === "server_error" || state.responseFailure === "validation_error" ? { responseFailure: state.responseFailure } : {}),
      outcomeObserved: state.outcomeObserved === true,
      transport: state.transport as Transport,
    };
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
    return structuredClone(this.#state);
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

  recordResponseStatus(status: number): void {
    const failure = classifyFormResponseStatus(status);
    if (failure && this.#state.responseFailure !== "server_error") this.#state.responseFailure = failure;
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

  #submissionResult(): RawFormRunObservation["submissionResult"] {
    if (this.#state.outcomeObserved) return "success";
    if (this.#state.validationFailed) return "validation_error";
    return this.#state.responseFailure ?? "unknown";
  }

  observation(input: { runId: string; specificationId: string; targetId: string; success: SuccessEvidence }): RawFormRunObservation {
    const relevant = this.#relevantRequests();
    // A request still pending at the end of the run is counted as delivered: the browser
    // sent it and reported no failure within the observation window.
    const delivered = relevant.filter((request) => request.delivery !== "failed");
    return {
      runId: input.runId,
      specificationId: input.specificationId,
      startedAt: this.#state.startedAt,
      transport: this.#state.transport,
      targetId: input.targetId,
      submitAttempted: this.#state.attempted,
      submissionResult: this.#submissionResult(),
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
