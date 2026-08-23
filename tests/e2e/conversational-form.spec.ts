import { expect, test } from "@playwright/test";
import { evaluateExplanation } from "@gtm-observability/core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openExtensionJourney } from "./helpers/extension-journey.js";

interface AcceptanceJourney {
  id: string;
  intent: string;
  fixtureState: string;
  expected: {
    eventName: "generate_lead";
    artifact: "gtm_container_import";
    verdict: string;
    browserVerification: string;
    platformConfirmation: "unverified";
    explanationMustInclude: string[];
    explanationMustNotClaim: string[];
  };
}

const contract = JSON.parse(readFileSync(
  resolve("tests/acceptance/conversational-form-e2e.json"),
  "utf8",
)) as { journeys: AcceptanceJourney[] };

for (const acceptance of contract.journeys) {
  test(`${acceptance.id}: completes the confirmed form journey`, async () => {
    const journey = await openExtensionJourney(acceptance.fixtureState);
    try {
      const { page, root } = journey;
      await journey.send(acceptance.intent);

      const targets = page.locator("#gtm-observability-targets");
      await expect(targets.locator(".target.candidate")).toHaveCount(2);
      await root.getByRole("button", { name: "Contact sales" }).click();
      await expect(targets.locator(".target.confirmed[data-target-id='contact']")).toHaveCount(1);
      await root.getByRole("button", { name: "Review setup" }).click();
      const task = root.getByRole("region", { name: "Agent task" });
      await expect(task).toHaveCount(1);
      await expect(task.locator(".agent-specification-row").filter({ hasText: "Event" }).getByText("generate_lead", { exact: true }))
        .toBeVisible();
      await root.getByRole("button", { name: "Approve setup" }).click();
      await expect(root.getByText(/Setup approved and generated/)).toBeVisible();
      await expect(root.getByText("Reviewable generate_lead setup generated")).toBeVisible();
      await expect(page.locator('meta[name="gtm-observability-measurement-id"]')).toHaveAttribute("content", "G-TEST123456");
      await expect(page.locator('meta[name="gtm-observability-container-id"]')).toHaveAttribute("content", "GTM-TEST123");

      await page.locator("form#contact input[name='email']").fill("private@example.com");
      const downloadPromise = page.waitForEvent("download");
      await root.getByRole("button", { name: "Download GTM setup" }).click();
      const download = await downloadPromise;
      await expect(root.getByText(/Nothing was applied or published/i)).toBeVisible();
      expect(download.suggestedFilename()).toBe("gtm-observability-generate-lead.json");
      const downloadPath = await download.path();
      if (!downloadPath) throw new Error("The GTM setup download did not produce a local artifact.");
      const artifactText = readFileSync(downloadPath, "utf8");
      const artifact = JSON.parse(artifactText) as {
        exportFormatVersion?: number;
        containerVersion?: { tag?: unknown[]; trigger?: unknown[] };
      };
      expect(artifact.exportFormatVersion).toBe(2);
      expect(artifact.containerVersion?.tag).toHaveLength(1);
      expect(artifact.containerVersion?.trigger).toHaveLength(1);
      expect(artifactText).toContain(acceptance.expected.eventName);
      expect(artifactText).not.toContain("private@example.com");

      await root.getByRole("button", { name: "Start verification" }).click();
      await expect(root.getByText(/Verification is ready/)).toBeVisible();
      await page.locator("form#contact button[type='submit']").click();

      const result = root.locator(".agent-verification-result");
      await expect(result.locator(".agent-specification-row").filter({ hasText: "Verdict" }).getByText(acceptance.expected.verdict, { exact: true })).toBeVisible();
      await expect(result.locator(".agent-specification-row").filter({ hasText: "Browser verification" }).getByText(acceptance.expected.browserVerification, { exact: true })).toBeVisible();
      await expect(result.locator(".agent-specification-row").filter({ hasText: "Platform confirmation" }).getByText(acceptance.expected.platformConfirmation, { exact: true })).toBeVisible();
      const explanation = await root.locator(".explanation").last().innerText();
      const evaluation = evaluateExplanation(explanation, {
        mustInclude: acceptance.expected.explanationMustInclude,
        mustNotClaim: acceptance.expected.explanationMustNotClaim,
      });
      expect(evaluation, explanation).toMatchObject({
        passed: true,
        missingConcepts: [],
        forbiddenClaims: [],
      });
      await page.screenshot({
        path: test.info().outputPath(`${acceptance.id}-final.png`),
        animations: "disabled",
      });
    } finally {
      await journey.close();
    }
  });
}

test("a confirmed lead form can recognize the page container", async () => {
  const journey = await openExtensionJourney("confirmed_success", "GTM-TEST123");
  await journey.context.route("http://127.0.0.1:8787/api/google/containers/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        containerWritesEnabled: false,
        result: {
          status: "recognized",
          publicId: "GTM-TEST123",
          container: { name: "Lead site", publicId: "GTM-TEST123" },
          workspace: {
            status: "available",
            action: "create",
            workspaceCount: 1,
            remainingSlots: 2,
          },
        },
      }),
    });
  });
  try {
    const { root } = journey;
    await journey.send("Track leads from the contact form");
    await root.getByRole("button", { name: "Contact sales" }).click();
    await root.getByRole("button", { name: "Review setup" }).click();
    await root.getByRole("button", { name: "Approve setup" }).click();

    await expect(root.getByText("Detected GTM-TEST123")).toBeVisible();
    await root.getByRole("button", { name: "Check GTM access" }).click();
    await expect(root.getByText(/Recognized Lead site.*Managed workspace can be prepared/)).toBeVisible();
    await expect(root.getByText(/Workspace preparation is disabled/)).toBeVisible();
    await expect(root.getByRole("button", { name: "Prepare managed workspace" })).toHaveCount(0);
  } finally {
    await journey.close();
  }
});
