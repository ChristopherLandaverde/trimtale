import {
  migrateTrackingOperation,
  type TrackingSetupOperationV1,
} from "@gtm-observability/core";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface TrackingOperationRecordV2 {
  organizationId: string;
  operation: TrackingSetupOperationV1;
}

interface TrackingOperationCollectionV2 {
  schemaVersion: 2;
  records: TrackingOperationRecordV2[];
}

export type CreateTrackingOperationResult =
  | { accepted: true; operation: TrackingSetupOperationV1 }
  | { accepted: false; error: "already_exists" };

export type UpdateTrackingOperationResult =
  | { accepted: true; operation: TrackingSetupOperationV1 }
  | { accepted: false; error: "not_found" | "stale_revision" | "identity_mismatch" };

export interface OrganizationTrackingOperations {
  readonly organizationId: string;
  readonly filePath: string;
  create(input: unknown): CreateTrackingOperationResult;
  update(id: string, expectedUpdatedAt: string, input: unknown): UpdateTrackingOperationResult;
  get(id: string): TrackingSetupOperationV1 | undefined;
  list(): TrackingSetupOperationV1[];
}

const ORGANIZATION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class TrackingOperationRepository {
  readonly #items = new Map<string, Map<string, TrackingSetupOperationV1>>();

  constructor(
    readonly filePath: string,
    private readonly legacyOrganizationId?: string,
  ) {
    if (legacyOrganizationId && !ORGANIZATION_ID.test(legacyOrganizationId)) {
      throw new Error("Legacy tracking-operation organization is invalid.");
    }
    this.#load();
  }

  scope(organizationId: string): OrganizationTrackingOperations {
    if (!ORGANIZATION_ID.test(organizationId)) {
      throw new Error("Tracking-operation organization is invalid.");
    }

    return {
      organizationId,
      filePath: this.filePath,
      create: (input) => this.#create(organizationId, input),
      update: (id, expectedUpdatedAt, input) => this.#update(
        organizationId,
        id,
        expectedUpdatedAt,
        input,
      ),
      get: (id) => this.#get(organizationId, id),
      list: () => this.#list(organizationId),
    };
  }

  #create(organizationId: string, input: unknown): CreateTrackingOperationResult {
    const operation = migrateTrackingOperation(input);
    this.#refresh();
    const operations = this.#organization(organizationId);
    if (operations.has(operation.id)) {
      return { accepted: false, error: "already_exists" };
    }
    operations.set(operation.id, structuredClone(operation));
    this.#persist();

    return { accepted: true, operation: structuredClone(operation) };
  }

  #update(
    organizationId: string,
    id: string,
    expectedUpdatedAt: string,
    input: unknown,
  ): UpdateTrackingOperationResult {
    this.#refresh();
    const operations = this.#items.get(organizationId);
    if (!operations) {
      return { accepted: false, error: "not_found" };
    }
    const current = operations.get(id);
    if (!current) {
      return { accepted: false, error: "not_found" };
    }
    if (current.updatedAt !== expectedUpdatedAt) {
      return { accepted: false, error: "stale_revision" };
    }
    const operation = migrateTrackingOperation(input);
    if (operation.id !== current.id || operation.createdAt !== current.createdAt) {
      return { accepted: false, error: "identity_mismatch" };
    }
    if (operation.updatedAt === current.updatedAt
      || Date.parse(operation.updatedAt) < Date.parse(current.updatedAt)) {
      return { accepted: false, error: "stale_revision" };
    }
    operations.set(id, structuredClone(operation));
    this.#persist();

    return { accepted: true, operation: structuredClone(operation) };
  }

  #get(organizationId: string, id: string): TrackingSetupOperationV1 | undefined {
    this.#refresh();
    const operation = this.#items.get(organizationId)?.get(id);

    return operation ? structuredClone(operation) : undefined;
  }

  #list(organizationId: string): TrackingSetupOperationV1[] {
    this.#refresh();

    return this.#sorted(this.#items.get(organizationId)?.values() ?? []);
  }

  #organization(organizationId: string): Map<string, TrackingSetupOperationV1> {
    const existing = this.#items.get(organizationId);
    if (existing) {
      return existing;
    }
    const created = new Map<string, TrackingSetupOperationV1>();
    this.#items.set(organizationId, created);

    return created;
  }

  #load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }
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
    if (!isRecord(parsed)) {
      throw new Error("Unsupported tracking-operation collection schema.");
    }

    const records = parsed.schemaVersion === 2 && Array.isArray(parsed.records)
      ? parsed.records
      : parsed.schemaVersion === 1 && Array.isArray(parsed.operations) && this.legacyOrganizationId
        ? parsed.operations.map((operation) => ({
            organizationId: this.legacyOrganizationId!,
            operation,
          }))
        : undefined;
    if (!records) {
      throw new Error("Unsupported tracking-operation collection schema.");
    }

    const loaded = new Map<string, Map<string, TrackingSetupOperationV1>>();
    for (const candidate of records) {
      if (!isRecord(candidate)
        || typeof candidate.organizationId !== "string"
        || !ORGANIZATION_ID.test(candidate.organizationId)) {
        throw new Error("Tracking-operation record organization is invalid.");
      }
      const operation = migrateTrackingOperation(candidate.operation);
      const operations = loaded.get(candidate.organizationId) ?? new Map();
      if (operations.has(operation.id)) {
        throw new Error(`Duplicate tracking operation: ${operation.id}.`);
      }
      operations.set(operation.id, structuredClone(operation));
      loaded.set(candidate.organizationId, operations);
    }

    this.#items.clear();
    for (const [organizationId, operations] of loaded) {
      this.#items.set(organizationId, operations);
    }
  }

  #persist(): void {
    const records = [...this.#items.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([organizationId, operations]) => this.#sorted(operations.values())
        .map((operation) => ({ organizationId, operation })));
    const collection: TrackingOperationCollectionV2 = { schemaVersion: 2, records };
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(collection, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporaryPath, this.filePath);
  }

  #sorted(values: Iterable<TrackingSetupOperationV1>): TrackingSetupOperationV1[] {
    return [...values]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)
        || left.id.localeCompare(right.id))
      .map((operation) => structuredClone(operation));
  }
}
