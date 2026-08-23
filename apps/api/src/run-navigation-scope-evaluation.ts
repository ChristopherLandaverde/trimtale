import {
  assertNavigationScopeAcceptanceCorpus,
  type NavigationScopeAcceptanceCorpusV1,
  type NavigationScopeEvaluationTier,
} from "@gtm-observability/core";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  runNavigationScopeEvaluation,
  type NavigationScopeEvaluationProvider,
  type NavigationScopeEvaluationReportV1,
} from "./navigation-scope-evaluations.js";
import { configuredOllamaNavigationScopeProvider } from "./ollama-navigation-scope-provider.js";

const CORPUS_PATH = "tests/acceptance/navigation-scope-interpretation.json";
const DEFAULT_TIMEOUT_MS = 35_000;

export interface RunNavigationScopeEvaluationCommandOptions {
  workspaceRoot?: string;
  environment?: NodeJS.ProcessEnv;
  tier?: NavigationScopeEvaluationTier;
  provider?: NavigationScopeEvaluationProvider;
  timeoutMs?: number;
  writeOutput?: (message: string) => void;
}

function loadCorpus(workspaceRoot: string): NavigationScopeAcceptanceCorpusV1 {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(resolve(workspaceRoot, CORPUS_PATH), "utf8"));
  } catch {
    throw new Error("Navigation scope acceptance corpus could not be loaded.");
  }
  assertNavigationScopeAcceptanceCorpus(value);
  return value;
}

function safeSummary(report: NavigationScopeEvaluationReportV1): string {
  return JSON.stringify({
    schemaVersion: report.schemaVersion,
    provider: report.provider,
    tier: report.tier,
    corpusCaseCount: report.corpusCaseCount,
    selectedCaseCount: report.selectedCaseCount,
    deterministicCaseCount: report.deterministicCaseCount,
    providerCaseCount: report.providerCaseCount,
    outcomes: report.outcomes,
    passed: report.passed,
    cases: report.cases.filter(({ outcome }) => outcome !== "pass"),
  });
}

export async function runNavigationScopeEvaluationCommand(
  options: RunNavigationScopeEvaluationCommandOptions = {},
): Promise<NavigationScopeEvaluationReportV1> {
  let workspaceRoot: string;
  try {
    workspaceRoot = realpathSync(resolve(options.workspaceRoot ?? process.cwd()));
  } catch {
    throw new Error("Navigation scope evaluation workspace could not be loaded.");
  }
  const environment = options.environment ?? process.env;
  const tier = options.tier ?? "smoke";
  const provider = options.provider ?? configuredOllamaNavigationScopeProvider(environment);
  if (!provider) throw new Error("The local navigation scope model is disabled.");
  const report = await runNavigationScopeEvaluation(provider, loadCorpus(workspaceRoot), {
    tier,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  (options.writeOutput ?? console.log)(safeSummary(report));
  return report;
}

function commandTier(value: string | undefined): NavigationScopeEvaluationTier {
  if (value === "smoke" || value === "full") return value;
  throw new Error("Navigation scope evaluation requires the smoke or full tier.");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  runNavigationScopeEvaluationCommand({ tier: commandTier(process.argv[2]) })
    .then((report) => {
      if (!report.passed) process.exitCode = 1;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Navigation scope evaluation failed.");
      process.exitCode = 1;
    });
}
