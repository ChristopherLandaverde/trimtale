import {
  evaluateNavigationScopeAcceptanceCase,
  navigationScopeInterpretationRoute,
  type NavigationScopeAcceptanceCorpusV1,
  type NavigationScopeCaseEvaluationV1,
  type NavigationScopeEvaluationTier,
  type NavigationScopeInterpretationInputV1,
  type NavigationScopeInterpretationV1,
} from "@gtm-observability/core";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAXIMUM_TIMEOUT_MS = 120_000;

export interface NavigationScopeEvaluationProvider {
  readonly id: string;
  readonly model: string;
  interpret(input: NavigationScopeInterpretationInputV1, signal: AbortSignal): Promise<NavigationScopeInterpretationV1>;
}

export interface NavigationScopeEvaluationReportV1 {
  schemaVersion: 1;
  provider: { id: string; model: string };
  tier: NavigationScopeEvaluationTier;
  corpusCaseCount: number;
  selectedCaseCount: number;
  deterministicCaseCount: number;
  providerCaseCount: number;
  outcomes: { pass: number; fail: number; inconclusive: number };
  passed: boolean;
  cases: NavigationScopeCaseEvaluationV1[];
}

export interface NavigationScopeEvaluationRunnerOptions {
  tier: NavigationScopeEvaluationTier;
  timeoutMs: number;
}

function assertOptions(
  provider: NavigationScopeEvaluationProvider,
  options: NavigationScopeEvaluationRunnerOptions,
): void {
  if (!IDENTIFIER.test(provider.id) || !IDENTIFIER.test(provider.model)) {
    throw new TypeError("Navigation scope evaluation provider identity is invalid.");
  }
  if (!['smoke', 'full'].includes(options.tier)) {
    throw new TypeError("Navigation scope evaluation tier is invalid.");
  }
  if (!Number.isSafeInteger(options.timeoutMs)
    || options.timeoutMs < 1
    || options.timeoutMs > MAXIMUM_TIMEOUT_MS) {
    throw new TypeError("Navigation scope evaluation timeout is invalid.");
  }
}

async function runCase(
  provider: NavigationScopeEvaluationProvider,
  item: NavigationScopeAcceptanceCorpusV1["cases"][number],
  timeoutMs: number,
): Promise<{ evaluation: NavigationScopeCaseEvaluationV1; source: "deterministic" | "provider" }> {
  const route = navigationScopeInterpretationRoute(item.input.messages, item.input.groups.map((group) => ({
    ...group,
    targetIds: Array.from({ length: group.targetCount }, (_unused, index) => `${group.id}_target_${index + 1}`),
  })));
  if (route.source === "deterministic") {
    return {
      evaluation: evaluateNavigationScopeAcceptanceCase(item, {
        status: "accepted",
        interpretation: route.fallback,
      }),
      source: "deterministic",
    };
  }
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error("provider timeout"));
    }, timeoutMs);
  });
  try {
    const interpretation = await Promise.race([
      provider.interpret(item.input, controller.signal),
      timeout,
    ]);
    return {
      evaluation: evaluateNavigationScopeAcceptanceCase(item, { status: "accepted", interpretation }),
      source: "provider",
    };
  } catch {
    return {
      evaluation: evaluateNavigationScopeAcceptanceCase(item, {
        status: "unavailable",
        failure: timedOut ? "provider_timeout" : "provider_error",
      }),
      source: "provider",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runNavigationScopeEvaluation(
  provider: NavigationScopeEvaluationProvider,
  corpus: NavigationScopeAcceptanceCorpusV1,
  options: NavigationScopeEvaluationRunnerOptions,
): Promise<NavigationScopeEvaluationReportV1> {
  assertOptions(provider, options);
  const selected = options.tier === "smoke"
    ? corpus.cases.filter(({ tier }) => tier === "smoke")
    : corpus.cases;
  if (selected.length === 0) throw new Error("Navigation scope evaluation selected no cases.");
  const cases: NavigationScopeCaseEvaluationV1[] = [];
  let deterministicCaseCount = 0;
  let providerCaseCount = 0;
  for (const item of selected) {
    const result = await runCase(provider, item, options.timeoutMs);
    cases.push(result.evaluation);
    if (result.source === "deterministic") deterministicCaseCount += 1;
    else providerCaseCount += 1;
  }
  const outcomes = {
    pass: cases.filter(({ outcome }) => outcome === "pass").length,
    fail: cases.filter(({ outcome }) => outcome === "fail").length,
    inconclusive: cases.filter(({ outcome }) => outcome === "inconclusive").length,
  };
  return {
    schemaVersion: 1,
    provider: { id: provider.id, model: provider.model },
    tier: options.tier,
    corpusCaseCount: corpus.cases.length,
    selectedCaseCount: selected.length,
    deterministicCaseCount,
    providerCaseCount,
    outcomes,
    passed: outcomes.pass === selected.length,
    cases,
  };
}
