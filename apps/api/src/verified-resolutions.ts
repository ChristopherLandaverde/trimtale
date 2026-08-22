import {
  VERIFIED_RESOLUTION_SCHEMA_VERSION,
  assertVerifiedResolution,
  verifiedResolutionActions,
  verifiedResolutionCauses,
  type LocalRunEvidenceStore,
  type ScenarioVerdictCode,
  type TrackingRunEvidenceV1,
  type VerifiedResolutionAction,
  type VerifiedResolutionCause,
  type VerifiedResolutionV1,
} from "@gtm-observability/core";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type VerifiedResolutionErrorCode =
  | "unsupported_schema_version"
  | "human_confirmation_required"
  | "confirmed_cause_required"
  | "corrective_action_required"
  | "evidence_not_found"
  | "evidence_verdict_mismatch"
  | "failing_before_evidence_required"
  | "passing_after_evidence_required";

export type SaveVerifiedResolutionResult =
  | { accepted: true; resolution: VerifiedResolutionV1 }
  | { accepted: false; error: VerifiedResolutionErrorCode };

interface ResolutionCollectionV1 {
  schemaVersion: 1;
  resolutions: VerifiedResolutionV1[];
}

interface RunEvidenceReader {
  get(runId: string): TrackingRunEvidenceV1 | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function supportedCause(value: unknown): value is VerifiedResolutionCause {
  return typeof value === "string" && verifiedResolutionCauses.includes(value as VerifiedResolutionCause);
}

function supportedAction(value: unknown): value is VerifiedResolutionAction {
  return typeof value === "string" && verifiedResolutionActions.includes(value as VerifiedResolutionAction);
}

function claimedVerdict(value: unknown): ScenarioVerdictCode | undefined {
  return typeof value === "string" ? value as ScenarioVerdictCode : undefined;
}

export class VerifiedResolutionRepository {
  readonly #items = new Map<string, VerifiedResolutionV1>();

  constructor(
    readonly filePath: string,
    readonly evidence: RunEvidenceReader | LocalRunEvidenceStore,
  ) {
    this.#load();
  }

  save(input: unknown): SaveVerifiedResolutionResult {
    if (!isRecord(input) || input.schemaVersion !== VERIFIED_RESOLUTION_SCHEMA_VERSION) {
      return { accepted: false, error: "unsupported_schema_version" };
    }
    if (input.humanConfirmed !== true) return { accepted: false, error: "human_confirmation_required" };
    if (!supportedCause(input.confirmedCause)) return { accepted: false, error: "confirmed_cause_required" };
    if (!supportedAction(input.correctiveAction)) return { accepted: false, error: "corrective_action_required" };

    const before = typeof input.beforeEvidenceId === "string" ? this.evidence.get(input.beforeEvidenceId) : undefined;
    const after = typeof input.afterEvidenceId === "string" ? this.evidence.get(input.afterEvidenceId) : undefined;
    if (!before || !after) return { accepted: false, error: "evidence_not_found" };
    if (claimedVerdict(input.beforeVerdict) !== before.verdict.code || claimedVerdict(input.afterVerdict) !== after.verdict.code) {
      return { accepted: false, error: "evidence_verdict_mismatch" };
    }
    if (before.verdict.browserVerification === "passed" || before.verdict.code === "browser_verified") {
      return { accepted: false, error: "failing_before_evidence_required" };
    }
    if (after.verdict.browserVerification !== "passed" || after.verdict.code !== "browser_verified") {
      return { accepted: false, error: "passing_after_evidence_required" };
    }

    const resolution: VerifiedResolutionV1 = {
      schemaVersion: VERIFIED_RESOLUTION_SCHEMA_VERSION,
      id: `resolution_${randomUUID()}`,
      confirmedAt: new Date().toISOString(),
      humanConfirmed: true,
      confirmedCause: input.confirmedCause,
      correctiveAction: input.correctiveAction,
      beforeEvidenceId: before.runId,
      beforeVerdict: before.verdict.code as VerifiedResolutionV1["beforeVerdict"],
      afterEvidenceId: after.runId,
      afterVerdict: "browser_verified",
      environment: {
        interactionType: before.observations.interaction.type,
        submissionResult: before.observations.interaction.submissionResult,
        analyticsStorage: before.observations.consent.analyticsStorage,
      },
    };
    assertVerifiedResolution(resolution);
    this.#items.set(resolution.id, structuredClone(resolution));
    this.#persist();
    return { accepted: true, resolution: structuredClone(resolution) };
  }

  get(id: string): VerifiedResolutionV1 | undefined {
    const item = this.#items.get(id);
    return item ? structuredClone(item) : undefined;
  }

  list(): VerifiedResolutionV1[] {
    return [...this.#items.values()].map((item) => structuredClone(item));
  }

  #load(): void {
    if (!existsSync(this.filePath)) return;
    const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as unknown;
    if (!isRecord(parsed) || parsed.schemaVersion !== VERIFIED_RESOLUTION_SCHEMA_VERSION || !Array.isArray(parsed.resolutions)) {
      throw new Error("Unsupported verified-resolution collection schema.");
    }
    for (const resolution of parsed.resolutions) {
      assertVerifiedResolution(resolution);
      this.#items.set(resolution.id, structuredClone(resolution));
    }
  }

  #persist(): void {
    const collection: ResolutionCollectionV1 = {
      schemaVersion: VERIFIED_RESOLUTION_SCHEMA_VERSION,
      resolutions: this.list(),
    };
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(collection, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, this.filePath);
  }
}
