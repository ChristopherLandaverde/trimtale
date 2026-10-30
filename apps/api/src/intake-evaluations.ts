import {
  INTAKE_INTERPRETATION_SCHEMA_VERSION,
  INTAKE_EVALUATION_SCHEMA_VERSION,
  IntakeShadowHarness,
  assertIntakeAcceptanceCorpus,
  evaluateIntakeProviders,
  validateIntakeProviderEvaluation,
  type IntakeAcceptanceCorpusV1,
  type IntakeProviderEvaluationV1,
  type IntakeShadowHarnessOptions,
  type IntakeShadowProvider,
  type IntakeShadowRecordV1,
} from "@trimtale/core";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const INTAKE_EVALUATION_REPORT_SCHEMA_VERSION = 1 as const;

export interface IntakeEvaluationReportV1 {
  schemaVersion: typeof INTAKE_EVALUATION_REPORT_SCHEMA_VERSION;
  id: string;
  createdAt: string;
  corpusSchemaVersion: typeof INTAKE_INTERPRETATION_SCHEMA_VERSION;
  corpusCaseCount: number;
  providers: IntakeProviderEvaluationV1[];
}

interface IntakeEvaluationReportCollectionV1 {
  schemaVersion: 1;
  reports: IntakeEvaluationReportV1[];
}

export interface IntakeEvaluationRunnerOptions {
  timeoutMs?: number;
  now?: () => number;
  createReportId?: () => string;
  createShadowRunId?: () => string;
}

export type CreateIntakeEvaluationReportResult =
  | { accepted: true; report: IntakeEvaluationReportV1 }
  | { accepted: false; error: "already_exists" };

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unexpectedKeys(value: Record<string, unknown>, allowed: string[], path: string): string[] {
  const allowlist = new Set(allowed);
  return Object.keys(value)
    .filter((key) => !allowlist.has(key))
    .map(() => `${path} contains an unexpected field`);
}

function sameMembers(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item) => right.includes(item));
}

export function validateIntakeEvaluationReport(value: unknown): string[] {
  if (!isRecord(value)) return ["intake evaluation report must be an object"];
  const errors = unexpectedKeys(
    value,
    ["schemaVersion", "id", "createdAt", "corpusSchemaVersion", "corpusCaseCount", "providers"],
    "intake evaluation report",
  );
  if (value.schemaVersion !== INTAKE_EVALUATION_REPORT_SCHEMA_VERSION) {
    errors.push("intake evaluation report schemaVersion must be 1");
  }
  if (typeof value.id !== "string" || !IDENTIFIER.test(value.id)) errors.push("intake evaluation report id is invalid");
  if (typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) {
    errors.push("intake evaluation report createdAt must be an ISO date");
  }
  if (value.corpusSchemaVersion !== INTAKE_INTERPRETATION_SCHEMA_VERSION) {
    errors.push("intake evaluation report corpusSchemaVersion must be 1");
  }
  if (!Number.isInteger(value.corpusCaseCount) || Number(value.corpusCaseCount) < 1) {
    errors.push("intake evaluation report corpusCaseCount is invalid");
  }
  const providers = Array.isArray(value.providers) ? value.providers : [];
  if (!Array.isArray(value.providers) || providers.length < 2 || providers.length > 3) {
    errors.push("intake evaluation report requires two or three providers");
  }
  for (const provider of providers) {
    errors.push(...validateIntakeProviderEvaluation(provider)
      .map(() => "intake evaluation report contains an invalid provider evaluation"));
  }
  const validProviders = providers.filter((provider): provider is IntakeProviderEvaluationV1 => (
    validateIntakeProviderEvaluation(provider).length === 0
  ));
  if (new Set(validProviders.map((provider) => provider.providerId)).size !== validProviders.length) {
    errors.push("intake evaluation report provider IDs must be unique");
  }
  if (validProviders.some((provider) => provider.caseCount !== value.corpusCaseCount)) {
    errors.push("intake evaluation report provider case counts must match the corpus");
  }
  const expectedCaseIds = validProviders[0]?.cases.map((item) => item.inputId) ?? [];
  if (validProviders.some((provider) => !sameMembers(
    provider.cases.map((item) => item.inputId),
    expectedCaseIds,
  ))) {
    errors.push("intake evaluation report providers must cover the same cases");
  }
  return [...new Set(errors)];
}

export function assertIntakeEvaluationReport(value: unknown): asserts value is IntakeEvaluationReportV1 {
  const errors = validateIntakeEvaluationReport(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export class IntakeEvaluationReportRepository {
  readonly #items = new Map<string, IntakeEvaluationReportV1>();

  constructor(readonly filePath: string) {
    this.#load();
  }

  create(input: unknown): CreateIntakeEvaluationReportResult {
    assertIntakeEvaluationReport(input);
    this.#refresh();
    if (this.#items.has(input.id)) return { accepted: false, error: "already_exists" };
    this.#items.set(input.id, structuredClone(input));
    this.#persist();
    return { accepted: true, report: structuredClone(input) };
  }

  get(id: string): IntakeEvaluationReportV1 | undefined {
    const report = this.#items.get(id);
    return report ? structuredClone(report) : undefined;
  }

  list(): IntakeEvaluationReportV1[] {
    return [...this.#items.values()]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
      .map((report) => structuredClone(report));
  }

  #load(): void {
    if (!existsSync(this.filePath)) return;
    this.#replaceFromDisk();
  }

  #refresh(): void {
    if (!existsSync(this.filePath)) {
      this.#items.clear();
      return;
    }
    this.#replaceFromDisk();
  }

  #replaceFromDisk(): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.filePath, "utf8"));
    } catch {
      throw new Error("Corrupted intake-evaluation report collection.");
    }
    if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.reports)) {
      throw new Error("Unsupported intake-evaluation report collection schema.");
    }
    const loaded = new Map<string, IntakeEvaluationReportV1>();
    for (const candidate of parsed.reports) {
      try {
        assertIntakeEvaluationReport(candidate);
      } catch {
        throw new Error("Invalid intake-evaluation report in collection.");
      }
      if (loaded.has(candidate.id)) throw new Error(`Duplicate intake-evaluation report: ${candidate.id}.`);
      loaded.set(candidate.id, structuredClone(candidate));
    }
    this.#items.clear();
    for (const [id, report] of loaded) this.#items.set(id, report);
  }

  #persist(): void {
    const collection: IntakeEvaluationReportCollectionV1 = {
      schemaVersion: 1,
      reports: this.list(),
    };
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(collection, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, this.filePath);
  }
}

export class IntakeEvaluationRunner {
  readonly providers: IntakeShadowProvider[];
  readonly #timeoutMs: number | undefined;
  readonly #now: (() => number) | undefined;
  readonly #createReportId: () => string;
  readonly #createShadowRunId: (() => string) | undefined;

  constructor(
    providers: IntakeShadowProvider[],
    readonly repository: IntakeEvaluationReportRepository,
    options: IntakeEvaluationRunnerOptions = {},
  ) {
    if (providers.length < 2 || providers.length > 3) {
      throw new TypeError("Intake evaluation requires two or three providers.");
    }
    if (new Set(providers.map((provider) => provider.id)).size !== providers.length) {
      throw new TypeError("Intake evaluation provider IDs must be unique.");
    }
    if (providers.some((provider) => !IDENTIFIER.test(provider.id))) {
      throw new TypeError("Intake evaluation provider IDs are invalid.");
    }
    if (options.timeoutMs !== undefined
      && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 120_000)) {
      throw new TypeError("Intake evaluation timeout is invalid.");
    }
    this.providers = providers.map((provider) => ({
      id: provider.id,
      interpret: provider.interpret.bind(provider),
    }));
    this.#timeoutMs = options.timeoutMs;
    this.#now = options.now;
    this.#createReportId = options.createReportId ?? (() => `intake_report_${randomUUID()}`);
    this.#createShadowRunId = options.createShadowRunId;
  }

  async run(value: unknown): Promise<IntakeEvaluationReportV1> {
    assertIntakeAcceptanceCorpus(value);
    const corpus: IntakeAcceptanceCorpusV1 = value;
    const reportId = this.#createReportId();
    if (!IDENTIFIER.test(reportId)) throw new Error("Intake evaluation report ID is invalid.");
    if (this.repository.get(reportId)) throw new Error("Intake evaluation report already exists.");
    const now = this.#now?.() ?? Date.now();
    if (!Number.isFinite(now) || Number.isNaN(new Date(now).getTime())) {
      throw new Error("Intake evaluation runtime clock is invalid.");
    }
    const records: IntakeShadowRecordV1[] = [];
    for (const provider of this.providers) {
      const harnessOptions: IntakeShadowHarnessOptions = {};
      if (this.#timeoutMs !== undefined) harnessOptions.timeoutMs = this.#timeoutMs;
      if (this.#now !== undefined) harnessOptions.now = this.#now;
      if (this.#createShadowRunId !== undefined) harnessOptions.createRunId = this.#createShadowRunId;
      records.push(...await new IntakeShadowHarness(provider, harnessOptions).runCorpus(corpus.cases));
    }

    const report: IntakeEvaluationReportV1 = {
      schemaVersion: INTAKE_EVALUATION_REPORT_SCHEMA_VERSION,
      id: reportId,
      createdAt: new Date(now).toISOString(),
      corpusSchemaVersion: corpus.schemaVersion,
      corpusCaseCount: corpus.cases.length,
      providers: evaluateIntakeProviders(corpus.cases, records),
    };
    assertIntakeEvaluationReport(report);
    const created = this.repository.create(report);
    if (!created.accepted) throw new Error("Intake evaluation report already exists.");
    return created.report;
  }
}
