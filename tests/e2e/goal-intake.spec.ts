import { expect, test } from "./helpers/extension-test.js";

const authority = {
  canConfirmSpecification: false,
  canWriteGtm: false,
  canReportEvidenceVerdict: false,
  canClaimPlatformReceipt: false,
};

async function openAgent(page: import("@playwright/test").Page) {
  await page.goto("http://127.0.0.1:4175/");
  const root = page.locator("#gtm-observability-root");
  const assistant = root.locator("section.assistant");
  await expect(assistant).toBeAttached();
  if (await assistant.evaluate((element) => element.classList.contains("collapsed"))) {
    await root.getByRole("button", { name: "Open tracking agent" }).click();
  }
  return root;
}

test("grounds ordinary outcome language in the existing form review journey", async ({ context }) => {
  let modelRequest: unknown;
  await context.route("http://127.0.0.1:8787/api/intake/interpretations", async (route) => {
    modelRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          schemaVersion: 2,
          statedOutcome: "Generate qualified inquiries",
          measurements: [{
            id: "qualified_inquiry_form",
            conversionOutcome: "Qualified inquiry",
            interactionCandidate: "form_submission",
            groundedTargetCandidateIds: ["form_1"],
            groundedSuccessEvidenceCandidateIds: ["form_1_evidence_1"],
          }],
          ambiguities: [],
          clarification: null,
          authority,
        },
      }),
    });
  });
  const page = await context.newPage();
  const root = await openAgent(page);

  await root.getByLabel("Tracking request").fill("Track lead generation");
  await root.getByRole("button", { name: "Send request" }).click();

  await expect(root.getByText(
    /successful Disposable workflow smoke form submissions as generate_lead/,
  )).toBeVisible();
  await expect(root.getByRole("button", { name: "Review what will be tracked" })).toBeVisible();
  expect(modelRequest).toMatchObject({
    schemaVersion: 2,
    messages: ["Track lead generation"],
    pageCandidates: expect.arrayContaining([
      expect.objectContaining({ id: "form_1", kind: "form" }),
    ]),
    successEvidenceCandidates: [expect.objectContaining({
      id: "form_1_evidence_1",
      targetId: "form_1",
    })],
  });
  expect(JSON.stringify(modelRequest)).not.toMatch(/selector|pageUrl|workflow-smoke-form/);

  await root.getByRole("button", { name: "Review what will be tracked" }).click();
  await expect(root.getByText("Qualified inquiry", { exact: true })).toBeVisible();
  await expect(root.getByRole("button", { name: "Approve setup" })).toBeVisible();
});

test("does not adopt invented model grounding", async ({ context }) => {
  await context.route("http://127.0.0.1:8787/api/intake/interpretations", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      result: {
        schemaVersion: 2,
        statedOutcome: "Understand prospect intent",
        measurements: [{
          id: "invented_measurement",
          conversionOutcome: "Qualified prospect",
          interactionCandidate: "form_submission",
          groundedTargetCandidateIds: ["invented_target"],
          groundedSuccessEvidenceCandidateIds: [],
        }],
        ambiguities: [],
        clarification: null,
        authority,
      },
    }),
  }));
  const page = await context.newPage();
  const root = await openAgent(page);

  await root.getByLabel("Tracking request").fill("Show me when a visitor becomes valuable");
  await root.getByRole("button", { name: "Send request" }).click();

  await expect(root.getByText("Define a tracking task", { exact: true })).toBeVisible();
  await expect(root.getByRole("button", { name: "Review what will be tracked" })).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Approve setup" })).toHaveCount(0);
});

test("keeps multi-measurement intake non-authoritative in a plan", async ({ context }) => {
  await context.route("http://127.0.0.1:8787/api/intake/interpretations", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      result: {
        schemaVersion: 2,
        statedOutcome: "Understand valuable visitor outcomes",
        measurements: [
          {
            id: "qualified_inquiry",
            conversionOutcome: "Qualified inquiry",
            interactionCandidate: "form_submission",
            groundedTargetCandidateIds: ["form_1"],
            groundedSuccessEvidenceCandidateIds: ["form_1_evidence_1"],
          },
          {
            id: "form_engagement",
            conversionOutcome: "Form engagement",
            interactionCandidate: "form_submission",
            groundedTargetCandidateIds: ["form_1"],
            groundedSuccessEvidenceCandidateIds: ["form_1_evidence_1"],
          },
        ],
        ambiguities: [],
        clarification: null,
        authority,
      },
    }),
  }));
  const page = await context.newPage();
  const root = await openAgent(page);

  await root.getByLabel("Tracking request").fill("Track lead generation and form engagement");
  await root.getByRole("button", { name: "Send request" }).click();

  const plan = root.getByRole("region", { name: "Measurement plan" });
  await expect(plan).toBeVisible();
  await expect(plan.getByRole("listitem")).toHaveCount(2);
  await expect(plan.getByRole("button", { name: "Start Qualified inquiry" })).toBeVisible();
  await expect(plan.getByRole("button", { name: "Start Form engagement" })).toBeVisible();
  await expect(root.getByRole("button", { name: "Review what will be tracked" })).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Approve setup" })).toHaveCount(0);
});
