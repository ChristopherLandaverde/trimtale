import {
  assertIntakeInterpretation,
  assertIntakeInterpretationInput,
  validateIntakeInterpretation,
  type IntakeAcceptanceCaseV1,
  type IntakeInterpretationInputV1,
  type IntakeInterpretationV1,
} from "./intake-interpretation.js";

export const INTAKE_SHADOW_SCHEMA_VERSION = 1 as const;

export type IntakeShadowStatus = "accepted" | "rejected" | "inconclusive";

export type IntakeShadowFailureCode =
  | "invalid_provider_output"
  | "provider_error"
  | "provider_timeout";

export interface IntakeShadowUsageV1 {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface IntakeShadowInputSummaryV1 {
  messageCount: number;
  pageCandidateCount: number;
  successEvidenceCandidateCount: number;
  redactedValueCount: number;
  truncatedCandidateLabelCount: number;
}

export interface IntakeShadowRecordV1 {
  schemaVersion: typeof INTAKE_SHADOW_SCHEMA_VERSION;
  runId: string;
  inputId: string;
  providerId: string;
  startedAt: string;
  durationMs: number;
  status: IntakeShadowStatus;
  inputSummary: IntakeShadowInputSummaryV1;
  deterministicBaseline: IntakeInterpretationV1;
  providerInterpretation: IntakeInterpretationV1 | null;
  failureCode: IntakeShadowFailureCode | null;
  usage: IntakeShadowUsageV1 | null;
}

export interface IntakeShadowProviderContext {
  signal: AbortSignal;
}

export interface IntakeShadowProvider {
  id: string;
  interpret(
    input: Readonly<IntakeInterpretationInputV1>,
    context: IntakeShadowProviderContext,
  ): Promise<unknown>;
}

export interface IntakeShadowRequest {
  inputId: string;
  input: unknown;
  deterministicBaseline: unknown;
}

export interface IntakeShadowHarnessOptions {
  timeoutMs?: number;
  now?: () => number;
  createRunId?: () => string;
}

export type IntakeShadowHarnessErrorCode =
  | "invalid_input"
  | "invalid_baseline"
  | "invalid_run_id"
  | "invalid_runtime_clock";

export class IntakeShadowHarnessError extends Error {
  constructor(readonly code: IntakeShadowHarnessErrorCode) {
    super(`Intake shadow harness rejected ${code.replaceAll("_", " ")}.`);
    this.name = "IntakeShadowHarnessError";
  }
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAXIMUM_TIMEOUT_MS = 120_000;
const MAXIMUM_TOKEN_COUNT = 100_000_000;
const MAXIMUM_ESTIMATED_COST_USD = 1_000_000;
const TIMEOUT = Symbol("intake-shadow-timeout");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unexpectedKeys(value: Record<string, unknown>, allowed: string[], path: string): string[] {
  const allowlist = new Set(allowed);
  return Object.keys(value)
    .filter((key) => !allowlist.has(key))
    .map(() => `${path} contains an unexpected field`);
}

function isNonNegativeInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum;
}

function validUsage(value: unknown): value is IntakeShadowUsageV1 {
  if (!isRecord(value)) return false;
  if (unexpectedKeys(value, ["inputTokens", "outputTokens", "estimatedCostUsd"], "usage").length > 0) {
    return false;
  }
  return isNonNegativeInteger(value.inputTokens, MAXIMUM_TOKEN_COUNT)
    && isNonNegativeInteger(value.outputTokens, MAXIMUM_TOKEN_COUNT)
    && typeof value.estimatedCostUsd === "number"
    && Number.isFinite(value.estimatedCostUsd)
    && value.estimatedCostUsd >= 0
    && value.estimatedCostUsd <= MAXIMUM_ESTIMATED_COST_USD;
}

function inputSummary(input: IntakeInterpretationInputV1): IntakeShadowInputSummaryV1 {
  return {
    messageCount: input.messages.length,
    pageCandidateCount: input.pageCandidates.length,
    successEvidenceCandidateCount: input.successEvidenceCandidates.length,
    redactedValueCount: input.privacy.redactedValueCount,
    truncatedCandidateLabelCount: input.privacy.truncatedCandidateLabelIds.length,
  };
}

function sameInputSummary(left: Record<string, unknown>, right: IntakeShadowInputSummaryV1): boolean {
  return left.messageCount === right.messageCount
    && left.pageCandidateCount === right.pageCandidateCount
    && left.successEvidenceCandidateCount === right.successEvidenceCandidateCount
    && left.redactedValueCount === right.redactedValueCount
    && left.truncatedCandidateLabelCount === right.truncatedCandidateLabelCount;
}

function providerResponse(
  input: IntakeInterpretationInputV1,
  value: unknown,
): { interpretation: IntakeInterpretationV1; usage: IntakeShadowUsageV1 | null } | undefined {
  if (!isRecord(value)) return undefined;
  if (unexpectedKeys(value, ["interpretation", "usage"], "provider response").length > 0) return undefined;
  if (validateIntakeInterpretation(input, value.interpretation).length > 0) return undefined;
  if (value.usage !== undefined && !validUsage(value.usage)) return undefined;
  try {
    return {
      interpretation: structuredClone(value.interpretation as IntakeInterpretationV1),
      usage: value.usage === undefined ? null : structuredClone(value.usage),
    };
  } catch {
    return undefined;
  }
}

export function validateIntakeShadowRecord(input: unknown, value: unknown): string[] {
  const errors: string[] = [];
  try {
    assertIntakeInterpretationInput(input);
  } catch {
    return ["record input is invalid"];
  }
  if (!isRecord(value)) return ["shadow record must be an object"];
  errors.push(...unexpectedKeys(
    value,
    [
      "schemaVersion",
      "runId",
      "inputId",
      "providerId",
      "startedAt",
      "durationMs",
      "status",
      "inputSummary",
      "deterministicBaseline",
      "providerInterpretation",
      "failureCode",
      "usage",
    ],
    "shadow record",
  ));
  if (value.schemaVersion !== INTAKE_SHADOW_SCHEMA_VERSION) errors.push("shadow record schemaVersion must be 1");
  for (const key of ["runId", "inputId", "providerId"] as const) {
    if (typeof value[key] !== "string" || !IDENTIFIER.test(value[key])) errors.push(`shadow record ${key} is invalid`);
  }
  if (typeof value.startedAt !== "string" || Number.isNaN(Date.parse(value.startedAt))) {
    errors.push("shadow record startedAt must be an ISO date");
  }
  if (!isNonNegativeInteger(value.durationMs, MAXIMUM_TIMEOUT_MS)) {
    errors.push("shadow record durationMs is invalid");
  }
  if (!isRecord(value.inputSummary)) {
    errors.push("shadow record inputSummary is required");
  } else {
    errors.push(...unexpectedKeys(
      value.inputSummary,
      [
        "messageCount",
        "pageCandidateCount",
        "successEvidenceCandidateCount",
        "redactedValueCount",
        "truncatedCandidateLabelCount",
      ],
      "shadow record inputSummary",
    ));
    if (!sameInputSummary(value.inputSummary, inputSummary(input))) {
      errors.push("shadow record inputSummary does not match input counts");
    }
  }
  errors.push(...validateIntakeInterpretation(input, value.deterministicBaseline)
    .map(() => "shadow record deterministicBaseline is invalid"));

  const status = value.status;
  if (!["accepted", "rejected", "inconclusive"].includes(String(status))) {
    errors.push("shadow record status is invalid");
  }
  if (status === "accepted") {
    errors.push(...validateIntakeInterpretation(input, value.providerInterpretation)
      .map(() => "shadow record providerInterpretation is invalid"));
    if (value.failureCode !== null) errors.push("accepted shadow record failureCode must be null");
    if (value.usage !== null && !validUsage(value.usage)) errors.push("accepted shadow record usage is invalid");
  } else {
    if (value.providerInterpretation !== null) errors.push("non-accepted shadow record must discard providerInterpretation");
    if (value.usage !== null) errors.push("non-accepted shadow record must discard usage");
    if (status === "rejected" && value.failureCode !== "invalid_provider_output") {
      errors.push("rejected shadow record failureCode is invalid");
    }
    if (status === "inconclusive" && !["provider_error", "provider_timeout"].includes(String(value.failureCode))) {
      errors.push("inconclusive shadow record failureCode is invalid");
    }
  }
  return [...new Set(errors)];
}

export function assertIntakeShadowRecord(
  input: IntakeInterpretationInputV1,
  value: unknown,
): asserts value is IntakeShadowRecordV1 {
  const errors = validateIntakeShadowRecord(input, value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export class IntakeShadowHarness {
  readonly #timeoutMs: number;
  readonly #now: () => number;
  readonly #createRunId: () => string;

  constructor(
    readonly provider: IntakeShadowProvider,
    options: IntakeShadowHarnessOptions = {},
  ) {
    if (!IDENTIFIER.test(provider.id)) throw new TypeError("Intake shadow provider id is invalid.");
    const timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAXIMUM_TIMEOUT_MS) {
      throw new TypeError("Intake shadow timeout is invalid.");
    }
    this.#timeoutMs = timeoutMs;
    this.#now = options.now ?? Date.now;
    this.#createRunId = options.createRunId ?? (() => `shadow_${crypto.randomUUID()}`);
  }

  async run(request: IntakeShadowRequest): Promise<IntakeShadowRecordV1> {
    if (!IDENTIFIER.test(request.inputId)) throw new IntakeShadowHarnessError("invalid_input");
    let input: unknown;
    try {
      input = structuredClone(request.input);
      assertIntakeInterpretationInput(input);
    } catch {
      throw new IntakeShadowHarnessError("invalid_input");
    }
    let deterministicBaseline: unknown;
    try {
      deterministicBaseline = structuredClone(request.deterministicBaseline);
      assertIntakeInterpretation(input, deterministicBaseline);
    } catch {
      throw new IntakeShadowHarnessError("invalid_baseline");
    }

    const runId = this.#createRunId();
    if (!IDENTIFIER.test(runId)) throw new IntakeShadowHarnessError("invalid_run_id");
    const startedAtMs = this.#now();
    if (!Number.isFinite(startedAtMs) || Number.isNaN(new Date(startedAtMs).getTime())) {
      throw new IntakeShadowHarnessError("invalid_runtime_clock");
    }
    const base = {
      schemaVersion: INTAKE_SHADOW_SCHEMA_VERSION,
      runId,
      inputId: request.inputId,
      providerId: this.provider.id,
      startedAt: new Date(startedAtMs).toISOString(),
      inputSummary: inputSummary(input),
      deterministicBaseline: structuredClone(deterministicBaseline),
    } as const;

    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<typeof TIMEOUT>((resolve) => {
      timeoutHandle = setTimeout(() => resolve(TIMEOUT), this.#timeoutMs);
    });

    let rawResponse: unknown;
    try {
      rawResponse = await Promise.race([
        Promise.resolve().then(() => this.provider.interpret(structuredClone(input), { signal: controller.signal })),
        timeout,
      ]);
    } catch {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      return this.#record(input, base, startedAtMs, {
        status: "inconclusive",
        providerInterpretation: null,
        failureCode: "provider_error",
        usage: null,
      });
    }
    if (timeoutHandle) clearTimeout(timeoutHandle);

    if (rawResponse === TIMEOUT) {
      controller.abort();
      return this.#record(input, base, startedAtMs, {
        status: "inconclusive",
        providerInterpretation: null,
        failureCode: "provider_timeout",
        usage: null,
      });
    }

    const normalized = providerResponse(input, rawResponse);
    if (!normalized) {
      return this.#record(input, base, startedAtMs, {
        status: "rejected",
        providerInterpretation: null,
        failureCode: "invalid_provider_output",
        usage: null,
      });
    }
    return this.#record(input, base, startedAtMs, {
      status: "accepted",
      providerInterpretation: normalized.interpretation,
      failureCode: null,
      usage: normalized.usage,
    });
  }

  async runCorpus(cases: ReadonlyArray<IntakeAcceptanceCaseV1>): Promise<IntakeShadowRecordV1[]> {
    const records: IntakeShadowRecordV1[] = [];
    for (const item of cases) {
      records.push(await this.run({
        inputId: item.id,
        input: item.input,
        deterministicBaseline: item.expected,
      }));
    }
    return records;
  }

  #record(
    input: IntakeInterpretationInputV1,
    base: Omit<IntakeShadowRecordV1, "durationMs" | "status" | "providerInterpretation" | "failureCode" | "usage">,
    startedAtMs: number,
    outcome: Pick<IntakeShadowRecordV1, "status" | "providerInterpretation" | "failureCode" | "usage">,
  ): IntakeShadowRecordV1 {
    const finishedAtMs = this.#now();
    if (!Number.isFinite(finishedAtMs) || Number.isNaN(new Date(finishedAtMs).getTime())) {
      throw new IntakeShadowHarnessError("invalid_runtime_clock");
    }
    const record: IntakeShadowRecordV1 = {
      ...base,
      durationMs: Math.min(MAXIMUM_TIMEOUT_MS, Math.max(0, Math.round(finishedAtMs - startedAtMs))),
      ...outcome,
    };
    assertIntakeShadowRecord(input, record);
    return structuredClone(record);
  }
}
