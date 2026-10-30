import {
  createSetupProposal,
  determineFormVerdict,
  evaluateEvidence,
  normalizeFormRunEvidence,
  type BrowserEvidence,
  type FormSetupRequest,
  type NavigationElement,
  type SetupRequest,
  type SuccessEvidence,
  type TrackingRunEvidenceV1,
  type TrackingSpecificationV1,
} from "@trimtale/core";

export type AnalyticsRequest = { url: string; observedAt: string };

export interface FormPageState {
  transport?: string;
  submitAttempted?: string;
  submissionResult?: string;
  outcomeObserved?: string;
  outcomeObservable?: string;
  dataLayerEvent?: string;
  tagFired?: string;
  consent?: string;
}

interface PostPublicationNavigation {
  operationId: string;
  request: SetupRequest;
}

interface PostPublicationForm {
  operationId: string;
  request: FormSetupRequest;
}

export interface PostPublicationEvidenceCompletion {
  operationId: string;
  request: SetupRequest | FormSetupRequest;
  evidence: TrackingRunEvidenceV1;
}

function classifySubmissionResult(value: string | undefined): "success" | "validation_error" | "server_error" | "unknown" {
  return value === "success" || value === "validation_error" || value === "server_error" ? value : "unknown";
}

function classifyTransport(value: string | undefined): "native" | "redirect" | "ajax" | "spa" | "unobservable" {
  return value === "native" || value === "redirect" || value === "ajax" || value === "spa" ? value : "unobservable";
}

function classifyConsent(value: string | undefined): "granted" | "denied" | "unknown" {
  return value === "granted" || value === "denied" ? value : "unknown";
}

export function buildFormRunEvidence(
  input: {
    specification: TrackingSpecificationV1;
    target: TrackingSpecificationV1["targets"][number];
    success: SuccessEvidence;
    startedAt: string;
    pageState: FormPageState;
    requests: AnalyticsRequest[];
    now?: number;
  },
): TrackingRunEvidenceV1 {
  const requestUrls = input.requests
    .filter((request) => Date.parse(request.observedAt) >= Date.parse(input.startedAt))
    .map((request) => request.url);
  const provisionalVerdict: TrackingRunEvidenceV1["verdict"] = {
    code: "insufficient_observable_evidence",
    browserVerification: "inconclusive",
    platformConfirmation: "unverified",
    nextAction: "Await deterministic classification.",
  };
  const provisional = normalizeFormRunEvidence({
    runId: `run_form_${input.now ?? Date.now()}`,
    specificationId: input.specification.id,
    startedAt: input.startedAt,
    transport: classifyTransport(input.pageState.transport),
    targetId: input.target.id,
    submitAttempted: input.pageState.submitAttempted === "true",
    submissionResult: classifySubmissionResult(input.pageState.submissionResult),
    outcomeObserved: input.pageState.outcomeObserved === "true",
    outcomeObservable: input.pageState.outcomeObservable !== "false",
    outcomeEvidenceType: input.success.type,
    dataLayerEvents: input.pageState.dataLayerEvent === "true"
      ? [{ event: "generate_lead", form_id: input.target.id, form_name: input.target.label.replaceAll(" ", "_") }]
      : [],
    tagFired: input.pageState.tagFired === "true" ? true : input.pageState.tagFired === "false" ? false : null,
    networkUrls: requestUrls,
    consent: classifyConsent(input.pageState.consent),
  }, provisionalVerdict);
  const verdict = determineFormVerdict(provisional.observations);
  return { ...provisional, verdict };
}

export class NavigationEvidenceController {
  readonly #evidence = new Map<string, BrowserEvidence>();
  #scope = new Map<string, NavigationElement>();
  #postPublication: PostPublicationNavigation | undefined;

  startVerification(navigation: NavigationElement[]): number {
    this.#evidence.clear();
    this.#scope = new Map(navigation.map((item) => [item.id, item]));
    return this.#scope.size;
  }

  startPostPublication(operationId: string, request: SetupRequest): number {
    this.#postPublication = { operationId, request };
    return this.startVerification(request.navigation);
  }

  get scopeSize(): number {
    return this.#scope.size;
  }

  get evidence(): BrowserEvidence[] {
    return [...this.#evidence.values()];
  }

  expectedForAnchor(anchor: HTMLAnchorElement): NavigationElement | undefined {
    return [...this.#scope.values()].find((item) => item.href === anchor.href && anchor.matches(item.selector));
  }

  recordClick(expected: NavigationElement, evidence: BrowserEvidence): void {
    this.#evidence.set(expected.id, evidence);
  }

  recordEvidence(evidence: BrowserEvidence): PostPublicationEvidenceCompletion | undefined {
    this.#evidence.set(evidence.navigationId, evidence);
    const expected = this.#scope.get(evidence.navigationId);
    return expected ? this.completePostPublication(expected, evidence) : undefined;
  }

  completePostPublication(
    expected: NavigationElement,
    evidence: BrowserEvidence,
  ): PostPublicationEvidenceCompletion | undefined {
    const active = this.#postPublication;
    if (!active) return undefined;
    const verdict = evaluateEvidence(expected, evidence, createSetupProposal(active.request).specification.id);
    if (!verdict.runEvidence) return undefined;
    this.#postPublication = undefined;
    this.#scope.clear();
    return { operationId: active.operationId, request: active.request, evidence: verdict.runEvidence };
  }
}

export class FormEvidenceController {
  readonly #recentRequests: AnalyticsRequest[] = [];
  #postPublication: PostPublicationForm | undefined;

  startInteractiveVerification(): void {
    this.#recentRequests.length = 0;
  }

  startPostPublication(operationId: string, request: FormSetupRequest): void {
    this.#recentRequests.length = 0;
    this.#postPublication = { operationId, request };
  }

  recordAnalyticsRequest(request: AnalyticsRequest): void {
    this.#recentRequests.push(request);
  }

  matchesPostPublicationForm(form: HTMLFormElement): boolean {
    const target = this.#postPublication?.request.specification.targets[0];
    return Boolean(target && form.matches(target.selector));
  }

  buildRunEvidence(
    specification: TrackingSpecificationV1,
    target: TrackingSpecificationV1["targets"][number],
    success: SuccessEvidence,
    startedAt: string,
    pageState: FormPageState,
  ): TrackingRunEvidenceV1 {
    return buildFormRunEvidence({
      specification,
      target,
      success,
      startedAt,
      pageState,
      requests: this.#recentRequests,
    });
  }

  finishPostPublication(
    startedAt: string,
    pageState: FormPageState,
  ): PostPublicationEvidenceCompletion | undefined {
    const active = this.#postPublication;
    const target = active?.request.specification.targets[0];
    const success = active?.request.specification.successEvidence[0];
    if (!active || !target || !success) return undefined;
    const evidence = this.buildRunEvidence(active.request.specification, target, success, startedAt, pageState);
    this.#postPublication = undefined;
    return { operationId: active.operationId, request: active.request, evidence };
  }
}
