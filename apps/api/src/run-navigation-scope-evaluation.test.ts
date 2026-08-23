import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertNavigationScopeAcceptanceCorpus,
  canonicalPassingNavigationScopeInterpretation,
  type NavigationScopeAcceptanceCorpusV1,
} from "@gtm-observability/core";
import {
  runNavigationScopeEvaluation,
  type NavigationScopeEvaluationProvider,
} from "./navigation-scope-evaluations.js";
import { runNavigationScopeEvaluationCommand } from "./run-navigation-scope-evaluation.js";

function loadCorpus(): NavigationScopeAcceptanceCorpusV1 {
  const value: unknown = JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/navigation-scope-interpretation.json"),
    "utf8",
  ));
  assertNavigationScopeAcceptanceCorpus(value);
  return value;
}

function fixtureProvider(
  corpus: NavigationScopeAcceptanceCorpusV1,
  override?: (caseId: string) => unknown,
): NavigationScopeEvaluationProvider {
  const byInput = new Map(corpus.cases.map((item) => [JSON.stringify(item.input), item]));
  return {
    id: "fixture-provider",
    model: "fixture-model",
    async interpret(input) {
      const item = byInput.get(JSON.stringify(input));
      if (!item) throw new Error("unexpected fixture input");
      return (override?.(item.id) ?? canonicalPassingNavigationScopeInterpretation(item)) as never;
    },
  };
}

describe("automated navigation scope evaluation command", () => {
  it("runs the bounded smoke tier and the complete corpus through the same evaluator", async () => {
    const corpus = loadCorpus();
    const provider = fixtureProvider(corpus);
    const smoke = await runNavigationScopeEvaluation(provider, corpus, { tier: "smoke", timeoutMs: 100 });
    const full = await runNavigationScopeEvaluation(provider, corpus, { tier: "full", timeoutMs: 100 });
    expect(smoke).toMatchObject({
      tier: "smoke",
      corpusCaseCount: 32,
      selectedCaseCount: 15,
      deterministicCaseCount: 9,
      providerCaseCount: 6,
      outcomes: { pass: 15, fail: 0, inconclusive: 0 },
      passed: true,
    });
    expect(full).toMatchObject({
      tier: "full",
      corpusCaseCount: 32,
      selectedCaseCount: 32,
      outcomes: { pass: 32, fail: 0, inconclusive: 0 },
      passed: true,
    });
  });

  it("fails a structurally valid but behaviorally wrong result", async () => {
    const corpus = loadCorpus();
    const providerCase = corpus.cases.find(({ id }) => id === "spatial-top-menu")!;
    const provider = fixtureProvider(corpus, (caseId) => caseId === providerCase.id
      ? { ...canonicalPassingNavigationScopeInterpretation(providerCase), candidateGroupIds: ["footer_nav"] }
      : undefined);
    const report = await runNavigationScopeEvaluation(provider, corpus, { tier: "smoke", timeoutMs: 100 });
    expect(report.passed).toBe(false);
    expect(report.outcomes).toEqual({ pass: 14, fail: 1, inconclusive: 0 });
    expect(report.cases.find(({ caseId }) => caseId === providerCase.id))
      .toMatchObject({ outcome: "fail", failures: ["unexpected_candidates"] });
  });

  it("makes provider errors and timeouts visible and non-passing", async () => {
    const corpus = loadCorpus();
    const providerError: NavigationScopeEvaluationProvider = {
      id: "error-provider",
      model: "fixture-model",
      async interpret() { throw new Error("private provider detail"); },
    };
    const errorReport = await runNavigationScopeEvaluation(
      providerError,
      corpus,
      { tier: "smoke", timeoutMs: 100 },
    );
    expect(errorReport).toMatchObject({
      passed: false,
      deterministicCaseCount: 9,
      providerCaseCount: 6,
      outcomes: { pass: 9, fail: 0, inconclusive: 6 },
    });
    expect(errorReport.cases.filter(({ outcome }) => outcome === "inconclusive")
      .every(({ harnessFailure }) => harnessFailure === "provider_error")).toBe(true);

    const timeoutProvider: NavigationScopeEvaluationProvider = {
      id: "timeout-provider",
      model: "fixture-model",
      async interpret(_input, signal) {
        return await new Promise<never>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      },
    };
    const timeoutCase = corpus.cases.find(({ id }) => id === "spatial-top-menu")!;
    const timeoutReport = await runNavigationScopeEvaluation(
      timeoutProvider,
      { ...corpus, cases: [timeoutCase] },
      { tier: "full", timeoutMs: 5 },
    );
    expect(timeoutReport.cases[0]).toMatchObject({
      outcome: "inconclusive",
      harnessFailure: "provider_timeout",
    });
  });

  it("emits only a privacy-safe functional summary", async () => {
    const corpus = loadCorpus();
    const output = vi.fn();
    const report = await runNavigationScopeEvaluationCommand({
      workspaceRoot: process.cwd(),
      tier: "full",
      timeoutMs: 100,
      provider: fixtureProvider(corpus),
      writeOutput: output,
    });
    expect(report.passed).toBe(true);
    expect(output).toHaveBeenCalledOnce();
    const summary = output.mock.calls[0]![0] as string;
    expect(JSON.parse(summary)).toMatchObject({
      tier: "full",
      selectedCaseCount: 32,
      passed: true,
      cases: [],
    });
    expect(summary).not.toContain("person@example.test");
    expect(summary).not.toContain("Track the top menu");
    expect(summary).not.toContain("clarification");
  });

  it("rejects invalid provider identity and timeout configuration", async () => {
    const corpus = loadCorpus();
    await expect(runNavigationScopeEvaluation(
      { ...fixtureProvider(corpus), id: "invalid provider" },
      corpus,
      { tier: "smoke", timeoutMs: 100 },
    )).rejects.toThrow("provider identity is invalid");
    await expect(runNavigationScopeEvaluation(
      fixtureProvider(corpus),
      corpus,
      { tier: "smoke", timeoutMs: 0 },
    )).rejects.toThrow("timeout is invalid");
  });
});
