import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTrackingChangePlan, type GtmEntitySet } from "./change-plan.js";
import { compileTrackingSetup } from "./setup-compiler.js";
import type { TrackingSetupV1 } from "./setup-contract.js";

const container = {
  accountId: "1",
  containerId: "2",
  publicId: "GTM-TEST123",
  name: "Test container",
};

function fixtures(): TrackingSetupV1[] {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/fixtures/tracking-setups-v1.json"),
    "utf8",
  )) as TrackingSetupV1[];
}

function fixture(id: string): TrackingSetupV1 {
  const setup = fixtures().find((candidate) => candidate.id === id);
  if (!setup) {
    throw new Error(`Missing ${id} fixture.`);
  }

  return setup;
}

describe("generic GTM setup compiler", () => {
  it.each([
    "setup_page_scope",
    "setup_phone_click",
    "setup_data_layer",
  ])("compiles %s without an event-specific compiler", (id) => {
    const compiled = compileTrackingSetup(fixture(id), container);

    expect(compiled.schemaVersion).toBe(1);
    expect(compiled.setupId).toBe(id);
    expect(compiled.containerFile.containerVersion.tag).toHaveLength(1);
    expect(compiled.containerFile.containerVersion.trigger.length).toBeGreaterThan(0);
    expect(compiled.dependencyOrder.at(-1)).toMatchObject({ kind: "tag" });
  });

  it("groups include conditions and compiles exclusions as blocking triggers", () => {
    const compiled = compileTrackingSetup(fixture("setup_navigation"), container);
    const triggers = compiled.containerFile.containerVersion.trigger as Array<Record<string, unknown>>;
    const tag = compiled.containerFile.containerVersion.tag[0] as Record<string, unknown>;
    const firing = triggers.find(({ name }) => name === "Firing - policy_navigation");
    const blocking = triggers.find(({ name }) => name === "Exclusion - policy_navigation");

    expect(firing?.autoEventFilter).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "STARTS_WITH" }),
      expect.objectContaining({ type: "MATCH_CSS_SELECTOR" }),
    ]));
    expect(blocking?.autoEventFilter).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "CONTAINS" }),
    ]));
    expect(tag.firingTriggerId).toEqual([firing?.triggerId]);
    expect(tag.blockingTriggerId).toEqual([blocking?.triggerId]);
    expect(tag.consentSettings).toMatchObject({ consentStatus: "NEEDED" });
  });

  it("creates referenced variables once and orders dependencies before consumers", () => {
    const compiled = compileTrackingSetup(fixture("setup_lead_form"), container);
    const version = compiled.containerFile.containerVersion;
    const variables = version.variable as Array<Record<string, unknown>>;
    const builtIns = version.builtInVariable as Array<Record<string, unknown>>;
    const positions = new Map(compiled.dependencyOrder.map((node, index) => [node.id, index]));

    expect(variables.map(({ name }) => name)).toEqual(["DLV - form_id", "DLV - form_name"]);
    expect(builtIns).toEqual([
      expect.objectContaining({ name: "Page Hostname", type: "PAGE_HOSTNAME" }),
    ]);
    for (const node of compiled.dependencyOrder) {
      for (const dependency of node.dependsOn) {
        const dependencyPosition = positions.get(dependency);
        const nodePosition = positions.get(node.id);
        expect(dependencyPosition).toBeDefined();
        expect(nodePosition).toBeDefined();
        expect(dependencyPosition!).toBeLessThan(nodePosition!);
      }
    }
  });

  it("produces entities the semantic change planner can reuse", () => {
    const compiled = compileTrackingSetup(fixture("setup_navigation"), container);
    const current = structuredClone(compiled.containerFile.containerVersion) as GtmEntitySet;
    const triggerIds = new Map<string, string>();
    current.trigger?.forEach((entity, index) => {
      const trigger = entity as Record<string, unknown>;
      const replacement = String(700 + index);
      triggerIds.set(String(trigger.triggerId), replacement);
      trigger.triggerId = replacement;
      trigger.workspaceId = "9";
    });
    current.tag?.forEach((entity, index) => {
      const tag = entity as Record<string, unknown>;
      tag.tagId = String(800 + index);
      tag.firingTriggerId = (tag.firingTriggerId as string[]).map((id) => triggerIds.get(id));
      tag.blockingTriggerId = (tag.blockingTriggerId as string[]).map((id) => triggerIds.get(id));
    });

    const plan = createTrackingChangePlan(compiled.containerFile, current);

    expect(plan.status).toBe("ready");
    expect(plan.actions.every(({ action }) => action === "reuse" || action === "no_op")).toBe(true);
  });

  it("rejects drafts and malformed dependencies", () => {
    const draft = { ...fixture("setup_navigation"), status: "draft" as const };
    expect(() => compileTrackingSetup(draft, container)).toThrow("confirmed tracking setup");

    const setup = fixture("setup_navigation");
    const malformed = {
      ...setup,
      tagActions: [{ ...setup.tagActions[0]!, firingPolicyIds: ["missing_policy"] }],
    };
    expect(() => compileTrackingSetup(malformed, container)).toThrow("references unknown missing_policy");
  });
});
