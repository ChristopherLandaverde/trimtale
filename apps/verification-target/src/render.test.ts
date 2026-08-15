import { describe, expect, it } from "vitest";
import { renderVerificationTarget, validateContainerId } from "./render.js";

describe("verification target", () => {
  it("installs the configured GTM container in script, noscript, and metadata", () => {
    const html = renderVerificationTarget("gtm-test123");

    expect(html.match(/GTM-TEST123/g)).toHaveLength(4);
    expect(html).toContain("googletagmanager.com/gtm.js");
    expect(html).toContain("googletagmanager.com/ns.html");
    expect(html).toContain('name="gtm-observability-target"');
  });

  it("rejects an unsafe container ID", () => {
    expect(() => validateContainerId("GTM-X'><script>")).toThrow("must look like");
  });
});
