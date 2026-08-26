import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertTrackingSetup,
  validateTrackingSetup,
  type TrackingSetupV1,
} from "./setup-contract.js";

function loadFixtures(): TrackingSetupV1[] {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/fixtures/tracking-setups-v1.json"),
    "utf8",
  )) as TrackingSetupV1[];
}

function navigationFixture(): TrackingSetupV1 {
  const fixture = loadFixtures().find((setup) => setup.id === "setup_navigation");
  if (!fixture) {
    throw new Error("Navigation setup fixture is missing.");
  }

  return fixture;
}

describe("generic tracking setup contract", () => {
  it("validates unrelated setup fixtures through one contract", () => {
    const fixtures = loadFixtures();

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      "setup_navigation",
      "setup_lead_form",
      "setup_page_scope",
      "setup_phone_click",
      "setup_data_layer",
    ]);
    expect(fixtures.map((fixture) => fixture.tagActions[0]?.event?.name)).toEqual([
      "navigation_click",
      "generate_lead",
      "pricing_page_view",
      "phone_click",
      "quote_ready",
    ]);

    for (const fixture of fixtures) {
      expect(validateTrackingSetup(fixture), fixture.id).toEqual([]);
      assertTrackingSetup(JSON.parse(JSON.stringify(fixture)) as unknown);
    }
  });

  it("accepts a new event name and template identifier as data", () => {
    const fixture = navigationFixture();
    const openEvent = {
      ...fixture,
      tagActions: [{
        ...fixture.tagActions[0],
        execution: {
          type: "template",
          templateId: "vendor.custom.template",
          fields: [{
            name: "event_settings",
            value: {
              type: "list",
              items: [{
                type: "map",
                entries: [
                  { name: "parameter", value: { type: "literal", value: "account_id" } },
                  {
                    name: "value",
                    value: { type: "data_layer_variable", name: "DLV - account_id", key: "account_id" },
                  },
                ],
              }],
            },
          }],
        },
        event: { name: "partner_demo_requested", parameters: [] },
      }],
    };

    expect(validateTrackingSetup(openEvent)).toEqual([]);
  });

  it("represents Custom HTML without making it an analytics event", () => {
    const fixture = navigationFixture();
    const customHtml = {
      ...fixture,
      tagActions: [{
        ...fixture.tagActions[0],
        execution: { type: "custom_html", html: "<script src=\"https://cdn.vendor.test/tag.js\"></script>" },
        destination: { type: "external", identifier: "vendor.example" },
        event: undefined,
      }],
    };

    expect(validateTrackingSetup(customHtml)).toEqual([]);
  });

  it.each([
    ["root", null, "tracking setup must be an object"],
    ["version", { schemaVersion: 2 }, "schemaVersion must be 1"],
    ["identity", { id: "invalid id" }, "id is invalid"],
    ["status", { status: "published" }, "status is invalid"],
    ["intent", { intent: { statement: "", businessOutcome: "" } }, "intent.statement is required"],
    ["tag actions", { tagActions: [] }, "at least one tag action is required"],
    ["firing policies", { firingPolicies: [] }, "at least one firing policy is required"],
    ["verification", { verification: { positive: [], negative: [] } }, "verification.positive requires an expectation"],
  ])("rejects malformed %s boundaries", (_name, replacement, expected) => {
    const fixture = navigationFixture();
    const invalid = replacement === null ? null : { ...fixture, ...replacement };

    expect(validateTrackingSetup(invalid)).toContain(expected);
  });

  it.each([
    [
      "action execution",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        tagActions: [{ ...fixture.tagActions[0], execution: { type: "unknown" } }],
      }),
      "tagActions[0].execution.type is unsupported",
    ],
    [
      "template fields",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        tagActions: [{
          ...fixture.tagActions[0],
          execution: {
            type: "template",
            templateId: "vendor.template",
            fields: [{ name: "account", value: { type: "cookie", name: "private" } }],
          },
        }],
      }),
      "tagActions[0].execution.fields[0].value.type is unsupported",
    ],
    [
      "destination",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        tagActions: [{ ...fixture.tagActions[0], destination: { type: "browser_storage" } }],
      }),
      "tagActions[0].destination.type is unsupported",
    ],
    [
      "event name",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        tagActions: [{ ...fixture.tagActions[0], event: { name: "invalid event", parameters: [] } }],
      }),
      "tagActions[0].event.name is invalid",
    ],
    [
      "parameter mapping",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        tagActions: [{
          ...fixture.tagActions[0],
          event: {
            name: "navigation_click",
            parameters: [{ name: "link_url", requirement: "required", value: { type: "cookie", name: "session" } }],
          },
        }],
      }),
      "tagActions[0].event.parameters[0].value.type is unsupported",
    ],
    [
      "trigger source",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        firingPolicies: [{ ...fixture.firingPolicies[0], source: { type: "timer" } }],
      }),
      "firingPolicies[0].source.type is unsupported",
    ],
    [
      "custom data-layer source",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        firingPolicies: [{ ...fixture.firingPolicies[0], source: { type: "custom_data_layer" } }],
      }),
      "firingPolicies[0].source.eventName is required",
    ],
    [
      "condition",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        firingPolicies: [{
          ...fixture.firingPolicies[0],
          include: [{
            variable: { type: "built_in_variable", name: "Page URL" },
            operator: "executes",
            value: "javascript:",
          }],
        }],
      }),
      "firingPolicies[0].include[0].operator is unsupported",
    ],
    [
      "regular expression",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        firingPolicies: [{
          ...fixture.firingPolicies[0],
          include: [{
            variable: { type: "built_in_variable", name: "Page Path" },
            operator: "matches_regex",
            value: "[",
          }],
        }],
      }),
      "firingPolicies[0].include[0].value is not a valid regular expression",
    ],
    [
      "unsafe regular expression",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        firingPolicies: [{
          ...fixture.firingPolicies[0],
          include: [{
            variable: { type: "built_in_variable", name: "Page Path" },
            operator: "matches_regex",
            value: "^(a+)+$",
          }],
        }],
      }),
      "firingPolicies[0].include[0].value is not a safe regular expression",
    ],
    [
      "unsafe selector",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        firingPolicies: [{ ...fixture.firingPolicies[0], source: { type: "click", selector: "a<script>" } }],
      }),
      "firingPolicies[0].source.selector is invalid",
    ],
    [
      "frequency",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        firingPolicies: [{ ...fixture.firingPolicies[0], frequency: "sometimes" }],
      }),
      "firingPolicies[0].frequency is unsupported",
    ],
    [
      "consent",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        firingPolicies: [{
          ...fixture.firingPolicies[0],
          consent: { required: ["private_storage"], whenDenied: "ignore" },
        }],
      }),
      "firingPolicies[0].consent.required contains an unsupported consent type",
    ],
    [
      "verification expectation",
      (fixture: TrackingSetupV1) => ({
        ...fixture,
        verification: { positive: [{ type: "model_claim", value: "passed" }], negative: [] },
      }),
      "verification.positive[0].type is unsupported",
    ],
  ])("rejects malformed %s", (_name, mutate, expected) => {
    expect(validateTrackingSetup(mutate(navigationFixture()))).toContain(expected);
  });

  it("rejects duplicate identifiers and broken references", () => {
    const fixture = navigationFixture();
    const invalid = {
      ...fixture,
      tagActions: [fixture.tagActions[0], fixture.tagActions[0]],
      firingPolicies: [{ ...fixture.firingPolicies[0], id: "policy_other" }],
      verification: {
        ...fixture.verification,
        positive: [{ type: "tag_fired", tagActionId: "missing_tag" }],
      },
    };

    expect(validateTrackingSetup(invalid)).toEqual(expect.arrayContaining([
      "tagActions contains duplicate id tag_navigation",
      "tagActions[0].firingPolicyIds references unknown policy_navigation",
      "tagActions[1].firingPolicyIds references unknown policy_navigation",
      "verification.positive[0].tagActionId references unknown missing_tag",
    ]));
  });
});
