import { describe, expect, it } from "vitest";
import {
  createTrackingChangePlan,
  GTM_MANAGED_ENTITY_NOTE,
  type GtmEntitySet,
} from "./change-plan.js";
import { createFormSetupProposal, createSetupProposal } from "./generator.js";
import type { FormSetupRequest, SetupRequest } from "./types.js";

const container = { accountId: "1", containerId: "2", publicId: "GTM-TEST123", name: "Test" };

function navigationSetup() {
  const request: SetupRequest = {
    intent: "Track navigation clicks",
    pageUrl: "https://example.test/",
    measurementId: "G-TEST123456",
    container,
    navigation: [{
      id: "pricing",
      text: "Pricing",
      href: "https://example.test/pricing",
      area: "nav",
      selector: "nav a[href='/pricing']",
    }],
  };
  return createSetupProposal(request).containerFile;
}

function formSetup() {
  const request: FormSetupRequest = {
    measurementId: "G-TEST123456",
    container,
    specification: {
      schemaVersion: 1,
      id: "spec_contact",
      status: "confirmed",
      originalIntent: "Track qualified contact inquiries",
      interaction: { type: "form_submission" },
      conversionOutcome: { type: "qualified_inquiry", practitionerConfirmed: true },
      event: {
        name: "generate_lead",
        requiredParameters: ["form_id", "form_name", "page_location"],
        optionalParameters: [],
      },
      targets: [{
        id: "contact",
        label: "Contact sales",
        selector: "form#contact",
        pageUrl: "https://example.test/",
      }],
      successEvidence: [{ type: "visible_element", selector: "#contact-success" }],
    },
  };
  return createFormSetupProposal(request).containerFile;
}

function entities(setup: ReturnType<typeof navigationSetup>): GtmEntitySet {
  return structuredClone(setup.containerVersion);
}

describe("tracking change plan", () => {
  it.each([
    ["navigation", navigationSetup],
    ["lead form", formSetup],
  ])("creates every missing entity for a %s setup", (_name, setupFactory) => {
    const plan = createTrackingChangePlan(setupFactory(), {});

    expect(plan.status).toBe("ready");
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.actions.every((action) => action.action === "create")).toBe(true);
  });

  it("returns no-ops for an identical setup", () => {
    const setup = navigationSetup();
    const plan = createTrackingChangePlan(setup, entities(setup));

    expect(plan.status).toBe("ready");
    expect(plan.actions.every((action) => action.action === "no_op")).toBe(true);
  });

  it("reuses semantic equivalents with different GTM IDs and trigger references", () => {
    const setup = navigationSetup();
    const current = entities(setup);
    const trigger = current.trigger?.[0] as Record<string, unknown>;
    const tag = current.tag?.[0] as Record<string, unknown>;
    trigger.triggerId = "42";
    trigger.workspaceId = "2";
    trigger.path = "accounts/1/containers/2/workspaces/2/triggers/42";
    trigger.fingerprint = "trigger-fingerprint";
    tag.tagId = "43";
    tag.firingTriggerId = ["42"];
    tag.workspaceId = "2";
    tag.tagManagerUrl = "https://tagmanager.google.test/tag/43";

    const plan = createTrackingChangePlan(setup, current);

    expect(plan.status).toBe("ready");
    expect(plan.actions.filter((action) => ["tag", "trigger"].includes(action.kind)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "tag", action: "reuse", existingId: "43" }),
        expect.objectContaining({ kind: "trigger", action: "reuse", existingId: "42" }),
      ]));
  });

  it("creates only missing entities from a partial setup", () => {
    const setup = navigationSetup();
    const current = entities(setup);
    current.tag = [];

    const plan = createTrackingChangePlan(setup, current);

    expect(plan.actions.find((action) => action.kind === "tag")?.action).toBe("create");
    expect(plan.actions.find((action) => action.kind === "trigger")?.action).toBe("no_op");
  });

  it("fails closed on a same-name semantic conflict", () => {
    const setup = navigationSetup();
    const current = entities(setup);
    const tag = current.tag?.[0] as { parameter?: Array<{ key?: string; value?: string }> };
    const measurement = tag.parameter?.find((item) => item.key === "measurementId");
    if (measurement) measurement.value = "G-CONFLICT999";

    const plan = createTrackingChangePlan(setup, current);

    expect(plan.status).toBe("conflict");
    expect(plan.actions).toContainEqual(expect.objectContaining({
      kind: "tag",
      action: "conflict",
      reason: "name_collision",
    }));
  });

  it("updates a same-name semantic conflict only when it is product-owned", () => {
    const setup = navigationSetup();
    const current = entities(setup);
    const tag = current.tag?.[0] as Record<string, unknown> & {
      parameter?: Array<{ key?: string; value?: string }>;
    };
    const measurement = tag.parameter?.find((item) => item.key === "measurementId");
    if (measurement) measurement.value = "G-OLDVALUE1";
    tag.notes = GTM_MANAGED_ENTITY_NOTE;

    expect(createTrackingChangePlan(setup, current).actions).toContainEqual(
      expect.objectContaining({ kind: "tag", action: "update", existingId: "900002" }),
    );
  });

  it("fails closed when multiple existing entities are semantically equivalent", () => {
    const setup = navigationSetup();
    const current = entities(setup);
    const duplicate = structuredClone(current.trigger?.[0]) as Record<string, unknown>;
    duplicate.triggerId = "99";
    duplicate.name = "Equivalent trigger under another name";
    current.trigger?.push(duplicate);

    const plan = createTrackingChangePlan(setup, current);

    expect(plan.status).toBe("conflict");
    expect(plan.actions).toContainEqual(expect.objectContaining({
      kind: "trigger",
      action: "conflict",
      reason: "ambiguous_equivalent",
    }));
  });

  it("keeps the plan fingerprint stable across irrelevant ordering", () => {
    const setup = navigationSetup();
    const current = entities(setup);
    const first = createTrackingChangePlan(setup, current);
    current.builtInVariable?.reverse();
    const second = createTrackingChangePlan(setup, current);

    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.actions).toEqual(first.actions);
  });
});
