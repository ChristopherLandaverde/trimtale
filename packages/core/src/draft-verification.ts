import {
  assertTrackingRunEvidence,
  type TrackingRunEvidenceV1,
} from "./contracts.js";
import type {
  TrackingDraftVerificationV1,
  TrackingSetupOperationV1,
} from "./tracking-operation.js";

export const DRAFT_VERIFICATION_SCHEMA_VERSION = 1 as const;
export const DEFAULT_REPAIR_ATTEMPT_LIMIT = 2;
export const MAX_REPAIR_ATTEMPT_LIMIT = 5;

export interface ExactDraftBrowserRunV1 {
  schemaVersion: typeof DRAFT_VERIFICATION_SCHEMA_VERSION;
  operationId: string;
  setupFingerprint: string;
  workspaceFingerprint: string;
  previewVersionFingerprint: string;
  completedAt: string;
  evidence: TrackingRunEvidenceV1;
}

export type VerifiedDraftBindingV1 = TrackingDraftVerificationV1;

export interface DraftRepairAttemptV1 {
  attempt: number;
  attemptedAt: string;
  intentFingerprint: string;
  fromSetupFingerprint: string;
  toSetupFingerprint: string;
  reasonCode: string;
  result: "applied" | "rejected" | "ambiguous";
}

export interface DraftRepairLedgerV1 {
  schemaVersion: typeof DRAFT_VERIFICATION_SCHEMA_VERSION;
  operationId: string;
  intentFingerprint: string;
  maximumAttempts: number;
  attempts: DraftRepairAttemptV1[];
  status: "available" | "passed_to_verification" | "stopped_ambiguous" | "exhausted";
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const REASON_CODE = /^[a-z][a-z0-9_]{0,79}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validFingerprint(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function shortHash(value: string): string {
  let first = 2166136261;
  let second = 2246822519;
  for (const character of value) {
    const code = character.charCodeAt(0);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return `${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`.slice(0, 12);
}

export function fingerprintDraftValue(prefix: string, value: unknown): string {
  if (!/^[a-z][a-z0-9_]{0,31}$/.test(prefix)) throw new Error("Fingerprint prefix is invalid.");
  return `${prefix}_${shortHash(JSON.stringify(canonicalize(value)))}`;
}

export function setupArtifactFingerprint(operation: TrackingSetupOperationV1): string {
  return fingerprintDraftValue("setup", operation.generatedSetup);
}

export function trackingIntentFingerprint(operation: TrackingSetupOperationV1): string {
  return fingerprintDraftValue("intent", operation.specification);
}

export function validateExactDraftBrowserRun(value: unknown): string[] {
  if (!isRecord(value)) return ["exact draft browser run must be an object"];
  const errors: string[] = [];
  if (value.schemaVersion !== DRAFT_VERIFICATION_SCHEMA_VERSION) errors.push("schemaVersion must be 1");
  if (typeof value.operationId !== "string" || !IDENTIFIER.test(value.operationId)) errors.push("operationId is invalid");
  for (const field of ["setupFingerprint", "workspaceFingerprint", "previewVersionFingerprint"] as const) {
    if (!validFingerprint(value[field])) errors.push(`${field} is invalid`);
  }
  if (!validTimestamp(value.completedAt)) errors.push("completedAt is invalid");
  try {
    assertTrackingRunEvidence(value.evidence);
  } catch {
    errors.push("evidence is invalid");
  }
  return errors;
}

export function bindExactDraftBrowserRun(
  operation: TrackingSetupOperationV1,
  run: ExactDraftBrowserRunV1,
): VerifiedDraftBindingV1 {
  assertExactDraftRunCurrent(operation, run);
  if (run.evidence.verdict.browserVerification !== "passed"
    || run.evidence.verdict.code !== "browser_verified") {
    throw new Error("Only passing browser evidence can verify a workspace draft.");
  }
  return {
    schemaVersion: DRAFT_VERIFICATION_SCHEMA_VERSION,
    operationId: operation.id,
    setupFingerprint: run.setupFingerprint,
    workspaceFingerprint: run.workspaceFingerprint,
    previewVersionFingerprint: run.previewVersionFingerprint,
    evidenceRunId: run.evidence.runId,
    evidenceFingerprint: fingerprintDraftValue("evidence", run.evidence),
    verifiedAt: run.completedAt,
  };
}

export function assertExactDraftRunCurrent(
  operation: TrackingSetupOperationV1,
  run: ExactDraftBrowserRunV1,
): void {
  const errors = validateExactDraftBrowserRun(run);
  if (errors.length > 0) throw new Error(errors.join(" "));
  if (operation.status !== "validated" || operation.validation?.status !== "passed") {
    throw new Error("Exact draft evidence requires a provider-validated workspace.");
  }
  if (!operation.validation.previewVersionFingerprint) {
    throw new Error("Exact draft evidence requires a GTM preview fingerprint.");
  }
  if (run.operationId !== operation.id) throw new Error("Browser evidence belongs to another operation.");
  if (run.evidence.specificationId !== operation.specification.id) {
    throw new Error("Browser evidence belongs to another tracking intent.");
  }
  if (run.setupFingerprint !== setupArtifactFingerprint(operation)) {
    throw new Error("Browser evidence belongs to another generated setup.");
  }
  if (run.workspaceFingerprint !== operation.workspace.fingerprint
    || run.workspaceFingerprint !== operation.validation.workspaceFingerprint) {
    throw new Error("Browser evidence belongs to another workspace fingerprint.");
  }
  if (run.previewVersionFingerprint !== operation.validation.previewVersionFingerprint) {
    throw new Error("Browser evidence belongs to another GTM preview fingerprint.");
  }
}

export function verifiedDraftBindingCurrent(
  operation: TrackingSetupOperationV1,
  binding: VerifiedDraftBindingV1,
): boolean {
  return binding.operationId === operation.id
    && binding.setupFingerprint === setupArtifactFingerprint(operation)
    && binding.workspaceFingerprint === operation.workspace.fingerprint
    && binding.workspaceFingerprint === operation.validation?.workspaceFingerprint
    && binding.previewVersionFingerprint === operation.validation?.previewVersionFingerprint;
}

export function createDraftRepairLedger(
  operation: TrackingSetupOperationV1,
  maximumAttempts = DEFAULT_REPAIR_ATTEMPT_LIMIT,
): DraftRepairLedgerV1 {
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1 || maximumAttempts > MAX_REPAIR_ATTEMPT_LIMIT) {
    throw new Error(`Repair attempt limit must be between 1 and ${MAX_REPAIR_ATTEMPT_LIMIT}.`);
  }
  return {
    schemaVersion: DRAFT_VERIFICATION_SCHEMA_VERSION,
    operationId: operation.id,
    intentFingerprint: trackingIntentFingerprint(operation),
    maximumAttempts,
    attempts: [],
    status: "available",
  };
}

export function recordDraftRepairAttempt(
  ledger: DraftRepairLedgerV1,
  input: Omit<DraftRepairAttemptV1, "attempt" | "intentFingerprint"> & { intentFingerprint: string },
): DraftRepairLedgerV1 {
  if (ledger.status !== "available") throw new Error("Repair ledger does not accept another attempt.");
  if (ledger.attempts.length >= ledger.maximumAttempts) {
    throw new Error("Repair ledger has exhausted its attempt limit.");
  }
  if (input.intentFingerprint !== ledger.intentFingerprint) {
    throw new Error("Repair cannot change the confirmed tracking intent.");
  }
  if (!validTimestamp(input.attemptedAt)
    || !validFingerprint(input.fromSetupFingerprint)
    || !validFingerprint(input.toSetupFingerprint)
    || !REASON_CODE.test(input.reasonCode)
    || !["applied", "rejected", "ambiguous"].includes(input.result)) {
    throw new Error("Repair attempt is invalid.");
  }
  const attempts = [...ledger.attempts, {
    ...input,
    attempt: ledger.attempts.length + 1,
  }];
  const status = input.result === "ambiguous"
    ? "stopped_ambiguous" as const
    : input.result === "rejected" && attempts.length >= ledger.maximumAttempts
      ? "exhausted" as const
      : "available" as const;
  return { ...ledger, attempts, status };
}

export function markRepairPassedToVerification(ledger: DraftRepairLedgerV1): DraftRepairLedgerV1 {
  if (ledger.status !== "available") throw new Error("Only an available repair ledger can continue to verification.");
  if (ledger.attempts.at(-1)?.result !== "applied") {
    throw new Error("Only an applied repair can continue to verification.");
  }
  return { ...ledger, status: "passed_to_verification" };
}

export function resumeDraftRepairAfterFailure(ledger: DraftRepairLedgerV1): DraftRepairLedgerV1 {
  if (ledger.status !== "passed_to_verification") {
    throw new Error("Only a repair awaiting verification can receive failed evidence.");
  }
  return {
    ...ledger,
    status: ledger.attempts.length >= ledger.maximumAttempts ? "exhausted" : "available",
  };
}
