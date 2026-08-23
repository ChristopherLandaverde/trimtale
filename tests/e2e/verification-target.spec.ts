import { expect, test } from "@playwright/test";

test("the disposable smoke form signals only a valid successful outcome", async ({ page }) => {
  await page.route("https://www.googletagmanager.com/**", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "",
  }));
  await page.goto("http://127.0.0.1:4175/");

  const form = page.locator("#workflow-smoke-form");
  const success = page.locator("#workflow-smoke-success");
  const submit = form.getByRole("button", { name: "Request verification" });

  await expect(form).toHaveAttribute("aria-label", "Disposable workflow smoke form");
  await expect(success).toBeHidden();

  await submit.click();
  await expect(success).toBeHidden();
  expect(await page.evaluate(() => (
    (window as typeof window & { dataLayer?: unknown[] }).dataLayer ?? []
  ).filter((item) => (
    typeof item === "object" && item !== null
      && (item as { event?: string }).event === "gtm_observability_smoke_success"
  )))).toEqual([]);

  await form.getByLabel("Work email").fill("private-sentinel@example.com");
  await submit.click();
  await expect(success).toBeVisible();

  const signals = await page.evaluate(() => (
    (window as typeof window & { dataLayer?: unknown[] }).dataLayer ?? []
  ).filter((item) => (
    typeof item === "object" && item !== null
      && (item as { event?: string }).event === "gtm_observability_smoke_success"
  )));
  expect(signals).toEqual([{
    event: "gtm_observability_smoke_success",
    form_id: "workflow-smoke-form",
    form_name: "Disposable workflow smoke form",
  }]);
  expect(JSON.stringify(signals)).not.toContain("private-sentinel@example.com");
});
