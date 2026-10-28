import type { BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "./helpers/extension-test.js";

function acceptanceMessage(id: string): string {
  const contract = JSON.parse(readFileSync(
    resolve("tests/acceptance/conversation-intake.json"),
    "utf8",
  )) as { cases: Array<{ id: string; message: string }> };
  const item = contract.cases.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Missing conversation acceptance case: ${id}`);
  }

  return item.message;
}

async function routeGoogleContext(context: BrowserContext): Promise<void> {
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
        container: {
          accountId: "1",
          containerId: "10",
          name: "Contact site",
          publicId: "GTM-TEST123",
        },
        measurementIds: ["G-TEST123456"],
      },
    }),
  }));
}

function pageBody(emailLink: boolean): string {
  const email = emailLink
    ? `<a id="email" href="mailto:private@example.test?subject=attacker-sentinel&amp;body=%3Cscript%3Eprivate%3C%2Fscript%3E">
        Email &lt;script&gt;attacker-sentinel&lt;/script&gt;
      </a>`
    : "<p>Contact details are provided after signup.</p>";
  return `<!doctype html>
    <html><head>
      <title>Contact</title>
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST123"></script>
    </head><body><main>
      <h1>Contact</h1>
      <a href="/pricing">Pricing</a>
      ${email}
    </main></body></html>`;
}

test("authors a privacy-safe email-link setup through the shared workflow", async ({ context }) => {
  await routeGoogleContext(context);
  let workflowRequest: unknown;
  await context.route("http://127.0.0.1:8787/api/google/workflows/plan", async (route) => {
    workflowRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          status: "planned",
          operation: {
            id: "operation_setup_email_click_current_page",
            status: "planned",
            plan: {
              status: "ready",
              fingerprint: "plan_email_click",
              actions: [
                { kind: "builtInVariable", action: "create", generatedName: "Click URL" },
                { kind: "trigger", action: "create", generatedName: "GO - email_click" },
                { kind: "tag", action: "create", generatedName: "GA4 Event - email_click" },
              ],
            },
          },
        },
      }),
    });
  });
  await context.route("http://127.0.0.1:4175/email-links", (route) => route.fulfill({
    contentType: "text/html",
    body: pageBody(true),
  }));

  const site = await context.newPage();
  await site.goto("http://127.0.0.1:4175/email-links");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill(acceptanceMessage("email-evidence-requires-scope"));
  await root.getByRole("button", { name: "Send request" }).click();

  const task = root.getByRole("region", { name: "Agent task" }).last();
  await expect(task.getByText(/I found 1 email link/i)).toBeVisible();
  await task.getByRole("button", { name: "Only on this page" }).click();
  await task.getByRole("button", { name: "Review setup" }).click();
  await site.evaluate(() => new Promise<void>((resolveFrame) => {
    requestAnimationFrame(() => resolveFrame());
  }));
  const reviewPosition = await task.locator(".agent-turn-heading").evaluate((heading) => {
    const messages = heading.closest<HTMLElement>(".messages")!;
    const headingBounds = heading.getBoundingClientRect();
    const messageBounds = messages.getBoundingClientRect();
    return {
      headingTop: headingBounds.top,
      headingBottom: headingBounds.bottom,
      viewportTop: messageBounds.top,
      viewportBottom: messageBounds.bottom,
    };
  });
  expect(reviewPosition.headingTop).toBeGreaterThanOrEqual(reviewPosition.viewportTop);
  expect(reviewPosition.headingBottom).toBeLessThanOrEqual(reviewPosition.viewportBottom);
  await expect(task.getByText("Email-link click", { exact: true })).toBeVisible();
  await expect(task.getByText(/Excluded: email_address/i)).toBeVisible();
  await expect(task.getByText(/subject\/body values/i).first()).toBeVisible();
  await expect(task).not.toContainText("private@example.test");
  await expect(task).not.toContainText("attacker-sentinel");
  const approve = task.getByRole("button", { name: "Approve setup" });
  await approve.scrollIntoViewIfNeeded();
  await expect(approve).toBeVisible();
  await approve.click();

  const download = task.getByRole("button", { name: "Download GTM setup" });
  await expect(download).toHaveAttribute("download", "gtm-observability-email-click.json");
  const href = decodeURIComponent(await download.getAttribute("href") ?? "");
  expect(href).toContain("email_click");
  expect(href).not.toContain("private@example.test");
  expect(href).not.toContain("attacker-sentinel");

  await task.getByRole("button", { name: "Prepare workspace & plan" }).click();
  await expect(task.getByRole("region", { name: "Tracking change plan" })).toBeVisible();
  expect(workflowRequest).toMatchObject({
    setup: {
      id: "setup_email_click_current_page",
      tagActions: [{ event: { name: "email_click", parameters: [] } }],
    },
    container: { publicId: "GTM-TEST123" },
  });
  expect(JSON.stringify(workflowRequest)).not.toContain("private@example.test");
  expect(JSON.stringify(workflowRequest)).not.toContain("attacker-sentinel");
});

test("blocks email-link setup when the page has no observable mailto link", async ({ context }) => {
  await routeGoogleContext(context);
  await context.route("http://127.0.0.1:4175/email-links", (route) => route.fulfill({
    contentType: "text/html",
    body: pageBody(false),
  }));

  const site = await context.newPage();
  await site.goto("http://127.0.0.1:4175/email-links");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill(acceptanceMessage("email-without-page-evidence-is-blocked"));
  await root.getByRole("button", { name: "Send request" }).click();

  const task = root.getByRole("region", { name: "Agent task" }).last();
  await expect(task.getByLabel("Task status: Blocked")).toBeVisible();
  await expect(task.getByText("I could not find an observable email link on this page. No setup was generated.", { exact: true })).toBeVisible();
  await expect(task.getByRole("button", { name: /scope|review|approve|prepare|download/i })).toHaveCount(0);
});
