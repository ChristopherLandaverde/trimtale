import { describe, expect, it } from "vitest";
import { renderVerificationTarget, validateContainerId } from "./render.js";

describe("verification target", () => {
  it("installs the configured GTM container and real workflow smoke form", () => {
    const html = renderVerificationTarget("gtm-test123");

    expect(html.match(/GTM-TEST123/g)).toHaveLength(4);
    expect(html).toContain("googletagmanager.com/gtm.js");
    expect(html).toContain("googletagmanager.com/ns.html");
    expect(html).toContain('name="gtm-observability-target"');
    expect(html).toContain('id="workflow-smoke-form"');
    expect(html).toContain('id="workflow-smoke-success"');
    expect(html).toContain("gtm_observability_smoke_success");
  });

  it("keeps entered values out of the success event contract", () => {
    const html = renderVerificationTarget("GTM-TEST123");
    const eventSource = html.slice(html.indexOf("gtm_observability_smoke_success"));

    expect(eventSource).toContain("form_id");
    expect(eventSource).toContain("form_name");
    expect(eventSource).not.toContain("FormData");
    expect(eventSource).not.toContain("input.value");
  });

  it("rejects an unsafe container ID", () => {
    expect(() => validateContainerId("GTM-X'><script>")).toThrow("must look like");
  });
});
