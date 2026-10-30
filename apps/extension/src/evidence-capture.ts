import {
  createSetupProposal,
  determineFormVerdict,
  evaluateEvidence,
  normalizeFormRunEvidence,
  type BrowserEvidence,
  type FormRun,
  type FormSetupRequest,
  type NavigationElement,
  type SetupRequest,
  type SuccessEvidence,
  type TrackingRunEvidenceV1,
  type TrackingSpecificationV1,
} from "@trimtale/core";

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

export function buildFormRunEvidence(
  input: {
    specification: TrackingSpecificationV1;
    target: TrackingSpecificationV1["targets"][number];
    success: SuccessEvidence;
    run: FormRun;
    now?: number;
  },
): TrackingRunEvidenceV1 {
  const provisionalVerdict: TrackingRunEvidenceV1["verdict"] = {
    code: "insufficient_observable_evidence",
    browserVerification: "inconclusive",
    platformConfirmation: "unverified",
    nextAction: "Await deterministic classification.",
  };
  const provisional = normalizeFormRunEvidence(input.run.observation({
    runId: `run_form_${input.now ?? Date.now()}`,
    specificationId: input.specification.id,
    targetId: input.target.id,
    success: input.success,
  }), provisionalVerdict);
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
  #postPublication: PostPublicationForm | undefined;

  startPostPublication(operationId: string, request: FormSetupRequest): void {
    this.#postPublication = { operationId, request };
  }

  get postPublicationRequest(): FormSetupRequest | undefined {
    return this.#postPublication?.request;
  }

  get postPublicationOperationId(): string | undefined {
    return this.#postPublication?.operationId;
  }

  matchesPostPublicationForm(form: HTMLFormElement): boolean {
    const target = this.#postPublication?.request.specification.targets[0];
    return Boolean(target && form.matches(target.selector));
  }

  /** Re-attaches a post-publication run after the page navigated during the submission. */
  resumePostPublication(operationId: string, request: FormSetupRequest): void {
    this.#postPublication = { operationId, request };
  }

  finishPostPublication(run: FormRun): PostPublicationEvidenceCompletion | undefined {
    const active = this.#postPublication;
    const target = active?.request.specification.targets[0];
    const success = active?.request.specification.successEvidence[0];
    if (!active || !target || !success) return undefined;
    const evidence = buildFormRunEvidence({ specification: active.request.specification, target, success, run });
    this.#postPublication = undefined;
    return { operationId: active.operationId, request: active.request, evidence };
  }
}
