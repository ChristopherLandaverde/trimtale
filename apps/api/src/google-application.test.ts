import {
  approveManagedReplacement,
  createSetupProposal,
  createTrackingChangePlan,
  GTM_MANAGED_ENTITY_NOTE,
  GTM_MANAGED_WORKSPACE_DESCRIPTION,
  GTM_MANAGED_WORKSPACE_NAME,
  GTM_REST_STRING_ALIASES,
  type GtmEntitySet,
  type TrackingSetupOperationV1,
} from "@gtm-observability/core";
import { describe, expect, it, vi } from "vitest";
import { GtmDiscoveryClient } from "./google.js";

const workspace = {
  path: "accounts/1/containers/10/workspaces/2",
  accountId: "1",
  containerId: "10",
  workspaceId: "2",
  name: GTM_MANAGED_WORKSPACE_NAME,
  description: GTM_MANAGED_WORKSPACE_DESCRIPTION,
  fingerprint: "managed-2",
};

function setup() {
  return createSetupProposal({
    intent: "Track navigation clicks",
    pageUrl: "https://example.test/",
    measurementId: "G-TEST123456",
    container: { accountId: "1", containerId: "10", publicId: "GTM-ABC123", name: "Lead site" },
    navigation: [{
      id: "pricing", text: "Pricing", href: "https://example.test/pricing", area: "nav",
      selector: "nav a[href='/pricing']",
    }],
  }).containerFile;
}

function operation(current: GtmEntitySet = {}): TrackingSetupOperationV1 {
  const generatedSetup = setup();
  return {
    schemaVersion: 1,
    id: "operation_navigation",
    status: "planned",
    createdAt: "2026-08-22T12:00:00.000Z",
    updatedAt: "2026-08-22T12:00:00.000Z",
    specification: createSetupProposal({
      intent: "Track navigation clicks",
      pageUrl: "https://example.test/",
      measurementId: "G-TEST123456",
      container: { accountId: "1", containerId: "10", publicId: "GTM-ABC123", name: "Lead site" },
      navigation: [{
        id: "pricing", text: "Pricing", href: "https://example.test/pricing", area: "nav",
        selector: "nav a[href='/pricing']",
      }],
    }).specification,
    generatedSetup,
    container: { publicId: "GTM-ABC123", path: "accounts/1/containers/10" },
    workspace: { path: workspace.path, fingerprint: workspace.fingerprint },
    plan: createTrackingChangePlan(generatedSetup, current),
    completedActionSignatures: [],
  };
}

function equivalentEntities(): GtmEntitySet {
  const current = structuredClone(setup().containerVersion);
  const trigger = current.trigger[0] as Record<string, unknown>;
  const tag = current.tag[0] as Record<string, unknown>;
  trigger.triggerId = "42";
  trigger.path = `${workspace.path}/triggers/42`;
  trigger.fingerprint = "trigger-42";
  tag.tagId = "43";
  tag.path = `${workspace.path}/tags/43`;
  tag.fingerprint = "tag-43";
  tag.firingTriggerId = ["42"];
  return current;
}

function applicationFetch(initial: GtmEntitySet = {}, options: {
  syncConflict?: boolean;
  failEntityWrite?: number;
} = {}) {
  const entities: Required<GtmEntitySet> = {
    tag: structuredClone(initial.tag ?? []),
    trigger: structuredClone(initial.trigger ?? []),
    variable: structuredClone(initial.variable ?? []),
    builtInVariable: structuredClone(initial.builtInVariable ?? []),
  };
  let entityWrites = 0;
  let nextId = 100;
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input.toString());
    if (url.pathname.endsWith("/accounts")) {
      return Response.json({ account: [{ accountId: "1", name: "Agency", path: "accounts/1" }] });
    }
    if (url.pathname.endsWith("/accounts/1/containers")) {
      return Response.json({ container: [{
        accountId: "1", containerId: "10", name: "Lead site",
        path: "accounts/1/containers/10", publicId: "GTM-ABC123", usageContext: ["WEB"],
      }] });
    }
    if (url.pathname.endsWith("/workspaces")) return Response.json({ workspace: [workspace] });
    if (url.pathname.endsWith(":sync")) {
      return Response.json(options.syncConflict
        ? { syncStatus: { mergeConflict: true }, mergeConflict: [{}] }
        : { syncStatus: {} });
    }
    if (url.pathname.endsWith("/status")) return Response.json({ workspaceChange: [], mergeConflict: [] });
    if (url.pathname.endsWith("/versions:live")) {
      return Response.json({ path: "accounts/1/containers/10/versions/7", fingerprint: "live-7" });
    }
    if (url.pathname.endsWith("/tags") && !init?.method) return Response.json({ tag: entities.tag });
    if (url.pathname.endsWith("/triggers") && !init?.method) return Response.json({ trigger: entities.trigger });
    if (url.pathname.endsWith("/variables") && !init?.method) return Response.json({ variable: entities.variable });
    if (url.pathname.endsWith("/built_in_variables") && !init?.method) {
      return Response.json({ builtInVariable: entities.builtInVariable });
    }

    const collection = url.pathname.endsWith("/tags") ? "tag"
      : url.pathname.endsWith("/triggers") ? "trigger"
        : url.pathname.endsWith("/variables") ? "variable"
          : url.pathname.endsWith("/built_in_variables") ? "builtInVariable"
            : undefined;
    if (collection && init?.method === "POST") {
      entityWrites += 1;
      if (options.failEntityWrite === entityWrites) {
        return Response.json({ error: "injected entity failure" }, { status: 500 });
      }
      if (collection === "builtInVariable") {
        const type = url.searchParams.get("type") ?? "UNKNOWN";
        const created = { accountId: "1", containerId: "10", type, name: builtInName(type) };
        entities.builtInVariable.push(created);
        return Response.json({ builtInVariable: [created] });
      }
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      const idKey = collection === "tag" ? "tagId" : collection === "trigger" ? "triggerId" : "variableId";
      const id = String(nextId++);
      const created = {
        ...body,
        accountId: "1",
        containerId: "10",
        [idKey]: id,
        path: `${workspace.path}/${collection}s/${id}`,
        fingerprint: `${collection}-${id}`,
      };
      entities[collection].push(created);
      return Response.json(created);
    }
    if (init?.method === "PUT") {
      entityWrites += 1;
      if (options.failEntityWrite === entityWrites) {
        return Response.json({ error: "injected entity failure" }, { status: 500 });
      }
      const match = url.pathname.match(/\/(tags|triggers|variables)\/(\d+)$/);
      if (!match) return Response.json({ error: "unexpected update" }, { status: 400 });
      const collectionKey = match[1] === "tags" ? "tag" : match[1] === "triggers" ? "trigger" : "variable";
      const idKey = collectionKey === "tag" ? "tagId" : collectionKey === "trigger" ? "triggerId" : "variableId";
      const index = entities[collectionKey].findIndex((item) =>
        typeof item === "object" && item !== null && (item as Record<string, unknown>)[idKey] === match[2]);
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      const updated = {
        ...body,
        accountId: "1",
        containerId: "10",
        [idKey]: match[2],
        path: `${workspace.path}/${match[1]}/${match[2]}`,
        fingerprint: `${collectionKey}-${match[2]}-updated`,
      };
      entities[collectionKey][index] = updated;
      return Response.json(updated);
    }
    return Response.json({
      accountId: "1", containerId: "10", name: "Lead site",
      path: "accounts/1/containers/10", publicId: "GTM-ABC123", usageContext: ["WEB"],
    });
  });
  return { fetcher, entities, entityWriteCount: () => entityWrites };
}

describe("idempotent managed-workspace application", () => {
  it("shares added aliases between planning and REST writes", async () => {
    const importAlias = "TEST_ONLY_ALIAS";
    const restAlias = "testOnlyAlias";
    GTM_REST_STRING_ALIASES.set(importAlias, restAlias);

    try {
      const generated = setup();
      generated.containerVersion.tag = [];
      generated.containerVersion.variable = [];
      generated.containerVersion.builtInVariable = [];
      const generatedTrigger = generated.containerVersion.trigger[0] as Record<string, unknown>;
      generatedTrigger.type = importAlias;

      const current = structuredClone(generated.containerVersion);
      const currentTrigger = current.trigger[0] as Record<string, unknown>;
      currentTrigger.triggerId = "42";
      currentTrigger.type = restAlias;

      expect(createTrackingChangePlan(generated, current).actions).toEqual([
        expect.objectContaining({ kind: "trigger", action: "reuse", existingId: "42" }),
      ]);

      const input = operation();
      input.generatedSetup = generated;
      input.plan = createTrackingChangePlan(generated, {});
      const fake = applicationFetch();
      const client = new GtmDiscoveryClient(async () => "token", fake.fetcher, true);

      expect(await client.applyManagedWorkspace(input)).toMatchObject({ status: "applied" });
      const triggerCreate = fake.fetcher.mock.calls.find(([request, init]) =>
        request.toString().endsWith("/triggers") && init?.method === "POST");
      const triggerBody = JSON.parse(String(triggerCreate?.[1]?.body)) as Record<string, unknown>;
      expect(triggerBody.type).toBe(restAlias);
    } finally {
      GTM_REST_STRING_ALIASES.delete(importAlias);
    }
  });

  it("creates missing entities, remaps trigger IDs, and converges repeated application to no entity writes", async () => {
    const fake = applicationFetch();
    const client = new GtmDiscoveryClient(async () => "token", fake.fetcher, true);
    const input = operation();

    const first = await client.applyManagedWorkspace(input);
    expect(first).toMatchObject({ status: "applied" });
    expect(fake.entityWriteCount()).toBe(4);
    expect(fake.fetcher.mock.calls.filter(([input]) => new URL(input.toString()).pathname.endsWith("/accounts")))
      .toHaveLength(1);
    expect((fake.entities.tag[0] as Record<string, unknown>).firingTriggerId).toEqual(["100"]);
    expect(fake.entities.tag.every((item) => (item as Record<string, unknown>).notes === GTM_MANAGED_ENTITY_NOTE)).toBe(true);
    const triggerCreate = fake.fetcher.mock.calls.find(([input, init]) =>
      input.toString().endsWith("/triggers") && init?.method === "POST");
    const triggerBody = JSON.parse(String(triggerCreate?.[1]?.body)) as Record<string, unknown>;
    expect(triggerBody).toMatchObject({ type: "linkClick", checkValidation: { type: "boolean" } });
    expect(triggerBody).toHaveProperty("filter.0.type", "matchRegex");
    const tagCreate = fake.fetcher.mock.calls.find(([input, init]) =>
      input.toString().endsWith("/tags") && init?.method === "POST");
    const tagBody = JSON.parse(String(tagCreate?.[1]?.body)) as { parameter: Array<{ key?: string }> };
    expect(tagBody.parameter.map(({ key }) => key)).toEqual(expect.arrayContaining([
      "eventName", "measurementIdOverride", "eventSettingsTable",
    ]));

    if (first.status !== "applied") throw new Error(first.status);
    input.status = "applying";
    input.completedActionSignatures = first.completedActionSignatures;
    const second = await client.applyManagedWorkspace(input);
    expect(second).toMatchObject({ status: "applied" });
    expect(fake.entityWriteCount()).toBe(4);
  });

  it("resumes after a partial Google failure without recreating completed entities", async () => {
    const fake = applicationFetch({}, { failEntityWrite: 2 });
    const client = new GtmDiscoveryClient(async () => "token", fake.fetcher, true);
    const input = operation();
    const failed = await client.applyManagedWorkspace(input);

    expect(failed).toMatchObject({ status: "partial_failure" });
    expect(fake.entities.trigger).toHaveLength(1);
    if (failed.status !== "partial_failure") throw new Error(failed.status);
    input.status = "applying";
    input.completedActionSignatures = failed.completedActionSignatures;
    const resumed = await client.applyManagedWorkspace(input);
    expect(resumed).toMatchObject({ status: "applied" });
    expect(fake.entities.trigger).toHaveLength(1);
    expect(fake.entities.tag).toHaveLength(1);
  });

  it("blocks product-owned semantic changes without entity writes", async () => {
    const current = equivalentEntities();
    const tag = current.tag?.[0] as Record<string, unknown> & { parameter?: Array<{ key?: string; value?: string }> };
    const measurement = tag.parameter?.find(({ key }) => key === "measurementId");
    if (measurement) measurement.value = "G-OLDVALUE1";
    tag.notes = GTM_MANAGED_ENTITY_NOTE;
    const fake = applicationFetch(current);
    const client = new GtmDiscoveryClient(async () => "token", fake.fetcher, true);
    const input = operation(current);

    expect(input.plan.actions).toContainEqual(expect.objectContaining({
      kind: "tag",
      action: "conflict",
      reason: "managed_change_requires_approval",
      existingId: "43",
    }));
    const result = await client.applyManagedWorkspace(input);

    expect(result).toMatchObject({ status: "blocked", reason: "ownership_conflict" });
    expect(fake.entityWriteCount()).toBe(0);
    expect(fake.fetcher).not.toHaveBeenCalled();
  });

  it("updates only the approved fresh product-owned entity", async () => {
    const current = equivalentEntities();
    const tag = current.tag?.[0] as Record<string, unknown> & {
      parameter?: Array<{ key?: string; value?: string }>;
    };
    const measurement = tag.parameter?.find(({ key }) => key === "measurementId");
    if (measurement) measurement.value = "G-OLDVALUE1";
    tag.notes = GTM_MANAGED_ENTITY_NOTE;
    const pending = operation(current);
    const conflict = pending.plan.actions.find((action) => action.action === "conflict"
      && action.reason === "managed_change_requires_approval");
    if (conflict?.action !== "conflict" || !conflict.existingId || !conflict.replacement) {
      throw new Error("Expected a reviewable managed conflict.");
    }
    const entities = [{
      kind: conflict.kind,
      entitySignature: conflict.entitySignature,
      existingId: conflict.existingId,
      currentFingerprint: conflict.replacement.currentFingerprint,
    }];
    const approved = approveManagedReplacement(
      pending,
      pending.plan.fingerprint,
      entities,
      "practitioner@example.test",
      "2026-08-22T12:01:00.000Z",
    );
    const fake = applicationFetch(current);
    const client = new GtmDiscoveryClient(async () => "token", fake.fetcher, true);

    expect(await client.applyManagedWorkspace(approved)).toMatchObject({ status: "applied" });
    expect(fake.entityWriteCount()).toBe(1);
    expect(fake.fetcher.mock.calls.find(([input, init]) =>
      input.toString().includes("/tags/43?fingerprint=tag-43") && init?.method === "PUT"))
      .toBeDefined();

    const changed = structuredClone(current);
    const changedTag = changed.tag?.[0] as Record<string, unknown>;
    changedTag.fingerprint = "tag-changed-after-review";
    const staleFake = applicationFetch(changed);
    const staleClient = new GtmDiscoveryClient(async () => "token", staleFake.fetcher, true);
    expect(await staleClient.applyManagedWorkspace(approved)).toMatchObject({
      status: "blocked",
      reason: "stale_plan",
    });
    expect(staleFake.entityWriteCount()).toBe(0);
  });

  it("blocks unowned collisions and stale plan or workspace state without entity writes", async () => {
    const collision = equivalentEntities();
    const tag = collision.tag?.[0] as Record<string, unknown> & { parameter?: Array<{ key?: string; value?: string }> };
    const measurement = tag.parameter?.find(({ key }) => key === "measurementId");
    if (measurement) measurement.value = "G-CONFLICT1";
    delete tag.notes;
    const collisionFake = applicationFetch(collision);
    const collisionClient = new GtmDiscoveryClient(async () => "token", collisionFake.fetcher, true);
    expect(await collisionClient.applyManagedWorkspace(operation())).toMatchObject({
      status: "blocked", reason: "ownership_conflict",
    });
    expect(collisionFake.entityWriteCount()).toBe(0);

    const stalePlanFake = applicationFetch();
    const stalePlan = operation();
    stalePlan.plan.fingerprint = "plan_tampered";
    expect(await new GtmDiscoveryClient(async () => "token", stalePlanFake.fetcher, true)
      .applyManagedWorkspace(stalePlan)).toMatchObject({ status: "blocked", reason: "stale_plan" });
    expect(stalePlanFake.fetcher).not.toHaveBeenCalled();

    const staleWorkspaceFake = applicationFetch();
    const staleWorkspace = operation();
    staleWorkspace.workspace.fingerprint = "old-workspace";
    expect(await new GtmDiscoveryClient(async () => "token", staleWorkspaceFake.fetcher, true)
      .applyManagedWorkspace(staleWorkspace)).toMatchObject({ status: "blocked", reason: "stale_workspace" });
    expect(staleWorkspaceFake.entityWriteCount()).toBe(0);
  });

  it("blocks synchronization conflicts and disabled writes before entity mutation", async () => {
    const conflictFake = applicationFetch({}, { syncConflict: true });
    expect(await new GtmDiscoveryClient(async () => "token", conflictFake.fetcher, true)
      .applyManagedWorkspace(operation())).toMatchObject({ status: "blocked", reason: "sync_conflict" });
    expect(conflictFake.entityWriteCount()).toBe(0);

    const disabledFake = applicationFetch();
    await expect(new GtmDiscoveryClient(async () => "token", disabledFake.fetcher, false)
      .applyManagedWorkspace(operation())).rejects.toMatchObject({ status: 403 });
    expect(disabledFake.fetcher).not.toHaveBeenCalled();
  });
});

function builtInName(type: string): string {
  return type === "CLICK_TEXT" ? "Click Text" : type === "CLICK_URL" ? "Click URL" : type;
}
