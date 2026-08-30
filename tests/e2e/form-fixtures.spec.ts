import { expect, test } from "@playwright/test";
import { formFixtureScenarios } from "../../apps/fixture-site/src/form-scenarios.js";

for (const fixture of Object.values(formFixtureScenarios)) {
  test(`replays form fixture: ${fixture.id}`, async ({ page }) => {
    const analyticsRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/g/collect") && request.url().includes("en=generate_lead")) {
        analyticsRequests.push(request.url());
      }
    });

    await page.goto(`http://127.0.0.1:14173/?formScenario=${fixture.id}`);
    await expect(page.locator("html")).toHaveAttribute("data-fixture-scenario", fixture.id);
    await expect(page.locator("html")).toHaveAttribute("data-consent", fixture.consent);
    expect(await page.evaluate(() => (window as Window & { __formFixture?: unknown }).__formFixture)).toEqual(fixture);

    if (fixture.presentation === "cross_origin_iframe") {
      await expect(page.getByTitle("External lead form")).toHaveAttribute("src", "http://127.0.0.1:4174/external-form");
      await expect(page.locator("form")).toHaveCount(0);
      return;
    }

    const form = fixture.presentation === "dynamic"
      ? page.locator("form#dynamic-contact")
      : page.locator("form#contact");
    await expect(form).toBeVisible();
    await form.locator("button[type='submit']").click();

    if (fixture.transport === "redirect" && fixture.outcomeObserved) {
      await page.waitForURL(/\/thank-you\?scenario=/);
    } else if (fixture.outcomeObserved) {
      await expect(page.locator("html")).toHaveAttribute("data-outcome-observed", "true");
    } else {
      await expect(page.locator("html")).not.toHaveAttribute("data-outcome-observed", "true");
    }

    if (fixture.transport !== "redirect") {
      const dataLayerEvents = await page.evaluate(() => (
        ((window as Window & { dataLayer?: Array<{ event?: string }> }).dataLayer ?? [])
          .filter((item) => item.event === "generate_lead").length
      ));
      expect(dataLayerEvents).toBe(fixture.dataLayerEvent ? 1 : 0);
    }
    await expect.poll(() => analyticsRequests.length).toBe(fixture.ga4RequestCount);
    if (fixture.ga4RequestCount > 0) {
      expect(analyticsRequests[0].includes("ep.form_id=")).toBe(fixture.includeRequiredParameters);
      expect(analyticsRequests[0].includes("ep.form_name=")).toBe(fixture.includeRequiredParameters);
      expect(analyticsRequests[0].includes("ep.page_location=")).toBe(fixture.includeRequiredParameters);
    }
  });
}
