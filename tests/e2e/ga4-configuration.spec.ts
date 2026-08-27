import {
  createGa4ConfigurationPlan,
  type Ga4ActionReceiptV1,
} from "@gtm-observability/core";
import { openExtensionJourney, type ExtensionJourney } from "./helpers/extension-journey.js";
import { expect, test } from "./helpers/extension-test.js";

const measurementId = "G-TEST123456";
const privatePageText = "<img src=x onerror=alert('private')>";

const plan = createGa4ConfigurationPlan({
  id: "ga4_generate_lead_configuration",
  target: {
    propertyId: "550074997",
    propertyName: "Lead site",
    measurementId,
    streamId: "15443100029",
    streamName: "Lead site web",
  },
  providerStateFingerprint: "ga4_state_before",
  actions: [
    {
      id: "dimension_form_name",
      type: "custom_dimension",
      parameterName: "form_name",
      displayName: "Form name",
      description: "Name of the submitted lead form",
      scope: "EVENT",
    },
    {
      id: "key_event_generate_lead",
      type: "key_event",
      eventName: "generate_lead",
      countingMethod: "ONCE_PER_EVENT",
    },
  ],
});

const receipts: Ga4ActionReceiptV1[] = plan.actions.map((action, index) => ({
  schemaVersion: 1,
  planId: plan.id,
  planFingerprint: plan.planFingerprint,
  actionId: action.id,
  actionType: action.type,
  propertyId: plan.target.propertyId,
  status: "created",
  resourceName: `properties/${plan.target.propertyId}/${action.type === "key_event" ? "keyEvents" : "customDimensions"}/${index + 1}`,
  providerFingerprintAfter: `ga4_state_after_${index + 1}`,
  completedAt: "2026-08-26T18:00:00.000Z",
}));

async function routeGa4Context(journey: ExtensionJourney): Promise<void> {
  await journey.context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      configured: true,
      connected: true,
      scope: "container-edit",
      containerWritesEnabled: true,
      publicationScopeRequested: false,
      publicationEnabled: false,
      tokenPersistenceEnabled: true,
      analyticsReadEnabled: true,
      analyticsWriteEnabled: true,
    }),
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
        measurementIds: [measurementId],
      },
    }),
  }));
  await journey.context.route(
    "http://127.0.0.1:8787/api/google/analytics/enhanced-measurement?*",
    (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        measurementId,
        property: { propertyId: plan.target.propertyId, name: plan.target.propertyName },
        stream: { streamId: plan.target.streamId, name: plan.target.streamName },
        settings: {
          stream: true,
          pageViews: true,
          scrolls: true,
          outboundClicks: true,
          siteSearch: true,
          videoEngagement: true,
          fileDownloads: true,
          formInteractions: true,
        },
        canEnable: true,
      }),
    }),
  );
}

async function approveLeadSetup(journey: ExtensionJourney): Promise<void> {
  await journey.page.evaluate((text) => {
    const attackerText = document.createElement("p");
    attackerText.textContent = text;
    document.body.append(attackerText);
  }, privatePageText);
  await journey.send("Track leads from the contact form");
  await journey.root.getByRole("button", { name: "Contact sales" }).click();
  await journey.root.getByRole("button", { name: "Review what will be tracked" }).click();
  await journey.root.getByRole("button", { name: "Approve setup" }).click();
}

test("reviews and explicitly applies separate GA4 configuration", async ({ context, page }) => {
  const journey = { context, page } as ExtensionJourney;
  await routeGa4Context(journey);
  const ready = await openExtensionJourney(context, page, "confirmed_success", "GTM-TEST123");
  let planBody: unknown;
  let applyBody: unknown;
  let applyRequests = 0;
  let gtmRequests = 0;
  await context.route("http://127.0.0.1:8787/api/google/workflows/**", (route) => {
    gtmRequests += 1;
    return route.abort();
  });
  await context.route("http://127.0.0.1:8787/api/google/analytics/configuration/plan", async (route) => {
    planBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(plan) });
  });
  await context.route("http://127.0.0.1:8787/api/google/analytics/configuration/apply", async (route) => {
    applyRequests += 1;
    applyBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "applied", receipts, providerStateFingerprint: "ga4_state_after_2" }),
    });
  });

  await approveLeadSetup(ready);
  await ready.root.getByRole("button", { name: "Review GA4 configuration" }).click();

  const review = ready.root.getByRole("region", { name: "GA4 configuration review" });
  await expect(review.getByText("Lead site", { exact: true })).toBeVisible();
  await expect(review.getByText("Lead site web", { exact: true })).toBeVisible();
  await expect(review.getByText("Create custom dimension Form name", { exact: true })).toBeVisible();
  await expect(review.getByText("Mark generate_lead as a key event", { exact: true })).toBeVisible();
  await expect(review.getByText(/GTM will not change/i)).toBeVisible();
  expect(applyRequests).toBe(0);
  expect(planBody).toMatchObject({
    id: "ga4_generate_lead_configuration",
    measurementId,
    actions: [
      { type: "custom_dimension", parameterName: "form_name" },
      { type: "key_event", eventName: "generate_lead" },
    ],
  });
  expect(JSON.stringify(planBody)).not.toContain(privatePageText);
  await review.scrollIntoViewIfNeeded();
  await review.screenshot({
    path: test.info().outputPath("ga4-configuration-review.png"),
    animations: "disabled",
  });

  await ready.root.getByRole("button", { name: "Approve & apply GA4 changes" }).click();

  const result = ready.root.getByRole("region", { name: "GA4 configuration result" });
  await expect(result.getByText("Created custom dimension Form name", { exact: true })).toBeVisible();
  await expect(result.getByText("Created key event generate_lead", { exact: true })).toBeVisible();
  await expect(ready.root.getByText(/GTM setup and publication remain unchanged/i)).toBeVisible();
  expect(applyRequests).toBe(1);
  expect(gtmRequests).toBe(0);
  expect(applyBody).toEqual({ plan });
  expect(JSON.stringify(applyBody)).not.toContain(privatePageText);
  await result.scrollIntoViewIfNeeded();
  await result.screenshot({
    path: test.info().outputPath("ga4-configuration-result.png"),
    animations: "disabled",
  });
});

test("keeps GA4 changes unapplied when fresh provider state rejects approval", async ({ context, page }) => {
  const journey = { context, page } as ExtensionJourney;
  await routeGa4Context(journey);
  const ready = await openExtensionJourney(context, page, "confirmed_success", "GTM-TEST123");
  await context.route("http://127.0.0.1:8787/api/google/analytics/configuration/plan", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(plan),
  }));
  await context.route("http://127.0.0.1:8787/api/google/analytics/configuration/apply", (route) => route.fulfill({
    status: 409,
    contentType: "application/json",
    body: JSON.stringify({ code: "invalid_request", error: "Provider state changed." }),
  }));

  await approveLeadSetup(ready);
  await ready.root.getByRole("button", { name: "Review GA4 configuration" }).click();
  await ready.root.getByRole("button", { name: "Approve & apply GA4 changes" }).click();

  await expect(ready.root.getByText(/GA4 configuration approval is stale or the provider state changed/i))
    .toBeVisible();
  await expect(ready.root.getByRole("region", { name: "GA4 configuration result" })).toHaveCount(0);
  await ready.root.getByRole("region", { name: "Agent task" }).screenshot({
    path: test.info().outputPath("ga4-configuration-stale.png"),
    animations: "disabled",
  });
});
