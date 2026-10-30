import {
  assertIntakeAcceptanceCorpus,
  type IntakeAcceptanceCorpusV1,
} from "@trimtale/core";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  IntakeEvaluationReportRepository,
  IntakeEvaluationRunner,
  type IntakeEvaluationReportV1,
} from "./intake-evaluations.js";
import {
  OpenAIIntakeProvider,
  type IntakeProviderFetch,
} from "./openai-intake-provider.js";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAXIMUM_TIMEOUT_MS = 120_000;
const MAXIMUM_OUTPUT_TOKENS = 16_000;
const MAXIMUM_COST_PER_MILLION_TOKENS_USD = 1_000;
const MAXIMUM_RELATIVE_PATH_LENGTH = 240;
const CORPUS_PATH = "tests/acceptance/intake-interpretation.json";

export interface IntakeEvaluationModelConfigV1 {
  id: string;
  model: string;
  inputCostPerMillionTokensUsd: number;
  outputCostPerMillionTokensUsd: number;
}

export interface IntakeEvaluationCommandConfigV1 {
  schemaVersion: 1;
  reportPath: string;
  timeoutMs: number;
  maxOutputTokens: number;
  providers: IntakeEvaluationModelConfigV1[];
}

export interface RunIntakeEvaluationCommandOptions {
  workspaceRoot?: string;
  environment?: NodeJS.ProcessEnv;
  fetchImpl?: IntakeProviderFetch;
  writeOutput?: (message: string) => void;
  createReportId?: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unexpectedKeys(value: Record<string, unknown>, allowed: string[], path: string): string[] {
  const allowlist = new Set(allowed);
  return Object.keys(value)
    .filter((key) => !allowlist.has(key))
    .map(() => `${path} contains an unexpected field`);
}

function validRate(value: unknown): value is number {
  return typeof value === "number"
    && Number.isFinite(value)
    && value > 0
    && value <= MAXIMUM_COST_PER_MILLION_TOKENS_USD;
}

function validRelativeJsonPath(value: unknown): value is string {
  if (typeof value !== "string"
    || value.length === 0
    || value.length > MAXIMUM_RELATIVE_PATH_LENGTH
    || isAbsolute(value)
    || !value.endsWith(".json")
    || value.includes("\\")
    || /[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }
  const segments = value.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function resolveInsideWorkspace(workspaceRoot: string, relativePath: string): string {
  const root = resolve(workspaceRoot);
  const target = resolve(root, relativePath);
  if (!target.startsWith(`${root}${sep}`)) throw new Error("Intake evaluation path must stay inside the workspace.");
  return target;
}

function assertNoSymbolicLinks(workspaceRoot: string, target: string, label: string): void {
  const segments = relative(workspaceRoot, target).split(sep);
  let current = workspaceRoot;
  for (const segment of segments) {
    current = join(current, segment);
    if (!existsSync(current)) return;
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`${label} must not contain symbolic links.`);
    }
  }
}

export function validateIntakeEvaluationCommandConfig(value: unknown): string[] {
  if (!isRecord(value)) return ["intake evaluation configuration must be an object"];
  const errors = unexpectedKeys(
    value,
    ["schemaVersion", "reportPath", "timeoutMs", "maxOutputTokens", "providers"],
    "intake evaluation configuration",
  );
  if (value.schemaVersion !== 1) errors.push("intake evaluation configuration schemaVersion must be 1");
  if (!validRelativeJsonPath(value.reportPath)
    || !String(value.reportPath).startsWith(".data/")) {
    errors.push("intake evaluation configuration reportPath must be a JSON path under .data");
  }
  if (!Number.isInteger(value.timeoutMs)
    || Number(value.timeoutMs) < 1
    || Number(value.timeoutMs) > MAXIMUM_TIMEOUT_MS) {
    errors.push("intake evaluation configuration timeoutMs is invalid");
  }
  if (!Number.isInteger(value.maxOutputTokens)
    || Number(value.maxOutputTokens) < 1
    || Number(value.maxOutputTokens) > MAXIMUM_OUTPUT_TOKENS) {
    errors.push("intake evaluation configuration maxOutputTokens is invalid");
  }

  const providers = Array.isArray(value.providers) ? value.providers : [];
  if (!Array.isArray(value.providers) || providers.length < 2 || providers.length > 3) {
    errors.push("intake evaluation configuration requires two or three providers");
  }
  const providerIds: string[] = [];
  const modelIds: string[] = [];
  providers.forEach((provider, index) => {
    if (!isRecord(provider)) {
      errors.push(`intake evaluation provider ${index} must be an object`);
      return;
    }
    errors.push(...unexpectedKeys(
      provider,
      ["id", "model", "inputCostPerMillionTokensUsd", "outputCostPerMillionTokensUsd"],
      `intake evaluation provider ${index}`,
    ));
    if (typeof provider.id !== "string" || !IDENTIFIER.test(provider.id)) {
      errors.push(`intake evaluation provider ${index} id is invalid`);
    } else {
      providerIds.push(provider.id);
    }
    if (typeof provider.model !== "string" || !IDENTIFIER.test(provider.model)) {
      errors.push(`intake evaluation provider ${index} model is invalid`);
    } else {
      modelIds.push(provider.model);
    }
    if (!validRate(provider.inputCostPerMillionTokensUsd)
      || !validRate(provider.outputCostPerMillionTokensUsd)) {
      errors.push(`intake evaluation provider ${index} cost is invalid`);
    }
  });
  if (new Set(providerIds).size !== providerIds.length) {
    errors.push("intake evaluation provider IDs must be unique");
  }
  if (new Set(modelIds).size !== modelIds.length) {
    errors.push("intake evaluation model IDs must be unique");
  }
  return [...new Set(errors)];
}

function assertCommandConfig(value: unknown): asserts value is IntakeEvaluationCommandConfigV1 {
  const errors = validateIntakeEvaluationCommandConfig(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

function loadJson(path: string, label: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`${label} could not be loaded.`);
  }
}

function loadApiKey(environment: NodeJS.ProcessEnv): string {
  const apiKey = environment.OPENAI_API_KEY;
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new Error("OPENAI_API_KEY is required for intake evaluation.");
  }
  return apiKey;
}

function loadConfigPath(environment: NodeJS.ProcessEnv, workspaceRoot: string): string {
  const configPath = environment.INTAKE_EVALUATION_CONFIG;
  if (!validRelativeJsonPath(configPath)) {
    throw new Error("INTAKE_EVALUATION_CONFIG must be a workspace-relative JSON path.");
  }
  return resolveInsideWorkspace(workspaceRoot, configPath);
}

function commandSummary(report: IntakeEvaluationReportV1): string {
  return JSON.stringify({
    schemaVersion: 1,
    reportId: report.id,
    createdAt: report.createdAt,
    corpusCaseCount: report.corpusCaseCount,
    providers: report.providers.map((provider) => ({
      providerId: provider.providerId,
      averageScore: provider.averageScore,
      outcomes: provider.outcomes,
      latency: provider.latency,
      usage: provider.usage,
    })),
  });
}

export async function runIntakeEvaluationCommand(
  options: RunIntakeEvaluationCommandOptions = {},
): Promise<IntakeEvaluationReportV1> {
  let workspaceRoot: string;
  try {
    workspaceRoot = realpathSync(resolve(options.workspaceRoot ?? process.cwd()));
  } catch {
    throw new Error("Intake evaluation workspace root could not be loaded.");
  }
  const environment = options.environment ?? process.env;
  const apiKey = loadApiKey(environment);
  const configPath = loadConfigPath(environment, workspaceRoot);
  assertNoSymbolicLinks(workspaceRoot, configPath, "Intake evaluation configuration path");
  const configValue = loadJson(configPath, "Intake evaluation configuration");
  assertCommandConfig(configValue);
  const config = configValue;
  const corpusPath = resolveInsideWorkspace(workspaceRoot, CORPUS_PATH);
  assertNoSymbolicLinks(workspaceRoot, corpusPath, "Intake acceptance corpus path");
  const corpusValue = loadJson(corpusPath, "Intake acceptance corpus");
  assertIntakeAcceptanceCorpus(corpusValue);
  const corpus: IntakeAcceptanceCorpusV1 = corpusValue;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const providers = config.providers.map((provider) => new OpenAIIntakeProvider({
    ...provider,
    apiKey,
    maxOutputTokens: config.maxOutputTokens,
  }, fetchImpl));
  const reportPath = resolveInsideWorkspace(workspaceRoot, config.reportPath);
  assertNoSymbolicLinks(workspaceRoot, reportPath, "Intake evaluation report path");
  const repository = new IntakeEvaluationReportRepository(reportPath);
  const runnerOptions = options.createReportId
    ? { timeoutMs: config.timeoutMs, createReportId: options.createReportId }
    : { timeoutMs: config.timeoutMs };
  const report = await new IntakeEvaluationRunner(providers, repository, runnerOptions).run(corpus);
  (options.writeOutput ?? console.log)(commandSummary(report));
  return report;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  runIntakeEvaluationCommand().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Intake evaluation command failed.");
    process.exitCode = 1;
  });
}
