export const PROVIDER_PROGRESS_SCHEMA_VERSION = 1 as const;

export type ProviderStageV1 =
  | "planning"
  | "application"
  | "validation"
  | "versioning"
  | "publication"
  | "rollback";
export type ProviderAttemptStatusV1 = "started" | "failed" | "completed";
export type ProviderProgressStateV1 =
  | "in_flight"
  | "reconciling"
  | "failed"
  | "awaiting_user"
  | "completed";
export type ProviderFailureCodeV1 =
  | "provider_forbidden"
  | "provider_unavailable"
  | "provider_conflict"
  | "provider_rejected"
  | "partial_failure"
  | "validation_failed"
  | "version_creation_blocked"
  | "publication_mismatch"
  | "rollback_mismatch";

export interface ProviderAttemptV1 {
  schemaVersion: typeof PROVIDER_PROGRESS_SCHEMA_VERSION;
  id: string;
  stage: ProviderStageV1;
  status: ProviderAttemptStatusV1;
  startedAt: string;
  updatedAt: string;
  failureCode?: ProviderFailureCodeV1;
}

export interface ProviderProgressInputV1 {
  stage: string | null;
  attemptStatus: string | null;
  liveRequest: boolean;
  displayTimedOut: boolean;
  browserReloaded: boolean;
  action: string;
  failureCode?: string;
  operationCheckpoint?: string;
  attemptId?: string;
  startedAt?: string;
  updatedAt?: string;
}

export interface ProviderProgressProjectionV1 {
  schemaVersion: typeof PROVIDER_PROGRESS_SCHEMA_VERSION;
  attemptId: string | null;
  stage: ProviderStageV1 | null;
  state: ProviderProgressStateV1;
  retry: "locked" | "conditional";
  startedAt?: string;
  updatedAt?: string;
  elapsedSeconds?: number;
  failureCode?: ProviderFailureCodeV1;
  message: string;
}

const projectionKeys = new Set([
  "schemaVersion", "attemptId", "stage", "state", "retry", "startedAt", "updatedAt",
  "elapsedSeconds", "failureCode", "message",
]);

const stages = new Set<ProviderStageV1>([
  "planning", "application", "validation", "versioning", "publication", "rollback",
]);
const attemptStatuses = new Set<ProviderAttemptStatusV1>(["started", "failed", "completed"]);
const failureCodes = new Set<ProviderFailureCodeV1>([
  "provider_forbidden",
  "provider_unavailable",
  "provider_conflict",
  "provider_rejected",
  "partial_failure",
  "validation_failed",
  "version_creation_blocked",
  "publication_mismatch",
  "rollback_mismatch",
]);
const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function timestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function validateProviderAttempt(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return ["providerAttempt is invalid"];
  }
  const attempt = value as Record<string, unknown>;
  const errors: string[] = [];
  if (attempt.schemaVersion !== PROVIDER_PROGRESS_SCHEMA_VERSION) {
    errors.push("providerAttempt.schemaVersion must be 1");
  }
  if (typeof attempt.id !== "string" || !safeId.test(attempt.id)) errors.push("providerAttempt.id is invalid");
  if (typeof attempt.stage !== "string" || !stages.has(attempt.stage as ProviderStageV1)) {
    errors.push("providerAttempt.stage is unsupported");
  }
  if (typeof attempt.status !== "string" || !attemptStatuses.has(attempt.status as ProviderAttemptStatusV1)) {
    errors.push("providerAttempt.status is unsupported");
  }
  if (!timestamp(attempt.startedAt)) errors.push("providerAttempt.startedAt is invalid");
  if (!timestamp(attempt.updatedAt)) errors.push("providerAttempt.updatedAt is invalid");
  if (timestamp(attempt.startedAt) && timestamp(attempt.updatedAt)
    && Date.parse(attempt.updatedAt) < Date.parse(attempt.startedAt)) {
    errors.push("providerAttempt.updatedAt precedes startedAt");
  }
  if (attempt.status === "failed") {
    if (typeof attempt.failureCode !== "string"
      || !failureCodes.has(attempt.failureCode as ProviderFailureCodeV1)) {
      errors.push("providerAttempt.failure code is unsafe");
    }
  } else if (attempt.failureCode !== undefined) {
    errors.push("providerAttempt.failureCode requires failed status");
  }
  return [...new Set(errors)];
}

export function validateProviderProgressProjection(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return ["provider progress is invalid"];
  }
  const progress = value as Record<string, unknown>;
  const errors: string[] = [];
  if (Object.keys(progress).some((key) => !projectionKeys.has(key))) errors.push("provider progress contains unsupported data");
  if (progress.schemaVersion !== PROVIDER_PROGRESS_SCHEMA_VERSION) errors.push("provider progress schemaVersion must be 1");
  if (progress.attemptId !== null
    && (typeof progress.attemptId !== "string" || !safeId.test(progress.attemptId))) {
    errors.push("provider progress attemptId is invalid");
  }
  if (progress.stage !== null
    && (typeof progress.stage !== "string" || !stages.has(progress.stage as ProviderStageV1))) {
    errors.push("provider progress stage is unsupported");
  }
  if (!["in_flight", "reconciling", "failed", "awaiting_user", "completed"].includes(String(progress.state))) {
    errors.push("provider progress state is unsupported");
  }
  if (progress.retry !== "locked" && progress.retry !== "conditional") errors.push("provider progress retry is unsupported");
  if (typeof progress.message !== "string" || progress.message.length === 0 || progress.message.length > 256) {
    errors.push("provider progress message is invalid");
  }
  if (progress.startedAt !== undefined && !timestamp(progress.startedAt)) errors.push("provider progress startedAt is invalid");
  if (progress.updatedAt !== undefined && !timestamp(progress.updatedAt)) errors.push("provider progress updatedAt is invalid");
  if (progress.elapsedSeconds !== undefined
    && (!Number.isInteger(progress.elapsedSeconds) || Number(progress.elapsedSeconds) < 0)) {
    errors.push("provider progress elapsedSeconds is invalid");
  }
  if (progress.failureCode !== undefined
    && (typeof progress.failureCode !== "string"
      || !failureCodes.has(progress.failureCode as ProviderFailureCodeV1))) {
    errors.push("provider progress failure code is unsafe");
  }
  return [...new Set(errors)];
}

function stageLabel(stage: ProviderStageV1): string {
  return stage[0]!.toUpperCase() + stage.slice(1);
}

export function projectProviderProgress(
  input: ProviderProgressInputV1,
  now = Date.now(),
): ProviderProgressProjectionV1 {
  if (input.stage !== null && !stages.has(input.stage as ProviderStageV1)) {
    throw new Error("stage is unsupported");
  }
  if (input.attemptStatus !== null
    && !attemptStatuses.has(input.attemptStatus as ProviderAttemptStatusV1)) {
    throw new Error("attempt status is unsupported");
  }
  if ((input.stage === null) !== (input.attemptStatus === null)) {
    throw new Error("stage and attempt status must be present together");
  }
  if (input.failureCode !== undefined && !failureCodes.has(input.failureCode as ProviderFailureCodeV1)) {
    throw new Error("failure code is unsafe");
  }
  if (input.attemptStatus === "failed" && input.failureCode === undefined) {
    throw new Error("failure code is required");
  }
  const stage = input.stage as ProviderStageV1 | null;
  let state: ProviderProgressStateV1;
  if (input.attemptStatus === "started") state = input.liveRequest ? "in_flight" : "reconciling";
  else if (input.attemptStatus === "failed") state = "failed";
  else if (input.attemptStatus === "completed") state = "completed";
  else state = input.operationCheckpoint === "complete" ? "completed" : "awaiting_user";

  let message: string;
  if (state === "awaiting_user") {
    message = input.operationCheckpoint === "await_approval"
      ? "Waiting for approval; no request active."
      : "Waiting for the next user checkpoint; no request active.";
  } else if (state === "completed") {
    message = stage ? `${stageLabel(stage)} completed.` : "Provider work completed.";
  } else if (state === "failed") {
    message = `${stageLabel(stage!)} stopped with a provider error.`;
  } else if (state === "reconciling") {
    message = `${stageLabel(stage!)} is checking current state before any retry.`;
  } else if (input.action === "repeat_mutation") {
    message = `${stageLabel(stage!)} is already active and still running.`;
  } else if (input.displayTimedOut) {
    message = `${stageLabel(stage!)} is taking longer than expected and is still running.`;
  } else if (input.browserReloaded) {
    message = `${stageLabel(stage!)} progress was restored and is still running.`;
  } else {
    message = `${stageLabel(stage!)} is still running.`;
  }

  const startedAt = timestamp(input.startedAt) ? input.startedAt : undefined;
  const updatedAt = timestamp(input.updatedAt) ? input.updatedAt : undefined;
  return {
    schemaVersion: PROVIDER_PROGRESS_SCHEMA_VERSION,
    attemptId: input.attemptId && safeId.test(input.attemptId) ? input.attemptId : null,
    stage,
    state,
    retry: state === "failed" ? "conditional" : "locked",
    ...(startedAt ? { startedAt, elapsedSeconds: Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1_000)) } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(input.failureCode ? { failureCode: input.failureCode as ProviderFailureCodeV1 } : {}),
    message,
  };
}

export function providerProgressFromAttempt(
  attempt: ProviderAttemptV1 | undefined,
  liveRequest: boolean,
  operationCheckpoint: string,
  presentation: { displayTimedOut?: boolean; browserReloaded?: boolean; action?: string } = {},
  now = Date.now(),
): ProviderProgressProjectionV1 {
  return projectProviderProgress({
    stage: attempt?.stage ?? null,
    attemptStatus: attempt?.status ?? null,
    liveRequest,
    displayTimedOut: presentation.displayTimedOut ?? false,
    browserReloaded: presentation.browserReloaded ?? false,
    action: presentation.action ?? "read_progress",
    operationCheckpoint,
    ...(attempt ? {
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      updatedAt: attempt.updatedAt,
      ...(attempt.failureCode ? { failureCode: attempt.failureCode } : {}),
    } : {}),
  }, now);
}
