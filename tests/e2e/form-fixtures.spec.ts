import { expect, test } from "@playwright/test";
import { formFixtureScenarios } from "../../apps/fixture-site/src/form-scenarios.js";

// Replays each fixture scenario without the extension and checks that the page itself
// produces the real browser behavior the scenario describes. The page sets no verdict
// flags; the extension must observe the same behavior on its own.
for (const fixture of Object.values(formFixtureScenarios)) {
  test(`replays form fixture: ${fixture.id}`, async ({ page }) => {
    const deliveredRequests: string[] = [];
    const failedRequests: string[] = [];
    page.on("requestfinished", (request) => {
      if (request.url().includes("/g/collect") && request.url().includes("en=generate_lead")) deliveredRequests.push(request.url());
    });
    page.on("requestfailed", (request) => {
      if (request.url().includes("/g/collect") && request.url().includes("en=generate_lead")) failedRequests.push(request.url());
    });

    await page.goto(`http://127.0.0.1:14173/?formScenario=${fixture.id}`);
    expect(await page.evaluate(() => document.documentElement.getAttributeNames().filter((name) => name.startsWith("data-")))).toEqual([]);
    expect(await page.evaluate(() => (window as Window & { __formFixture?: unknown }).__formFixture)).toEqual(fixture);

    if (fixture.presentation === "cross_origin_iframe") {
      await expect(page.getByTitle("External lead form")).toHaveAttribute("src", "http://127.0.0.1:4174/external-form");
      await expect(page.locator("form")).toHaveCount(0);
      return;
    }

    const consentCommands = await page.evaluate(() => (((window as Window & { dataLayer?: unknown[] }).dataLayer ?? [])
      .filter((item) => Object.prototype.toString.call(item) === "[object Arguments]" && (item as IArguments)[0] === "consent").length));
    expect(consentCommands).toBe(fixture.consent === "unknown" ? 0 : 1);

    const form = fixture.presentation === "dynamic"
      ? page.locator("form#dynamic-contact")
      : fixture.presentation === "embedded"
        ? page.locator("form[aria-label='Request a demo']")
        : page.locator("form#contact");
    await expect(form).toBeVisible();
    if (fixture.validation !== "html5") await form.locator("input[type='email']").fill("lead@example.com");
    await form.locator("button[type='submit']").click();

    if (fixture.validation === "html5") {
      expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(false);
    } else if (fixture.validation === "script") {
      await expect(form.locator("input[type='email']")).toHaveAttribute("aria-invalid", "true");
    } else if (fixture.transport === "redirect" && fixture.outcomeObserved) {
      await page.waitForURL(/\/thank-you\?formScenario=/);
    } else if (fixture.outcomeObserved) {
      await expect(page.getByRole("status").filter({ hasText: "Thanks" })).toBeVisible();
    } else {
      await page.waitForTimeout(300);
      await expect(page.getByRole("status").filter({ hasText: "Thanks" })).toHaveCount(0);
    }
    if (fixture.submissionResult === "server_error") await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toBeVisible();

    const leadEvents = () => page.evaluate(() => (
      ((window as Window & { dataLayer?: Array<{ event?: string }> }).dataLayer ?? [])
        .filter((item) => item && (item as { event?: string }).event === "generate_lead").length
    ));
    await expect.poll(leadEvents).toBe(fixture.dataLayerEvent ? 1 : 0);
    await expect.poll(() => deliveredRequests.length).toBe(fixture.ga4RequestCount);
    if (fixture.tagFired && fixture.ga4RequestCount === 0) await expect.poll(() => failedRequests.length).toBe(1);
    if (fixture.ga4RequestCount > 0) {
      expect(deliveredRequests[0]!.includes("ep.form_id=")).toBe(fixture.includeRequiredParameters);
      expect(deliveredRequests[0]!.includes("ep.form_name=")).toBe(fixture.includeRequiredParameters);
      expect(deliveredRequests[0]!.includes("ep.page_location=")).toBe(fixture.includeRequiredParameters);
    }
  });
}
