import {
  authorizeOrganization,
  compareContainerInventory,
  validateContainerInventorySnapshot,
  type ContainerInventoryChangeV1,
  type ContainerInventorySnapshotV1,
  type OrganizationAuthorityV1,
} from "@gtm-observability/core";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface InventorySnapshotCollectionV1 {
  schemaVersion: 1;
  snapshots: ContainerInventorySnapshotV1[];
}

export interface ContainerInventoryCaptureResult {
  status: "baseline_established" | "changes_compared";
  snapshot: ContainerInventorySnapshotV1;
  changes: ContainerInventoryChangeV1[];
}

export type CaptureContainerInventory = (
  organizationId: string,
  googleConnectionId: string,
) => Promise<ContainerInventorySnapshotV1>;

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function key(organizationId: string, googleConnectionId: string): string {
  if (!ID.test(organizationId) || !ID.test(googleConnectionId)) {
    throw new Error("Container-inventory identity is invalid.");
  }

  return `${organizationId}\n${googleConnectionId}`;
}

function validSnapshot(snapshot: unknown): snapshot is ContainerInventorySnapshotV1 {
  return validateContainerInventorySnapshot(snapshot).length === 0;
}

export class InventorySnapshotRepository {
  readonly #snapshots = new Map<string, ContainerInventorySnapshotV1>();

  constructor(readonly filePath: string) {
    this.#load();
  }

  latest(
    organizationId: string,
    googleConnectionId: string,
  ): ContainerInventorySnapshotV1 | undefined {
    this.#refresh();
    const snapshot = this.#snapshots.get(key(organizationId, googleConnectionId));

    return snapshot ? structuredClone(snapshot) : undefined;
  }

  record(snapshot: ContainerInventorySnapshotV1): ContainerInventoryCaptureResult {
    if (!validSnapshot(snapshot)) {
      throw new Error("Provider inventory is invalid.");
    }
    this.#refresh();
    const snapshotKey = key(snapshot.organizationId, snapshot.googleConnectionId);
    const previous = this.#snapshots.get(snapshotKey);
    if (previous && Date.parse(snapshot.capturedAt) <= Date.parse(previous.capturedAt)) {
      throw new Error("Container inventory must be newer than the current baseline.");
    }
    const changes = previous ? compareContainerInventory(previous, snapshot) : [];
    this.#snapshots.set(snapshotKey, structuredClone(snapshot));
    this.#persist();

    return {
      status: previous ? "changes_compared" : "baseline_established",
      snapshot: structuredClone(snapshot),
      changes: structuredClone(changes),
    };
  }

  #load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }
    this.#replaceFromDisk();
  }

  #refresh(): void {
    if (!existsSync(this.filePath)) {
      this.#snapshots.clear();
      return;
    }
    this.#replaceFromDisk();
  }

  #replaceFromDisk(): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.filePath, "utf8"));
    } catch {
      throw new Error("Corrupted container-inventory collection.");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Unsupported container-inventory collection schema.");
    }
    const collection = parsed as Record<string, unknown>;
    if (collection.schemaVersion !== 1 || !Array.isArray(collection.snapshots)) {
      throw new Error("Unsupported container-inventory collection schema.");
    }

    const loaded = new Map<string, ContainerInventorySnapshotV1>();
    for (const candidate of collection.snapshots) {
      if (!validSnapshot(candidate)) {
        throw new Error("Persisted container inventory is invalid.");
      }
      const snapshotKey = key(candidate.organizationId, candidate.googleConnectionId);
      if (loaded.has(snapshotKey)) {
        throw new Error("Duplicate container-inventory identity.");
      }
      loaded.set(snapshotKey, structuredClone(candidate));
    }

    this.#snapshots.clear();
    for (const [snapshotKey, snapshot] of loaded) {
      this.#snapshots.set(snapshotKey, snapshot);
    }
  }

  #persist(): void {
    const snapshots = [...this.#snapshots.values()]
      .sort((left, right) => left.organizationId.localeCompare(right.organizationId)
        || left.googleConnectionId.localeCompare(right.googleConnectionId))
      .map((snapshot) => structuredClone(snapshot));
    const collection: InventorySnapshotCollectionV1 = { schemaVersion: 1, snapshots };
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(collection, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporaryPath, this.filePath);
  }
}

export class ContainerInventoryService {
  constructor(
    private readonly organizationId: string,
    private readonly googleConnectionId: string,
    private readonly repository: InventorySnapshotRepository,
    private readonly providerCapture: CaptureContainerInventory,
  ) {
    key(organizationId, googleConnectionId);
  }

  async capture(authority: OrganizationAuthorityV1): Promise<ContainerInventoryCaptureResult> {
    if (!authorizeOrganization(authority, this.organizationId, "org:tracking:read")) {
      throw new Error("Organization read permission is required.");
    }
    const snapshot = await this.providerCapture(this.organizationId, this.googleConnectionId);
    const errors = validateContainerInventorySnapshot(snapshot);
    if (errors.length > 0) {
      throw new Error(`Provider inventory is invalid. ${errors.join(" ")}`);
    }
    if (snapshot.organizationId !== this.organizationId
      || snapshot.googleConnectionId !== this.googleConnectionId) {
      throw new Error("Provider inventory identity does not match the authenticated connection.");
    }

    return this.repository.record(snapshot);
  }
}
