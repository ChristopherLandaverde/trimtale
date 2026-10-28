import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  projectProviderProgress,
  validateProviderProgressProjection,
  type ProviderProgressInputV1,
} from "./provider-progress.js";

interface AcceptanceFixture {
  cases: Array<{
    id: string;
    input: ProviderProgressInputV1;
    expected: {
      accepted: boolean;
      state?: string;
      retry?: string;
      error?: string;
      messageConcepts?: string[];
      additionalProviderCalls: number;
      forbiddenPersisted?: string[];
    };
  }>;
}

function fixture(): AcceptanceFixture {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/provider-operation-progress.json"),
    "utf8",
  )) as AcceptanceFixture;
}

describe("provider operation progress", () => {
  it("projects every accepted stage without issuing provider work", () => {
    for (const scenario of fixture().cases) {
      if (!scenario.expected.accepted) continue;
      const projection = projectProviderProgress(scenario.input);
      expect(projection.state, scenario.id).toBe(scenario.expected.state);
      expect(projection.retry, scenario.id).toBe(scenario.expected.retry);
      expect(scenario.expected.additionalProviderCalls, scenario.id).toBe(0);
      for (const concept of scenario.expected.messageConcepts ?? []) {
        expect(projection.message.toLowerCase(), scenario.id).toContain(concept);
      }
    }
  });

  it("rejects unsupported stages and unsafe failure codes", () => {
    for (const scenario of fixture().cases) {
      if (scenario.expected.accepted) continue;
      expect(() => projectProviderProgress(scenario.input), scenario.id)
        .toThrow(scenario.expected.error);
      const serialized = JSON.stringify(scenario.input);
      for (const forbidden of scenario.expected.forbiddenPersisted ?? []) {
        expect(serialized).toContain(forbidden);
      }
    }
  });

  it("keeps the versioned API projection bounded to safe fields", () => {
    const scenario = fixture().cases.find(({ id }) => id === "publication-provider-failure");
    if (!scenario) throw new Error("Publication failure acceptance case is missing.");
    const projection = projectProviderProgress(scenario.input);

    expect(validateProviderProgressProjection(projection)).toEqual([]);
    expect(validateProviderProgressProjection({ ...projection, oauthToken: "PRIVATE_TOKEN_SENTINEL" }))
      .toContain("provider progress contains unsupported data");
    expect(JSON.stringify(projection)).not.toContain("PRIVATE_TOKEN_SENTINEL");
  });
});
