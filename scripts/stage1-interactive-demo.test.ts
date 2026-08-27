import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve("scripts/stage1-interactive-demo.mjs"), "utf8");

describe("safe Stage 1 interactive demo", () => {
  it("completes the mocked live-verification boundary", () => {
    expect(source).toContain('/api/google/workflows/*/verify-publication');
    expect(source).toContain('status: "completed"');
    expect(source).toContain('nextStep: "complete"');
    expect(source).toContain('postPublicationEvidenceId: "run-live-manual-demo-8"');
  });

  it("guides the practitioner to the verified ending", () => {
    expect(source).toContain("Run live verification and submit the form once more.");
    expect(source).toContain("Finish at the Live and verified receipt.");
  });

  it("emits the complete privacy-safe generate_lead request", () => {
    expect(source).toContain("en=generate_lead&ep.form_id=demo-lead");
    expect(source).toContain("ep.form_name=Demo%20lead%20form");
    expect(source).toContain("&dl=' + encodeURIComponent(location.href)");
    expect(source).not.toContain("encodeURIComponent(document.querySelector('#work-email')");
  });
});
