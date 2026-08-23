import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createSetupProposal, validateSetupRequest } from "./generator.js";
import { createConfirmedNavigationScope, discoverNavigationTargetGroups } from "./navigation-scope.js";
import type { SetupRequest } from "./types.js";

interface Scenario {
  name: string;
  request: SetupRequest;
  expected: { valid: boolean; navigationCount: number };
}

function scenario(name: string): Scenario {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `fixtures/scenarios/navigation/${name}.json`), "utf8"),
  ) as Scenario;
}

describe("navigation setup scenario corpus", () => {
  for (const name of ["valid-header-links", "duplicate-element", "invalid-measurement-id"]) {
    it(name, () => {
      const item = scenario(name);
      const errors = validateSetupRequest(item.request);
      expect(errors.length === 0).toBe(item.expected.valid);
      if (!item.expected.valid) return;

      const proposal = createSetupProposal(item.request);
      expect(proposal.navigation).toHaveLength(item.expected.navigationCount);
      expect(proposal.eventName).toBe("navigation_click");
      expect(proposal.specification.schemaVersion).toBe(1);
      expect(proposal.specification.status).toBe("confirmed");
      expect(proposal.specification.targets).toHaveLength(item.expected.navigationCount);
      expect(proposal.preflight.status).toBe("passed");
      expect(proposal.containerFile.exportFormatVersion).toBe(2);
      expect(proposal.containerFile.containerVersion.tag).toHaveLength(1);
      expect(proposal.containerFile.containerVersion.trigger).toHaveLength(1);
      expect(proposal.containerFile.containerVersion.builtInVariable).toHaveLength(3);
      expect(proposal.containerFile.containerVersion.variable).toHaveLength(1);
      expect(proposal.warnings.join(" ")).toMatch(/managed workspace.*Merge.*existing review workspace/);
      expect(proposal.warnings.join(" ")).not.toContain("new GTM workspace");
    });
  }
});

describe("generated GTM scope", () => {
  it("limits the trigger to confirmed URLs", () => {
    const proposal = createSetupProposal(scenario("valid-header-links").request);
    const trigger = proposal.containerFile.containerVersion.trigger[0] as {
      autoEventFilter: Array<{ parameter: Array<{ key?: string; value?: string }> }>;
    };
    const pattern = trigger.autoEventFilter[0]?.parameter.find((item) => item.key === "arg1")?.value;
    expect(pattern).toContain("https://example\\.test/services");
    expect(pattern).toContain("https://example\\.test/contact");
  });

  it("distinguishes the same destination in header and footer by confirmed scope", () => {
    const base = scenario("valid-header-links").request;
    const navigation = [
      {
        id: "header_contact",
        text: "Contact",
        href: "https://example.test/contact",
        area: "header" as const,
        selector: "header nav a[href='/contact']",
        groupId: "primary_navigation",
        groupLabel: "Primary navigation",
      },
      {
        id: "footer_contact",
        text: "Contact",
        href: "https://example.test/contact",
        area: "footer" as const,
        selector: "footer nav a[href='/contact']",
        groupId: "footer_navigation",
        groupLabel: "Footer navigation",
      },
    ];
    const navigationScope = createConfirmedNavigationScope(
      discoverNavigationTargetGroups(navigation),
      ["primary_navigation"],
    );
    const proposal = createSetupProposal({ ...base, navigation, navigationScope });
    expect(proposal.navigation.map(({ id }) => id)).toEqual(["header_contact"]);
    expect(proposal.navigationScope.excludedGroupIds).toEqual(["footer_navigation"]);
    expect(proposal.specification.navigationScope).toEqual(navigationScope);
    const trigger = proposal.containerFile.containerVersion.trigger[0] as {
      autoEventFilter: Array<{ type: string; parameter: Array<{ key?: string; value?: string }> }>;
    };
    const selectorFilter = trigger.autoEventFilter.find(({ type }) => type === "CSS_SELECTOR");
    const selector = selectorFilter?.parameter.find(({ key }) => key === "arg1")?.value;
    expect(selector).toContain("header nav");
    expect(selector).not.toContain("footer nav");
    expect(JSON.stringify(proposal.containerFile.containerVersion.tag)).toContain("navigation_area");
    expect(JSON.stringify(proposal.containerFile.containerVersion.tag)).toContain("GTM Observability - Navigation Area");
  });
});
