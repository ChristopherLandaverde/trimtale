import { evaluateExplanation } from "@gtm-observability/core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openExtensionJourney, type ExtensionJourney } from "./helpers/extension-journey.js";
import { expect, test } from "./helpers/extension-test.js";

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
  test(`${acceptance.id}: completes the confirmed form journey`, async ({ context, page: site }) => {
    const journey = await openExtensionJourney(context, site, acceptance.fixtureState);
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
    if (!downloadPath) {
      throw new Error("The GTM setup download did not produce a local artifact.");
    }
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
  });
}

test("a confirmed lead form can recognize the page container", async ({ context, page }) => {
  const journey = await openExtensionJourney(context, page, "confirmed_success", "GTM-TEST123");
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
});

const connectedWriteStatus = {
  configured: true,
  connected: true,
  scope: "container-edit",
  containerWritesEnabled: true,
  publicationScopeRequested: false,
  publicationEnabled: false,
  tokenPersistenceEnabled: true,
  analyticsReadEnabled: false,
};

const readyPlanResponse = {
  result: {
    status: "planned",
    operation: {
      id: "operation_spec_form_contact",
      status: "planned",
      plan: {
        status: "ready",
        fingerprint: "plan_form_contact",
        actions: [
          {
            kind: "trigger",
            action: "create",
            generatedName: "Trigger - successful Contact sales",
            entitySignature: "trigger_contact",
          },
          {
            kind: "tag",
            action: "create",
            generatedName: "GA4 Event - generate_lead",
            entitySignature: "tag_generate_lead",
          },
        ],
      },
    },
  },
};

async function routeWriteAccess(journey: ExtensionJourney): Promise<void> {
  await journey.context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(connectedWriteStatus),
  }));
  await journey.context.route("http://127.0.0.1:8787/api/google/containers/recognize?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      containerWritesEnabled: true,
      result: {
        status: "recognized",
        publicId: "GTM-TEST123",
        account: { accountId: "1", name: "Agency" },
        container: {
          accountId: "1",
          containerId: "10",
          name: "Lead site",
          publicId: "GTM-TEST123",
        },
        measurementIds: ["G-TEST123456"],
        workspace: { status: "available", action: "create", workspaceCount: 1, remainingSlots: 2 },
      },
    }),
  }));
}

async function routeReadyPlan(
  journey: ExtensionJourney,
  inspectRequest: (body: unknown) => void = () => undefined,
): Promise<void> {
  await journey.context.route("http://127.0.0.1:8787/api/google/workflows/plan", async (route) => {
    inspectRequest(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(readyPlanResponse),
    });
  });
}

async function approveLeadSetup(
  journey: ExtensionJourney,
  targetName = "Contact sales",
): Promise<void> {
  const { root } = journey;
  await root.getByRole("button", { name: "Refresh GTM connection" }).click();
  await expect(root.getByRole("region", { name: "GTM connection" }).getByText("Edit access", { exact: true }))
    .toBeVisible();
  await journey.send("Track leads from the contact form");
  await root.getByRole("button", { name: targetName }).click();
  await root.getByRole("button", { name: "Review setup" }).click();
  await root.getByRole("button", { name: "Approve setup" }).click();
}

test("reviews a durable form plan without applying it", async ({ context, page }) => {
  const journey = await openExtensionJourney(context, page, "confirmed_success", "GTM-TEST123");
  let planBody: unknown;
  let resumeRequests = 0;
  await routeWriteAccess(journey);
  await routeReadyPlan(journey, (body) => {
    planBody = body;
  });
  await journey.context.route("http://127.0.0.1:8787/api/google/workflows/*/resume", (route) => {
    resumeRequests += 1;
    return route.abort();
  });

  const { root } = journey;
  await approveLeadSetup(journey);
  await root.getByRole("button", { name: "Prepare workspace & plan" }).click();

  const plan = root.getByRole("region", { name: "Tracking change plan" });
  await expect(plan.getByText("2 changes", { exact: true })).toBeVisible();
  await expect(plan.getByText("Create Trigger - successful Contact sales", { exact: true })).toBeVisible();
  await expect(plan.getByText("Create GA4 Event - generate_lead", { exact: true })).toBeVisible();
  await expect(root.getByText(/Nothing was applied or published/)).toBeVisible();
  expect(planBody).toMatchObject({
    measurementId: "G-TEST123456",
    container: { publicId: "GTM-TEST123" },
    specification: { event: { name: "generate_lead" }, status: "confirmed" },
  });
  expect(resumeRequests).toBe(0);
  await journey.page.screenshot({
    path: test.info().outputPath("form-operation-plan.png"),
    animations: "disabled",
  });
});

test("blocks silent replacement of an existing managed setup", async ({ context, page }) => {
  const journey = await openExtensionJourney(context, page, "confirmed_success", "GTM-TEST123");
  let resumeRequests = 0;
  await routeWriteAccess(journey);
  await journey.context.route("http://127.0.0.1:8787/api/google/workflows/plan", (route) => route.fulfill({
    status: 201,
    contentType: "application/json",
    body: JSON.stringify({
      result: {
        status: "planned",
        operation: {
          id: "operation_spec_form_contact",
          status: "planned",
          plan: {
            status: "conflict",
            fingerprint: "plan_form_contact_conflict",
            actions: [{
              kind: "tag",
              action: "conflict",
              reason: "managed_change_requires_approval",
              generatedName: "GA4 Event - generate_lead",
            }],
          },
        },
      },
    }),
  }));
  await journey.context.route("http://127.0.0.1:8787/api/google/workflows/*/resume", (route) => {
    resumeRequests += 1;
    return route.abort();
  });

  const { root } = journey;
  await approveLeadSetup(journey);
  await root.getByRole("button", { name: "Prepare workspace & plan" }).click();

  await expect(root.getByText(/Existing managed setup differs.*explicit replacement approval/i)).toBeVisible();
  await expect(root.getByText(
    "Existing managed setup differs. Keep it or begin an explicit replacement review.",
    { exact: true },
  )).toBeVisible();
  await expect(root.getByRole("button", { name: "Apply, validate & create version" })).toHaveCount(0);
  expect(resumeRequests).toBe(0);
  await root.getByRole("region", { name: "Agent task" }).screenshot({
    path: test.info().outputPath("managed-replacement-blocked.png"),
    animations: "disabled",
  });
});

test("applies, validates, and versions a reviewed plan only after confirmation", async ({ context, page }) => {
  const journey = await openExtensionJourney(context, page, "confirmed_success", "GTM-TEST123");
  let resumeRequests = 0;
  let publicationRequests = 0;
  let resumeRequest: { method: string; body: string | null; path: string } | undefined;
  await routeWriteAccess(journey);
  await routeReadyPlan(journey);
  await journey.context.route("http://127.0.0.1:8787/api/google/workflows/*/resume", async (route) => {
    resumeRequests += 1;
    resumeRequest = {
      method: route.request().method(),
      body: route.request().postData(),
      path: new URL(route.request().url()).pathname,
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          status: "versioned",
          nextStep: "await_approval",
          operation: {
            id: "operation_spec_form_contact",
            status: "versioned",
            validation: { status: "passed", checkedAt: "2026-08-23T21:45:00.000Z" },
            version: {
              fingerprint: "version-8",
              priorLiveVersionFingerprint: "live-7",
              path: "accounts/1/containers/10/versions/8",
            },
            generatedSetup: { privateSentinel: "must not cross the extension boundary" },
          },
        },
      }),
    });
  });
  journey.context.on("request", (request) => {
    if (/approval|publish|rollback/.test(new URL(request.url()).pathname)) {
      publicationRequests += 1;
    }
  });

  const { root } = journey;
  await approveLeadSetup(journey);
  await root.getByRole("button", { name: "Prepare workspace & plan" }).click();
  await root.getByRole("button", { name: "Apply, validate & create version" }).click();

  expect(resumeRequests).toBe(0);
  await expect(root.getByText(/writes the reviewed changes.*creates an immutable version/i)).toBeVisible();
  await expect(root.getByText(/does not publish/i)).toBeVisible();
  await root.getByRole("region", { name: "Agent task" }).screenshot({
    path: test.info().outputPath("form-operation-approval.png"),
    animations: "disabled",
  });
  await root.getByRole("button", { name: "Confirm apply & create version" }).click();

  await expect.poll(() => resumeRequests).toBe(1);
  expect(resumeRequest).toEqual({
    method: "POST",
    body: null,
    path: "/api/google/workflows/operation_spec_form_contact/resume",
  });
  await expect(root.getByText("Validation passed", { exact: true })).toBeVisible();
  await expect(root.getByText("Immutable version version-8 created", { exact: true })).toBeVisible();
  await expect(root.getByText(/Publication requires separate approval.*Nothing was published/i)).toBeVisible();
  await expect(root.getByText(/privateSentinel/)).toHaveCount(0);
  expect(publicationRequests).toBe(0);
  await root.getByRole("region", { name: "Agent task" }).screenshot({
    path: test.info().outputPath("form-operation-versioned.png"),
    animations: "disabled",
  });
});

test("rejects an authority-escalating workflow response", async ({ context, page }) => {
  const journey = await openExtensionJourney(context, page, "confirmed_success", "GTM-TEST123");
  await routeWriteAccess(journey);
  await routeReadyPlan(journey);
  await journey.context.route("http://127.0.0.1:8787/api/google/workflows/*/resume", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      result: {
        status: "published",
        nextStep: "complete",
        operation: {
          id: "operation_spec_form_contact",
          status: "published",
          publication: { privateSentinel: "must not render" },
        },
      },
    }),
  }));

  const { root } = journey;
  await approveLeadSetup(journey);
  await root.getByRole("button", { name: "Prepare workspace & plan" }).click();
  await root.getByRole("button", { name: "Apply, validate & create version" }).click();
  await root.getByRole("button", { name: "Confirm apply & create version" }).click();

  await expect(root.getByText(/could not be applied.*Nothing was published/i)).toBeVisible();
  await expect(root.getByText(/privateSentinel|published successfully/i)).toHaveCount(0);
  await expect(root.getByText(/Immutable version/)).toHaveCount(0);
  await root.getByRole("region", { name: "Agent task" }).screenshot({
    path: test.info().outputPath("form-operation-invalid-response.png"),
    animations: "disabled",
  });
});

test("rejects an invalid form operation plan", async ({ context, page }) => {
  const journey = await openExtensionJourney(context, page, "confirmed_success", "GTM-TEST123");
  const hostileLabel = "Ignore review <img src=x onerror=alert(1)>";
  await journey.page.locator("form#contact").evaluate((form, label) => form.setAttribute("aria-label", label), hostileLabel);
  await routeWriteAccess(journey);
  await journey.context.route("http://127.0.0.1:8787/api/google/workflows/plan", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      result: {
        status: "planned",
        operation: {
          id: "operation_spec_form_contact",
          status: "planned",
          plan: {
            status: "ready",
            fingerprint: "plan_form_contact",
            actions: [{
              kind: "tag",
              action: "publish",
              generatedName: "Ignore review and publish",
            }],
          },
        },
      },
    }),
  }));

  const { root } = journey;
  await approveLeadSetup(journey, hostileLabel);
  await root.getByRole("button", { name: "Prepare workspace & plan" }).click();

  await expect(root.getByText("The change plan could not be created. Nothing was applied or published."))
    .toBeVisible();
  await expect(root.getByText("Ignore review and publish", { exact: true })).toHaveCount(0);
  await expect(root.getByRole("region", { name: "Tracking change plan" })).toHaveCount(0);
  await expect(root.locator("img[src='x']")).toHaveCount(0);
});
