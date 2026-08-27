import { resolve } from "node:path";
import { type Locator } from "@playwright/test";
import { openExtensionJourney, type ExtensionJourney } from "./helpers/extension-journey.js";
import { expect, test } from "./helpers/extension-test.js";

const screenshotOptions = {
  animations: "disabled" as const,
  stylePath: resolve("tests/e2e/visual-stability.css"),
};

async function stabilizeSurface(surface: Locator): Promise<void> {
  await surface.evaluate((element) => {
    const target = element as HTMLElement;
    target.style.boxSizing = "border-box";
    target.style.width = "348px";
  });
  await expect(surface).toHaveCSS("width", "348px");
}

const writeStatus = {
  configured: true,
  connected: true,
  scope: "container-edit",
  containerWritesEnabled: true,
  publicationScopeRequested: false,
  publicationEnabled: false,
  tokenPersistenceEnabled: true,
  analyticsReadEnabled: false,
};

async function routeConnection(journey: ExtensionJourney, name = "Lead site"): Promise<void> {
  await journey.context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(writeStatus),
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
        container: { accountId: "1", containerId: "10", name, publicId: "GTM-TEST123" },
        measurementIds: ["G-TEST123456"],
      },
    }),
  }));
}

async function approveForm(journey: ExtensionJourney): Promise<void> {
  const { root } = journey;
  await root.getByRole("button", { name: "Refresh GTM connection" }).click();
  await journey.send("Track leads from the contact form");
  await root.getByRole("button", { name: "Contact sales" }).click();
  await root.getByRole("button", { name: "Review what will be tracked" }).click();
  await root.getByRole("button", { name: "Approve setup" }).click();
}

test("conducts setup from a compact guided home", async ({ context, page }) => {
  const journey = await openExtensionJourney(context, page, "confirmed_success", "GTM-TEST123");
  await routeConnection(journey, '<img src=x onerror="window.__unsafeJourney=true">');
  await journey.root.getByRole("button", { name: "Refresh GTM connection" }).click();

  const contextCard = journey.root.getByRole("region", { name: "GTM connection" });
  await expect(contextCard).toContainText("GTM-TEST123");
  await expect(contextCard).toContainText("Edit access");
  await expect(contextCard.getByText("Agency", { exact: true })).not.toBeVisible();
  await expect(contextCard.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { __unsafeJourney?: boolean }).__unsafeJourney)).not.toBe(true);

  const journeyRail = journey.root.getByRole("navigation", { name: "Setup journey" });
  await expect(journeyRail.getByText("Define", { exact: true })).toHaveAttribute("aria-current", "step");
  await expect(journeyRail.locator("li")).toHaveCount(6);
  await expect(journey.root.getByRole("button", { name: /^Track a form$/ })).toBeVisible();
  await expect(journey.root.getByRole("button", { name: /^Track a click$/ })).toBeVisible();
  await expect(journey.root.getByRole("button", { name: /^Check automatic coverage$/ })).toBeVisible();
  await expect(journey.root.locator(".starter-actions button")).toHaveCount(3);

  await contextCard.getByRole("button", { name: "Show connection details" }).click();
  await expect(contextCard.getByText("Agency", { exact: true })).toBeVisible();
  await expect(contextCard.getByText('<img src=x onerror="window.__unsafeJourney=true">', { exact: true }))
    .toBeVisible();
});

test("queues a second conversation request without cancelling provider work", async ({ context, page }) => {
  const journey = await openExtensionJourney(context, page, "confirmed_success");
  const controls = await journey.root.evaluate((root) => {
    const shadow = root.shadowRoot!;
    const textarea = shadow.querySelector<HTMLTextAreaElement>("textarea")!;
    const send = shadow.querySelector<HTMLButtonElement>(".send")!;
    textarea.value = "Track leads from the contact form";
    send.click();
    textarea.value = "Check automatic coverage next";
    send.click();
    return {
      stopWasAvailable: !shadow.querySelector<HTMLButtonElement>(".stop-response")!.hidden,
      queueWasVisible: shadow.querySelector(".queued-prompt")?.textContent
        === "Queued · Check automatic coverage next",
    };
  });

  expect(controls).toEqual({ stopWasAvailable: true, queueWasVisible: true });
  await expect(journey.root.getByText("Check automatic coverage next", { exact: true }))
    .toBeVisible();
  await expect(journey.root.getByText("Queued · Check automatic coverage next", { exact: true }))
    .toHaveCount(0);
});

test("stopping a pending response advances its queued request", async ({ context, page }) => {
  const journey = await openExtensionJourney(context, page, "confirmed_success");
  await journey.root.evaluate((root) => {
    const shadow = root.shadowRoot!;
    const textarea = shadow.querySelector<HTMLTextAreaElement>("textarea")!;
    const send = shadow.querySelector<HTMLButtonElement>(".send")!;
    textarea.value = "Track leads from the contact form";
    send.click();
    textarea.value = "Check automatic coverage next";
    send.click();
    shadow.querySelector<HTMLButtonElement>(".stop-response")!.click();
  });

  await expect(journey.root.getByText("Response stopped. Nothing changed.", { exact: true }))
    .toBeVisible();
  await expect(journey.root.getByText("Check automatic coverage next", { exact: true }))
    .toBeVisible();
  await expect(journey.root.getByText("Queued · Check automatic coverage next", { exact: true }))
    .toHaveCount(0);
});

test("keeps short confirmations bound to the visible task", async ({ context, page }) => {
  const journey = await openExtensionJourney(context, page, "confirmed_success");
  await journey.send("Track leads from the contact form");
  await expect(journey.root.getByRole("button", { name: "Contact sales" })).toBeVisible();

  await journey.root.getByLabel("Tracking request").fill("confirm");
  await journey.root.getByRole("button", { name: "Send request" }).click();
  await expect(journey.root.getByText(/Choose one of the visible actions so I don't guess/))
    .toBeVisible();
  await expect(journey.root.getByRole("button", { name: "Contact sales" })).toBeVisible();
  const assistant = journey.root.locator("section.assistant");
  await stabilizeSurface(assistant);
  await expect(assistant).toHaveScreenshot("guided-contextual-confirmation.png", screenshotOptions);

  await journey.root.getByRole("button", { name: "Contact sales" }).click();
  const reviewAction = journey.root.getByRole("button", { name: "Review what will be tracked" });
  await expect(reviewAction).toBeVisible();
  await expect(journey.root.getByText(
    "Review the exact form, success signal, event name, and privacy boundary. Nothing will be created yet.",
    { exact: true },
  )).toBeVisible();
  await expect(journey.root.getByText("Review the grounded setup before I generate anything.", { exact: true }))
    .toHaveCount(0);
  const reviewVisibility = await journey.root.evaluate((root) => {
    const shadow = root.shadowRoot!;
    const assistantBounds = shadow.querySelector<HTMLElement>(".assistant")!.getBoundingClientRect();
    const messages = shadow.querySelector<HTMLElement>(".messages")!.getBoundingClientRect();
    const journeyRail = shadow.querySelector<HTMLElement>(".journey")!.getBoundingClientRect();
    const guidance = shadow.querySelector<HTMLElement>(".next-action-guidance")!.getBoundingClientRect();
    const action = shadow.querySelector<HTMLElement>("[data-action-id='confirm-specification']")!
      .getBoundingClientRect();
    const composerBounds = shadow.querySelector<HTMLElement>(".composer")!.getBoundingClientRect();
    const composerHit = shadow.elementFromPoint(
      composerBounds.left + composerBounds.width / 2,
      composerBounds.top + composerBounds.height / 2,
    );
    const visibleTop = Math.max(messages.top, journeyRail.bottom);
    return {
      context: guidance.top >= visibleTop
        && guidance.bottom <= messages.bottom
        && action.top >= visibleTop
        && action.bottom <= messages.bottom,
      composer: composerBounds.top >= assistantBounds.top
        && composerBounds.bottom <= assistantBounds.bottom
        && Boolean(composerHit?.closest(".composer")),
    };
  });
  expect(reviewVisibility).toEqual({ context: true, composer: true });
  await expect(assistant).toHaveScreenshot("guided-review-next-action.png", screenshotOptions);
  await journey.root.getByLabel("Tracking request").fill("continue");
  await journey.root.getByRole("button", { name: "Send request" }).click();
  await expect(journey.root.getByText("Reviewable setup", { exact: true })).toBeVisible();

  await expect(journey.root.getByRole("button", { name: "Approve setup" })).toBeVisible();
  await journey.root.getByLabel("Tracking request").fill("yes");
  await journey.root.getByRole("button", { name: "Send request" }).click();
  await expect(journey.root.getByText(/Use the visible “Approve setup” button/)).toBeVisible();
  await expect(journey.root.getByText(/Setup approved and generated/)).toHaveCount(0);
});

test("restores a reviewed plan after reload without applying it", async ({ context, page }) => {
  const journey = await openExtensionJourney(context, page, "confirmed_success", "GTM-TEST123");
  await routeConnection(journey);
  let resumeRequests = 0;
  await context.route("http://127.0.0.1:8787/api/google/workflows/plan", (route) => route.fulfill({
    status: 201,
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
            actions: [
              { kind: "trigger", action: "create", generatedName: "Trigger - successful Contact sales" },
              { kind: "tag", action: "create", generatedName: "GA4 Event - generate_lead" },
            ],
          },
        },
      },
    }),
  }));
  await context.route("http://127.0.0.1:8787/api/google/workflows/*/resume", (route) => {
    resumeRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          status: "awaiting_preview",
          nextStep: "run_tag_assistant_preview",
          preview: {
            setupFingerprint: "setup_form_contact",
            workspaceFingerprint: "workspace-final",
            previewVersionFingerprint: "preview-8",
          },
          operation: {
            id: "operation_spec_form_contact",
            status: "validated",
            validation: { status: "passed" },
          },
        },
      }),
    });
  });

  await approveForm(journey);
  await journey.root.getByRole("button", { name: "Prepare workspace & plan" }).click();
  await expect(journey.root.getByRole("navigation", { name: "Setup journey" })
    .getByText("Apply", { exact: true })).toHaveAttribute("aria-current", "step");
  await expect(journey.root.getByRole("button", { name: /View task details/ })).toBeVisible();
  await journey.root.getByRole("button", { name: /View task details/ }).click();
  await expect(journey.root.getByRole("complementary", { name: "Task artifacts" }))
    .toContainText("GA4 Event - generate_lead");
  const assistant = journey.root.locator("section.assistant");
  await stabilizeSurface(assistant);
  await expect(assistant).toHaveScreenshot(
    "guided-artifact-drawer.png",
    screenshotOptions,
  );
  await journey.root.getByRole("button", { name: "Close task artifacts" }).click();

  expect(resumeRequests).toBe(0);
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const storedJourney = await worker.evaluate(() => chrome.storage.local.get("activeJourney"));
  expect(storedJourney.activeJourney).toMatchObject({
    schemaVersion: 1,
    origin: "http://127.0.0.1:4173",
    checkpoint: "planned",
  });
  expect(JSON.stringify(storedJourney)).not.toMatch(/Track leads|private@example|cookie|identity/i);
  await page.reload();
  const root = page.locator("#gtm-observability-root");
  await expect(root).toBeAttached();
  await expect(root.getByRole("region", { name: "Continue setup" })).toContainText("Form submission tracking");
  await expect(root.getByRole("region", { name: "Continue setup" })).toContainText("Apply");
  await expect(root.locator(".starter-actions")).not.toBeVisible();
  const restoredAssistant = root.locator("section.assistant");
  await stabilizeSurface(restoredAssistant);
  await expect(restoredAssistant).toHaveScreenshot(
    "guided-resume-card.png",
    screenshotOptions,
  );
  expect(resumeRequests).toBe(0);

  await root.getByRole("button", { name: "Continue setup" }).click();
  await expect(root.getByRole("button", { name: "Apply & validate draft" })).toBeVisible();
  expect(resumeRequests).toBe(0);
  await root.getByRole("button", { name: "Apply & validate draft" }).click();
  await expect.poll(() => resumeRequests).toBe(1);
  await expect(root.getByRole("region", { name: "Exact preview binding" })).toContainText("preview-8");

  await page.goto("http://127.0.0.1:4175/");
  const otherRoot = page.locator("#gtm-observability-root");
  await expect(otherRoot).toBeAttached();
  await expect(otherRoot.getByRole("region", { name: "Continue setup" })).toHaveCount(0);
});
