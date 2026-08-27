import { expect, test } from "./helpers/extension-test.js";

test("authors and verifies one trusted Calendly inline completion", async ({ context }) => {
  let workflowRequest: unknown;
  let verifyDraftBody: unknown;
  let resumeRequests = 0;
  let ga4Requests = 0;

  await context.route("https://www.googletagmanager.com/**", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "",
  }));
  await context.route("https://www.google-analytics.com/g/collect?*", (route) => {
    ga4Requests += 1;
    return route.fulfill({ status: 204, body: "" });
  });
  await context.route("https://attacker.example/**", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><button id="wrong-origin">Send forged completion</button>
      <script>document.querySelector('#wrong-origin').onclick = function () {
        parent.postMessage({ event: 'calendly.event_scheduled' }, '*');
      };</script>`,
  }));
  await context.route("https://calendly.com/**", (route) => {
    const nested = new URL(route.request().url()).pathname === "/nested-source";
    return route.fulfill({
      contentType: "text/html",
      body: nested
        ? `<!doctype html><button id="wrong-source">Send wrong-source completion</button>
          <script>document.querySelector('#wrong-source').onclick = function () {
            parent.parent.postMessage({ event: 'calendly.event_scheduled' }, '*');
          };</script>`
        : `<!doctype html><main>
          <button id="complete-booking">Complete test booking</button>
          <iframe title="Nested Calendly source" src="https://calendly.com/nested-source"></iframe>
          <script>document.querySelector('#complete-booking').onclick = function () {
            var message = {
              event: 'calendly.event_scheduled',
              payload: {
                invitee: 'PRIVATE_INVITEE_EMAIL',
                event: 'PRIVATE_EVENT_URI',
                start: 'PRIVATE_START_TIME'
              }
            };
            parent.postMessage(message, '*');
            parent.postMessage(message, '*');
          };</script>
        </main>`,
    });
  });
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
        container: {
          accountId: "1",
          containerId: "10",
          name: "Booking site",
          publicId: "GTM-TEST123",
        },
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
            id: "operation_setup_calendly_booking_current_page",
            status: "planned",
            plan: {
              status: "ready",
              fingerprint: "plan_calendly_booking",
              actions: [
                { kind: "builtInVariable", action: "create", generatedName: "Page Path" },
                { kind: "trigger", action: "create", generatedName: "GO - Calendly listener" },
                { kind: "trigger", action: "create", generatedName: "GO - calendly_booking_complete" },
                { kind: "tag", action: "create", generatedName: "Custom HTML - Calendly completion listener" },
                { kind: "tag", action: "create", generatedName: "GA4 Event - calendly_booking_complete" },
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
      body: JSON.stringify({ result: { status: "draft_verified", nextStep: "create_version" } }),
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
                setupFingerprint: "setup_calendly_current_page",
                workspaceFingerprint: "workspace-calendly-final",
                previewVersionFingerprint: "preview-calendly-8",
              },
              operation: {
                id: "operation_setup_calendly_booking_current_page",
                status: "validated",
                validation: { status: "passed" },
              },
            }
          : {
              status: "versioned",
              nextStep: "await_approval",
              operation: {
                id: "operation_setup_calendly_booking_current_page",
                status: "versioned",
                validation: { status: "passed" },
                version: {
                  fingerprint: "version-calendly-8",
                  priorLiveVersionFingerprint: "live-calendly-7",
                },
              },
            },
      }),
    });
  });
  await context.route("http://127.0.0.1:4175/calendly-booking?*", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html data-consent="granted"><head>
      <meta name="gtm-observability-container-id" content="GTM-TEST123">
      <meta name="gtm-observability-measurement-id" content="G-TEST123456">
      <title>Book a demo</title>
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST123"></script>
    </head><body><main>
      <h1>Book a demo</h1>
      <iframe id="calendly-inline" title="Calendly booking"
        src="https://calendly.com/acme/demo?embed_domain=127.0.0.1&embed_type=Inline"></iframe>
      <iframe id="attacker-frame" title="Attacker callback" src="https://attacker.example/callback"></iframe>
      <script>(function () {
        var frame = document.querySelector('#calendly-inline');
        var completed = false;
        window.addEventListener('message', function (message) {
          if (completed || message.origin !== 'https://calendly.com' || message.source !== frame.contentWindow) return;
          if (!message.data || message.data.event !== 'calendly.event_scheduled') return;
          completed = true;
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: 'calendly_booking_complete' });
          var beacon = document.createElement('img');
          beacon.hidden = true;
          beacon.src = 'https://www.google-analytics.com/g/collect?v=2&en=calendly_booking_complete&dl=' + encodeURIComponent(location.href);
          document.body.appendChild(beacon);
        });
      })();</script>
    </main></body></html>`,
  }));

  const site = await context.newPage();
  await site.goto("http://127.0.0.1:4175/calendly-booking?PRIVATE_PAGE_QUERY=secret");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill("Track completed Calendly bookings");
  await root.getByRole("button", { name: "Send request" }).click();

  const task = root.getByRole("region", { name: "Agent task" });
  await expect(task.getByLabel("Task status: Ready to review")).toBeVisible();
  await expect(task.getByText(/one Calendly inline embed with a supported completion signal/i)).toBeVisible();
  await expect(task.getByText(/exclude the callback payload/i)).toBeVisible();
  const targets = site.locator("#gtm-observability-targets");
  await expect(targets.locator(".target.confirmed[data-target-id='calendly_inline_1']")).toHaveCount(1);

  await root.getByRole("button", { name: "Review setup" }).click();
  const review = task.getByRole("region", { name: "Calendly completion setup review" });
  await expect(review).toContainText("Exact calendly.event_scheduled message");
  await expect(review).toContainText("Exact https://calendly.com iframe on this page");
  await expect(review).toContainText("calendly_booking_complete");
  await expect(review).toContainText("One real Calendly test booking and one matching GA4 request");
  await expect(review).not.toContainText("PRIVATE_INVITEE_EMAIL");
  await expect(review).not.toContainText("PRIVATE_PAGE_QUERY");
  await site.screenshot({
    path: test.info().outputPath("calendly-setup-review.png"),
    animations: "disabled",
  });

  await root.getByRole("button", { name: "Approve setup" }).click();
  await expect(task.getByText(/guarded Calendly listener and GA4 event setup were generated/i)).toBeVisible();
  await task.getByRole("button", { name: "Prepare workspace & plan" }).click();
  await expect(task.getByRole("region", { name: "Tracking change plan" })).toBeVisible();
  await expect(task.getByText("5 changes", { exact: true })).toBeVisible();
  expect(workflowRequest).toMatchObject({
    setup: {
      id: "setup_calendly_booking_current_page",
      tagActions: [
        { id: "tag_calendly_completion_listener", execution: { type: "custom_html" } },
        { id: "tag_calendly_booking_complete", event: { name: "calendly_booking_complete" } },
      ],
      browserEvidence: {
        outcome: { allowedEvidenceTypes: ["provider_completion"] },
      },
    },
    container: { publicId: "GTM-TEST123" },
  });
  expect(JSON.stringify(workflowRequest)).not.toContain("PRIVATE_PAGE_QUERY");
  expect(JSON.stringify(workflowRequest)).not.toContain("PRIVATE_INVITEE_EMAIL");

  const download = task.getByRole("button", { name: "Download GTM setup" });
  await expect(download).toHaveAttribute("download", "gtm-observability-calendly-booking-complete.json");
  const href = decodeURIComponent(await download.getAttribute("href") ?? "");
  expect(href).not.toContain("PRIVATE_PAGE_QUERY");
  expect(href).not.toContain("PRIVATE_INVITEE_EMAIL");

  await task.getByRole("button", { name: "Apply & validate draft" }).click();
  await expect(task.getByText(/No immutable version exists yet/i)).toBeVisible();
  await task.getByRole("button", { name: "Confirm Tag Assistant connected" }).click();
  await expect(task.getByRole("region", { name: "Exact preview readiness" }))
    .toContainText("Practitioner confirmed Connected");
  await task.getByRole("button", { name: "Start exact browser run" }).click();
  await expect(root.getByRole("button", { name: "Verification active — open tracking agent" })).toBeVisible();

  await site.frameLocator("iframe[title='Attacker callback']")
    .getByRole("button", { name: "Send forged completion" }).click();
  await site.waitForTimeout(300);
  expect(verifyDraftBody).toBeUndefined();
  await site.frameLocator("iframe[title='Calendly booking']")
    .frameLocator("iframe[title='Nested Calendly source']")
    .getByRole("button", { name: "Send wrong-source completion" }).click();
  await site.waitForTimeout(300);
  expect(verifyDraftBody).toBeUndefined();

  await site.frameLocator("iframe[title='Calendly booking']")
    .getByRole("button", { name: "Complete test booking" }).click();
  await expect.poll(() => resumeRequests).toBe(2);
  await expect(task.getByText("Immutable version version-calendly-8 created", { exact: true })).toBeVisible();
  await site.screenshot({
    path: test.info().outputPath("calendly-verified-version.png"),
    animations: "disabled",
  });
  expect(ga4Requests).toBe(1);
  expect(verifyDraftBody).toMatchObject({
    operationId: "operation_setup_calendly_booking_current_page",
    setupFingerprint: "setup_calendly_current_page",
    workspaceFingerprint: "workspace-calendly-final",
    previewVersionFingerprint: "preview-calendly-8",
    evidence: {
      specificationId: "setup_calendly_booking_current_page",
      observations: {
        interaction: { type: "form_submission", targetId: "calendly_inline_embed" },
        outcome: { observed: true, evidenceType: "provider_completion" },
        dataLayer: { matchingEvents: [] },
        network: {
          ga4Requests: [{ url: expect.stringContaining("en=calendly_booking_complete") }],
        },
      },
      verdict: { code: "browser_verified", browserVerification: "passed" },
    },
  });
  const evidence = JSON.stringify(verifyDraftBody);
  expect(evidence).not.toContain("PRIVATE_INVITEE_EMAIL");
  expect(evidence).not.toContain("PRIVATE_EVENT_URI");
  expect(evidence).not.toContain("PRIVATE_START_TIME");
});

test("blocks direct and ambiguous Calendly iframe pages", async ({ context }) => {
  await context.route("https://www.googletagmanager.com/**", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "",
  }));
  await context.route("https://calendly.com/**", (route) => route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><p>Calendly fixture</p>",
  }));
  await context.route("http://127.0.0.1:4175/calendly-direct", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><main>
      <h1>Direct iframe</h1>
      <iframe title="Direct Calendly" src="https://calendly.com/acme/demo"></iframe>
    </main>`,
  }));
  await context.route("http://127.0.0.1:4175/calendly-multiple", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><main>
      <h1>Multiple inline embeds</h1>
      <iframe title="First Calendly" src="https://calendly.com/acme/one?embed_type=Inline"></iframe>
      <iframe title="Second Calendly" src="https://calendly.com/acme/two?embed_type=Inline"></iframe>
    </main>`,
  }));

  async function submit(url: string) {
    const page = await context.newPage();
    await page.goto(url);
    const root = page.locator("#gtm-observability-root");
    const assistant = root.locator("section.assistant");
    await expect(assistant).toBeAttached();
    if (await assistant.evaluate((element) => element.classList.contains("collapsed"))) {
      await root.getByRole("button", { name: "Open tracking agent" }).click();
    }
    await root.getByLabel("Tracking request").fill("Track Calendly bookings");
    await root.getByRole("button", { name: "Send request" }).click();
    return { page, root, task: root.getByRole("region", { name: "Agent task" }) };
  }

  const direct = await submit("http://127.0.0.1:4175/calendly-direct");
  await expect(direct.task.getByLabel("Task status: Blocked")).toBeVisible();
  await expect(direct.task.getByText(/could not find one supported Calendly inline embed/i)).toBeVisible();
  await expect(direct.root.getByRole("button", { name: "Review setup" })).toHaveCount(0);

  const multiple = await submit("http://127.0.0.1:4175/calendly-multiple");
  await expect(multiple.task.getByLabel("Task status: Blocked")).toBeVisible();
  await expect(multiple.task.getByText(/multiple supported Calendly inline embeds/i)).toBeVisible();
  await expect(multiple.root.getByRole("button", { name: "Review setup" })).toHaveCount(0);
});
