import { expect, test } from "./helpers/extension-test.js";

test("completes the lead-form journey on a real React page", async ({ page }) => {
  const analyticsRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/g/collect") && request.url().includes("en=generate_lead")) {
      analyticsRequests.push(request.url());
    }
  });

  await page.goto("http://127.0.0.1:4173/react");
  await expect(page.locator("form#react-lead-form")).toBeVisible();
  expect(await page.evaluate(() => (
    (window as Window & { __reactFixtureVersion?: string }).__reactFixtureVersion
  ))).toMatch(/^\d+\./);

  const root = page.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill("Track successful React demo requests as leads");
  await root.getByRole("button", { name: "Send request" }).click();
  await root.getByRole("button", { name: "Review setup" }).click();
  await root.getByRole("button", { name: "Approve setup" }).click();
  await root.getByRole("button", { name: "Verify already-installed setup" }).click();

  await page.locator("#react-lead-form button[type='submit']").click();
  await expect(page.locator("#react-success")).toBeHidden();
  expect(analyticsRequests).toHaveLength(0);

  const privateValue = "private-react@example.test";
  await page.locator("#react-lead-form input[name='email']").fill(privateValue);
  await page.locator("#react-lead-form button[type='submit']").click();

  await expect(page).toHaveURL("http://127.0.0.1:4173/react/complete");
  await expect(page.locator("#react-success")).toBeVisible();
  const result = root.getByRole("region", { name: "Agent task" });
  await expect(result.getByText("browser_verified", { exact: true })).toBeVisible();
  await expect(result.getByText("passed", { exact: true })).toBeVisible();
  await expect.poll(() => analyticsRequests.length).toBe(1);
  expect(analyticsRequests[0]).toContain("ep.form_id=react-lead-form");
  expect(analyticsRequests[0]).toContain("ep.form_name=React%20demo%20request");
  expect(analyticsRequests[0]).toContain("ep.page_location=");
  await expect(root.getByText(privateValue, { exact: false })).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath("react-form-verified.png"),
    animations: "disabled",
  });
});
