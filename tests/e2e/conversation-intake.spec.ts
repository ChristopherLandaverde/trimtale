import { type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "./helpers/extension-test.js";

interface IntakeCase {
  id: string;
  message: string;
}

const visualStabilityStylePath = resolve("tests/e2e/visual-stability.css");
const visualStabilityCss = readFileSync(visualStabilityStylePath, "utf8");

const screenshotOptions = {
  animations: "disabled" as const,
  stylePath: visualStabilityStylePath,
};

async function stabilizeShadowRoot(host: Locator): Promise<void> {
  await host.evaluate((element, css) => {
    const shadow = element.shadowRoot;
    if (!shadow) {
      throw new Error("Expected an open shadow root for visual normalization");
    }
    const style = document.createElement("style");
    style.dataset.visualStability = "true";
    style.textContent = css;
    shadow.append(style);
  }, visualStabilityCss);
}

async function setAssistantVisibility(
  host: Locator,
  visibility: "hidden" | "visible",
): Promise<void> {
  await host.locator(".assistant").evaluate((element, value) => {
    (element as HTMLElement).style.visibility = value;
  }, visibility);
}

function acceptanceCase(id: string): IntakeCase {
  const contract = JSON.parse(readFileSync(
    resolve("tests/acceptance/conversation-intake.json"),
    "utf8",
  )) as { cases: IntakeCase[] };
  const item = contract.cases.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Missing conversation acceptance case: ${id}`);
  }
  return item;
}

test("clarifies a form intent and requires explicit specification confirmation", async ({ page: site }) => {
  await site.goto("http://127.0.0.1:4173/");
  await site.addStyleTag({ content: visualStabilityCss });
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();

  const ambiguous = acceptanceCase("ambiguous-form-requires-target");
  await root.getByLabel("Tracking request").fill(ambiguous.message);
  await root.getByRole("button", { name: "Send request" }).click();
  const task = root.getByRole("region", { name: "Agent task" });
  await expect(task).toHaveCount(1);
  await expect(task.getByText("Set up lead-form tracking", { exact: true })).toBeVisible();
  await expect(task.getByText("I found two forms and need you to choose which one represents a qualified inquiry.", { exact: true })).toBeVisible();
  await expect(task.getByRole("list", { name: "Task plan" }).getByText("Confirm measurement scope", { exact: true })).toBeVisible();
  await expect(task.getByText("2 forms · 5 navigation links", { exact: true })).toBeVisible();
  await expect(root.getByRole("button", { name: "Contact sales" })).toBeVisible();
  await expect(root.getByRole("button", { name: "Newsletter signup" })).toBeVisible();
  const targets = site.locator("#gtm-observability-targets");
  await expect(targets.locator(".target.candidate")).toHaveCount(2);
  await expect(targets.locator(".target.candidate[data-target-id='contact']")).toHaveCount(1);
  await expect(targets.locator(".target.candidate[data-target-id='newsletter']")).toHaveCount(1);
  await stabilizeShadowRoot(targets);
  await expect(targets.locator(".target span").first()).toHaveCSS("font-family", /Arial/);
  await setAssistantVisibility(root, "hidden");
  await expect(site).toHaveScreenshot("form-candidate-highlights.png", screenshotOptions);
  await setAssistantVisibility(root, "visible");
  await expect(root.getByRole("button", { name: "Approve setup" })).toHaveCount(0);

  await root.getByRole("button", { name: "Contact sales" }).click();
  await expect(task).toHaveCount(1);
  await expect(targets.locator(".target.candidate")).toHaveCount(0);
  await expect(targets.locator(".target.confirmed[data-target-id='contact']")).toHaveCount(1);
  await setAssistantVisibility(root, "hidden");
  await expect(site).toHaveScreenshot("form-confirmed-highlight.png", screenshotOptions);
  await setAssistantVisibility(root, "visible");
  await expect(root.getByText(/successful Contact sales submissions as generate_lead/)).toBeVisible();
  await expect(root.getByText(/without counting submit attempts or validation errors/)).toBeVisible();
  await root.getByRole("button", { name: "Review setup" }).click();
  await expect(task).toHaveCount(1);
  await expect(task.getByText("Reviewable setup", { exact: true })).toBeVisible();
  await expect(task.getByText("Qualified inquiry", { exact: true })).toBeVisible();
  await expect(task.getByText("Success message", { exact: true })).toBeVisible();
  await root.getByRole("button", { name: "Approve setup" }).click();
  await expect(root.getByText(/Setup approved and generated/)).toBeVisible();
});

test("uses one adjacent stable status as form success evidence and rejects ambiguity", async ({ context }) => {
  await context.route("https://www.googletagmanager.com/**", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "",
  }));
  await context.route("http://127.0.0.1:4175/ambiguous-status", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><main><section>
      <form id="ambiguous-form" aria-label="Ambiguous lead form"><button type="submit">Send</button></form>
      <p id="first-status" role="status" hidden>First outcome</p>
      <p id="second-status" aria-live="polite" hidden>Second outcome</p>
    </section></main>`,
  }));
  await context.route("http://127.0.0.1:4175/unaddressable-status", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><main><section>
      <form id="unaddressable-form" aria-label="Unaddressable lead form"><button type="submit">Send</button></form>
      <p role="status" hidden>Outcome without a stable identifier</p>
    </section></main>`,
  }));

  async function submitIntent(url: string) {
    const page = await context.newPage();
    await page.goto(url);
    const root = page.locator("#gtm-observability-root");
    const assistant = root.locator("section.assistant");
    await expect(assistant).toBeAttached();
    if (await assistant.evaluate((element) => element.classList.contains("collapsed"))) {
      await root.getByRole("button", { name: "Open tracking agent" }).click();
    }
    await root.getByLabel("Tracking request").fill("Track successful submissions of this form");
    await root.getByRole("button", { name: "Send request" }).click();
    return { page, root };
  }

  const discovered = await submitIntent("http://127.0.0.1:4175/");
  await expect(discovered.root.getByText(
    /successful Disposable workflow smoke form submissions as generate_lead/,
  )).toBeVisible();
  const discoveredTargets = discovered.page.locator("#gtm-observability-targets");
  await expect(discoveredTargets.locator(
    ".target.confirmed[data-target-id='workflow-smoke-form']",
  )).toHaveCount(1);
  await expect(discoveredTargets.locator(".target.confirmed span"))
    .toHaveText("✓ Disposable workflow smoke form");
  await expect(discovered.root.getByRole("button", { name: "Review setup" })).toBeVisible();
  await expect(discovered.root.getByText(/diagnostic handoff/i)).toHaveCount(0);

  const ambiguous = await submitIntent("http://127.0.0.1:4175/ambiguous-status");
  await expect(ambiguous.root.getByText(/not a safe observable signal that proves it succeeded/i)).toBeVisible();
  await expect(ambiguous.root.getByRole("button", { name: "Review setup" })).toHaveCount(0);

  const unaddressable = await submitIntent("http://127.0.0.1:4175/unaddressable-status");
  await expect(unaddressable.root.getByText(/not a safe observable signal that proves it succeeded/i)).toBeVisible();
  await expect(unaddressable.root.getByRole("button", { name: "Review setup" })).toHaveCount(0);
});

test("blocks a phone request without observable phone-link evidence", async ({ page: site }) => {
  await site.goto("http://127.0.0.1:4173/");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill("Track phone calls");
  await root.getByRole("button", { name: "Send request" }).click();

  const task = root.getByRole("region", { name: "Agent task" });
  await expect(task).toHaveCount(1);
  await expect(task.getByLabel("Task status: Blocked")).toBeVisible();
  await expect(task.getByText(/could not find an observable phone link/i)).toBeVisible();
  await expect(root.getByRole("button", { name: "Approve setup" })).toHaveCount(0);
  await expect(root.getByLabel("Tracking request")).toBeEnabled();
});

test("authors and reviews a privacy-safe phone-click setup through chat", async ({ context }) => {
  let workflowRequest: unknown;
  let verifyDraftBody: unknown;
  let resumeRequests = 0;
  await context.route("https://www.googletagmanager.com/**", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "",
  }));
  await context.route("https://www.google-analytics.com/g/collect?*", (route) => route.fulfill({
    status: 204,
    body: "",
  }));
  await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
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
      analyticsReadEnabled: false,
    }),
  }));
  await context.route("http://127.0.0.1:8787/api/google/containers/recognize?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      containerWritesEnabled: true,
      result: {
        status: "recognized",
        publicId: "GTM-TEST123",
        account: { accountId: "1", name: "Agency" },
        container: { accountId: "1", containerId: "10", name: "Contact site", publicId: "GTM-TEST123" },
        measurementIds: ["G-TEST123456"],
      },
    }),
  }));
  await context.route("http://127.0.0.1:8787/api/google/workflows/plan", async (route) => {
    workflowRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          status: "planned",
          operation: {
            id: "operation_setup_phone_click_current_page",
            status: "planned",
            plan: {
              status: "ready",
              fingerprint: "plan_phone_click",
              actions: [
                { kind: "builtInVariable", action: "create", generatedName: "Click URL" },
                { kind: "builtInVariable", action: "create", generatedName: "Page Path" },
                { kind: "trigger", action: "create", generatedName: "GO - phone_click" },
                { kind: "tag", action: "create", generatedName: "GA4 Event - phone_click" },
              ],
            },
          },
        },
      }),
    });
  });
  await context.route("http://127.0.0.1:8787/api/google/workflows/*/verify-draft", async (route) => {
    verifyDraftBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: { status: "draft_verified", nextStep: "create_version" },
      }),
    });
  });
  await context.route("http://127.0.0.1:8787/api/google/workflows/*/resume", async (route) => {
    resumeRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: resumeRequests === 1
          ? {
              status: "awaiting_preview",
              nextStep: "run_tag_assistant_preview",
              preview: {
                setupFingerprint: "setup_phone_current_page",
                workspaceFingerprint: "workspace-phone-final",
                previewVersionFingerprint: "preview-phone-8",
              },
              operation: {
                id: "operation_setup_phone_click_current_page",
                status: "validated",
                validation: { status: "passed" },
              },
            }
          : {
              status: "versioned",
              nextStep: "await_approval",
              operation: {
                id: "operation_setup_phone_click_current_page",
                status: "versioned",
                validation: { status: "passed" },
                version: {
                  fingerprint: "version-phone-8",
                  priorLiveVersionFingerprint: "live-phone-7",
                },
              },
            },
      }),
    });
  });
  await context.route("http://127.0.0.1:4175/phone-links", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html>
      <html><head>
        <meta name="gtm-observability-container-id" content="GTM-TEST123">
        <meta name="gtm-observability-measurement-id" content="G-TEST123456">
        <title>Contact</title>
        <script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST123"></script>
        <script>document.addEventListener('click', function (event) {
          var link = event.target.closest('a[href^="tel:"]');
          if (!link) return;
          event.preventDefault();
          var beacon = document.createElement('img');
          beacon.hidden = true;
          beacon.src = 'https://www.google-analytics.com/g/collect?v=2&en=phone_click';
          document.body.appendChild(beacon);
        });</script>
      </head><body><main>
        <h1>Contact us</h1>
        <a href="tel:+12125550123">+1 (212) 555-0123</a>
        <a href="/pricing">Pricing</a>
      </main></body></html>`,
  }));
  const site = await context.newPage();
  await site.goto("http://127.0.0.1:4175/phone-links");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill("Track phone calls");
  await root.getByRole("button", { name: "Send request" }).click();

  const task = root.getByRole("region", { name: "Agent task" });
  await expect(task.getByLabel("Task status: Needs input")).toBeVisible();
  await expect(task.getByText(/1 phone link/).first()).toBeVisible();
  await expect(task.getByText(/can cover matching phone links sitewide or only this page/i)).toBeVisible();
  await root.getByRole("button", { name: "Only on this page" }).click();

  await expect(task.getByLabel("Task status: Ready to review")).toBeVisible();
  await expect(task.getByText(/Phone number, tel URL, and visible link text are excluded from GA4/i)).toBeVisible();
  await root.getByRole("button", { name: "Review setup" }).click();
  await expect(task.getByText("Reviewable setup", { exact: true })).toBeVisible();
  await expect(task.getByText("Only this page", { exact: true })).toBeVisible();
  await expect(task.getByText("Requires analytics_storage", { exact: true })).toBeVisible();
  await expect(task.getByText(/Excluded: phone_number/i)).toBeVisible();
  await expect(task.getByText(/Automatic: page_location/i)).toBeVisible();
  await expect(task).not.toContainText("+12125550123");
  await expect(task).not.toContainText("+1 (212) 555-0123");

  await root.getByRole("button", { name: "Approve setup" }).click();
  await expect(task.getByText(/privacy-safe phone_click setup was generated/i)).toBeVisible();
  await task.getByRole("button", { name: "Prepare workspace & plan" }).click();
  await expect(task.getByRole("region", { name: "Tracking change plan" })).toBeVisible();
  await expect(task.getByText("4 changes", { exact: true })).toBeVisible();
  expect(workflowRequest).toMatchObject({
    setup: {
      id: "setup_phone_click_current_page",
      tagActions: [{ event: { name: "phone_click", parameters: [] } }],
    },
    container: { publicId: "GTM-TEST123" },
  });
  expect(JSON.stringify(workflowRequest)).not.toContain("+12125550123");
  const download = task.getByRole("button", { name: "Download GTM setup" });
  await expect(download).toHaveAttribute("download", "gtm-observability-phone-click.json");
  const href = await download.getAttribute("href");
  expect(decodeURIComponent(href ?? "")).not.toContain("+12125550123");

  await task.getByRole("button", { name: "Apply & validate draft" }).click();
  await task.getByRole("button", { name: "Confirm apply & validate" }).click();
  await expect(task.getByText(/No immutable version exists yet/i)).toBeVisible();
  await expect(task.getByRole("button", { name: "Start exact browser run" })).toHaveCount(0);
  const exactTarget = site.url();
  await site.evaluate(() => history.pushState({}, "", "/phone-preview-target-drift"));
  await task.getByRole("button", { name: "Confirm Tag Assistant connected" }).click();
  await expect(task.getByRole("region", { name: "Exact preview readiness" }))
    .toContainText("Current page does not match the confirmed target");
  expect(resumeRequests).toBe(1);
  await site.evaluate((url) => history.replaceState({}, "", url), exactTarget);
  await task.getByRole("button", { name: "Recheck Preview readiness" }).click();
  await task.getByRole("button", { name: "Confirm Tag Assistant connected" }).click();
  await expect(task.getByRole("region", { name: "Exact preview readiness" }))
    .toContainText("Practitioner confirmed Connected");
  await task.getByRole("button", { name: "Start exact browser run" }).click();
  await site.locator("a[href^='tel:']").click();
  await expect.poll(() => resumeRequests).toBe(2);
  await expect(task.getByText("Immutable version version-phone-8 created", { exact: true })).toBeVisible();
  expect(verifyDraftBody).toMatchObject({
    operationId: "operation_setup_phone_click_current_page",
    setupFingerprint: "setup_phone_current_page",
    workspaceFingerprint: "workspace-phone-final",
    previewVersionFingerprint: "preview-phone-8",
    evidence: {
      specificationId: "setup_phone_click_current_page",
      observations: {
        interaction: { type: "phone_click" },
        network: { ga4Requests: [{ url: expect.stringContaining("en=phone_click") }] },
      },
      verdict: { code: "browser_verified", browserVerification: "passed" },
    },
  });
  expect(JSON.stringify(verifyDraftBody)).not.toContain("+12125550123");
});

test("reviews a model-authored event and sends it through durable planning", async ({ context }) => {
  let authoringBody: unknown;
  let workflowBody: unknown;
  let ga4ConfigurationRequests = 0;
  await context.route("https://www.googletagmanager.com/**", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "",
  }));
  await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
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
      analyticsReadEnabled: false,
    }),
  }));
  await context.route("http://127.0.0.1:8787/api/google/containers/recognize?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      containerWritesEnabled: true,
      result: {
        status: "recognized",
        publicId: "GTM-TEST123",
        account: { accountId: "1", name: "Agency" },
        container: { accountId: "1", containerId: "10", name: "Contact site", publicId: "GTM-TEST123" },
        measurementIds: ["G-TEST123456"],
      },
    }),
  }));
  await context.route("http://127.0.0.1:8787/api/setup-authoring", async (route) => {
    authoringBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          schemaVersion: 1,
          providerId: "configured-model",
          proposal: {
            status: "ready",
            eventName: "contact_intent",
            rationale: "Use a business-facing event name for confirmed phone-link clicks.",
          },
          suggestions: [
            {
              name: "phone_number",
              classification: "prohibited",
              requirement: "optional",
              valueCandidateId: null,
              rationale: "Do not send phone numbers to Analytics.",
            },
            {
              name: "lead_score",
              classification: "requires_custom_definition",
              requirement: "optional",
              valueCandidateId: null,
              rationale: "Register this numeric parameter as an event-scoped GA4 custom metric only after a numeric source is grounded.",
            },
          ],
          setup: {
            schemaVersion: 1,
            id: "setup_authored_contact_intent",
            status: "draft",
            intent: { statement: "Track phone calls", businessOutcome: "Measure call intent" },
            tagActions: [{
              id: "tag_contact_intent",
              name: "GA4 Event - contact_intent",
              execution: { type: "template", templateId: "google.analytics.ga4_event", fields: [] },
              destination: { type: "ga4", measurementId: "G-TEST123456" },
              event: { name: "contact_intent", parameters: [] },
              firingPolicyIds: ["policy_phone_click_current_page"],
            }],
            firingPolicies: [{
              id: "policy_phone_click_current_page",
              source: { type: "click", clickMode: "links", selector: "a[href^='tel:']" },
              include: [],
              exclude: [],
              frequency: "once_per_event",
              consent: { required: ["analytics_storage"], whenDenied: "block" },
            }],
            verification: {
              positive: [{ type: "network_request", destination: "google_analytics_4", eventName: "contact_intent" }],
              negative: [{ type: "tag_fired", tagActionId: "tag_contact_intent", scenario: "ordinary_link" }],
            },
          },
          usage: { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 },
        },
      }),
    });
  });
  await context.route("http://127.0.0.1:8787/api/google/workflows/plan", async (route) => {
    workflowBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          status: "planned",
          operation: {
            id: "operation_setup_authored_contact_intent",
            status: "planned",
            plan: {
              status: "ready",
              fingerprint: "plan_contact_intent",
              actions: [{ kind: "tag", action: "create", generatedName: "GA4 Event - contact_intent" }],
            },
          },
        },
      }),
    });
  });
  await context.route("http://127.0.0.1:8787/api/google/analytics/configuration/**", (route) => {
    ga4ConfigurationRequests += 1;
    return route.abort();
  });
  await context.route("http://127.0.0.1:4175/model-phone-links", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html><head>
      <meta name="gtm-observability-container-id" content="GTM-TEST123">
      <meta name="gtm-observability-measurement-id" content="G-TEST123456">
      <title>Contact</title><script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST123"></script>
      </head><body><main>
      <a href="tel:+12125550123">&lt;img src=x onerror=alert(1)&gt; +1 (212) 555-0123</a><a href="/pricing">Pricing</a>
      </main></body></html>`,
  }));

  const site = await context.newPage();
  await site.goto("http://127.0.0.1:4175/model-phone-links");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill("Track phone calls");
  await root.getByRole("button", { name: "Send request" }).click();
  await root.getByRole("button", { name: "Only on this page" }).click();
  await root.getByRole("button", { name: "Review setup" }).click();
  await root.getByRole("button", { name: "Ask model for alternative" }).click();

  const task = root.getByRole("region", { name: "Agent task" });
  await expect(task.getByText("contact_intent", { exact: true })).toBeVisible();
  await expect(task.getByText(/Prohibited.*phone_number/i)).toBeVisible();
  await expect(task.getByText(
    /GA4 custom definition.*lead_score.*event-scoped GA4 custom metric.*numeric source is grounded/i,
  )).toBeVisible();
  expect(JSON.stringify(authoringBody)).not.toContain("+12125550123");
  expect(JSON.stringify(authoringBody)).not.toContain("<img src=x onerror=alert(1)>");
  const modelReview = task.getByRole("region", { name: "Model-authored setup review" });
  await modelReview.scrollIntoViewIfNeeded();
  await expect(modelReview).toBeInViewport();
  await task.screenshot({
    path: test.info().outputPath("model-authored-setup-review.png"),
    animations: "disabled",
  });
  await root.getByRole("button", { name: "Approve model-authored setup" }).click();
  await root.getByRole("button", { name: "Prepare workspace & plan" }).click();

  await expect.poll(() => workflowBody).toBeTruthy();
  expect(workflowBody).toMatchObject({
    setup: {
      id: "setup_authored_contact_intent",
      status: "confirmed",
      tagActions: [{ event: { name: "contact_intent" } }],
    },
    container: { publicId: "GTM-TEST123" },
  });
  expect(JSON.stringify(workflowBody)).not.toContain("lead_score");
  expect(ga4ConfigurationRequests).toBe(0);
  expect(JSON.stringify(workflowBody)).not.toContain("+12125550123");
  expect(JSON.stringify(workflowBody)).not.toContain("<img src=x onerror=alert(1)>");
});
