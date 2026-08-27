import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface ProgressAcceptance {
  schemaVersion: number;
  issue: string;
  stages: string[];
  states: string[];
  cases: Array<{
    id: string;
    input: {
      stage: string | null;
      attemptStatus: string | null;
      liveRequest: boolean;
      displayTimedOut: boolean;
      browserReloaded: boolean;
      action: string;
    };
    expected: {
      accepted: boolean;
      state?: string;
      retry?: string;
      additionalProviderCalls: number;
      forbiddenPersisted?: string[];
    };
  }>;
}

function loadAcceptance(): ProgressAcceptance {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/provider-operation-progress.json"),
    "utf8",
  )) as ProgressAcceptance;
}

describe("issue 27 provider-progress acceptance", () => {
  it("names every durable provider stage and visible state", () => {
    const acceptance = loadAcceptance();

    expect(acceptance).toMatchObject({
      schemaVersion: 1,
      issue: ".scratch/gtm-setup-engine/issues/27-provider-operation-progress.md",
    });
    expect(acceptance.stages).toEqual([
      "planning",
      "application",
      "validation",
      "versioning",
      "publication",
      "rollback",
    ]);
    expect(acceptance.states).toEqual([
      "in_flight",
      "reconciling",
      "failed",
      "awaiting_user",
      "completed",
    ]);
  });

  it("keeps timeout, reload, and duplicate actions mutation-free", () => {
    const acceptance = loadAcceptance();
    const cases = acceptance.cases.filter(({ id }) => [
      "duplicate-application-action",
      "validation-display-timeout",
      "versioning-browser-reload",
    ].includes(id));

    expect(cases).toHaveLength(3);
    expect(cases.every(({ expected }) =>
      expected.accepted
      && expected.state === "in_flight"
      && expected.retry === "locked"
      && expected.additionalProviderCalls === 0
    )).toBe(true);
  });

  it("requires reconciliation after a lost live request", () => {
    const acceptance = loadAcceptance();
    const restart = acceptance.cases.find(({ id }) => id === "rollback-backend-restart");
    const failure = acceptance.cases.find(({ id }) => id === "publication-provider-failure");

    expect(restart?.input).toMatchObject({ attemptStatus: "started", liveRequest: false });
    expect(restart?.expected).toMatchObject({
      state: "reconciling",
      retry: "locked",
      additionalProviderCalls: 0,
    });
    expect(failure?.expected).toMatchObject({ state: "failed", retry: "conditional" });
  });

  it("rejects unknown stages and unsafe provider failures", () => {
    const rejected = loadAcceptance().cases.filter(({ expected }) => !expected.accepted);

    expect(rejected.map(({ id }) => id)).toEqual([
      "unknown-provider-stage-rejected",
      "raw-provider-error-rejected",
    ]);
    expect(rejected.every(({ expected }) => expected.additionalProviderCalls === 0)).toBe(true);
    expect(rejected.at(-1)?.expected.forbiddenPersisted).toEqual(["PRIVATE_TOKEN_SENTINEL"]);
  });
});
