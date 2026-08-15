import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createSetupProposal, validateSetupRequest } from "./generator.js";
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
      expect(proposal.preflight.status).toBe("passed");
      expect(proposal.containerFile.exportFormatVersion).toBe(2);
      expect(proposal.containerFile.containerVersion.tag).toHaveLength(1);
      expect(proposal.containerFile.containerVersion.trigger).toHaveLength(1);
      expect(proposal.containerFile.containerVersion.builtInVariable).toHaveLength(2);
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
});
