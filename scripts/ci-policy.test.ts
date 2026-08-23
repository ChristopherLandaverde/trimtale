import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CI verification policy", () => {
  const workflow = readFileSync(new URL("../.github/workflows/verify.yml", import.meta.url), "utf8");

  it("runs once per pull request and verifies merged main", () => {
    expect(workflow).toContain("push:\n    branches: [main]");
    expect(workflow).toContain("pull_request:\n    branches: [main]");
  });

  it("cancels obsolete verification for the same change", () => {
    expect(workflow).toContain("concurrency:");
    expect(workflow).toContain("cancel-in-progress: true");
  });
});
