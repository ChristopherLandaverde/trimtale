import {
  migrateTrackingOperation,
  type TrackingSetupOperationV1,
} from "@gtm-observability/core";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface TrackingOperationCollectionV1 {
  schemaVersion: 1;
  operations: unknown[];
}

export type CreateTrackingOperationResult =
  | { accepted: true; operation: TrackingSetupOperationV1 }
  | { accepted: false; error: "already_exists" };

export type UpdateTrackingOperationResult =
  | { accepted: true; operation: TrackingSetupOperationV1 }
  | { accepted: false; error: "not_found" | "stale_revision" | "identity_mismatch" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class TrackingOperationRepository {
  readonly #items = new Map<string, TrackingSetupOperationV1>();

  constructor(readonly filePath: string) {
    this.#load();
  }

  create(input: unknown): CreateTrackingOperationResult {
    const operation = migrateTrackingOperation(input);
    this.#refresh();
    if (this.#items.has(operation.id)) return { accepted: false, error: "already_exists" };
    this.#items.set(operation.id, structuredClone(operation));
    this.#persist();
    return { accepted: true, operation: structuredClone(operation) };
  }

  update(id: string, expectedUpdatedAt: string, input: unknown): UpdateTrackingOperationResult {
    this.#refresh();
    const current = this.#items.get(id);
    if (!current) return { accepted: false, error: "not_found" };
    if (current.updatedAt !== expectedUpdatedAt) return { accepted: false, error: "stale_revision" };
    const operation = migrateTrackingOperation(input);
    if (operation.id !== current.id || operation.createdAt !== current.createdAt) {
      return { accepted: false, error: "identity_mismatch" };
    }
    if (operation.updatedAt === current.updatedAt
      || Date.parse(operation.updatedAt) < Date.parse(current.updatedAt)) {
      return { accepted: false, error: "stale_revision" };
    }
    this.#items.set(id, structuredClone(operation));
    this.#persist();
    return { accepted: true, operation: structuredClone(operation) };
  }

  get(id: string): TrackingSetupOperationV1 | undefined {
    const operation = this.#items.get(id);
    return operation ? structuredClone(operation) : undefined;
  }

  list(): TrackingSetupOperationV1[] {
    return [...this.#items.values()]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
      .map((operation) => structuredClone(operation));
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
      throw new Error("Corrupted tracking-operation collection.");
    }
    if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.operations)) {
      throw new Error("Unsupported tracking-operation collection schema.");
    }
    const loaded = new Map<string, TrackingSetupOperationV1>();
    for (const candidate of parsed.operations) {
      const operation = migrateTrackingOperation(candidate);
      if (loaded.has(operation.id)) throw new Error(`Duplicate tracking operation: ${operation.id}.`);
      loaded.set(operation.id, structuredClone(operation));
    }
    this.#items.clear();
    for (const [id, operation] of loaded) this.#items.set(id, operation);
  }

  #persist(): void {
    const collection: TrackingOperationCollectionV1 = { schemaVersion: 1, operations: this.list() };
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(collection, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, this.filePath);
  }
}
