import { expect, test, type Page } from "@playwright/test";
import { evaluateInExtensionWorld, openExtensionJourney } from "./helpers/extension-journey.js";

// Slice 1 regression contract: the extension's form verdict comes from real browser
// signals (submit/invalid events, the success signal, a dataLayer observer, GA4 request
// delivery, consent commands), never from page flags. The fixture page sets no verdict
// flags, and no typed form value may cross into the extension (checked in its isolated world)
// or its API traffic.

const sentinel = "private-sentinel@example.com";

interface RealSignalCase {
  scenario: string;
  verdict: string;
  form: { label: string; selector: string };
  fill: boolean;
  navigatesTo?: RegExp;
  /** The visible next action, for runs where the page reported success over a failed endpoint. */
  nextAction?: RegExp;
}

const contact = { label: "Contact sales", selector: "form#contact" };

const cases: RealSignalCase[] = [
  { scenario: "successful_correct", verdict: "browser_verified", form: contact, fill: true },
  { scenario: "validation_failure", verdict: "expected_non_conversion", form: contact, fill: true },
  { scenario: "html5_validation_failure", verdict: "expected_non_conversion", form: contact, fill: false },
  { scenario: "attempt_only", verdict: "expected_non_conversion", form: contact, fill: true },
  { scenario: "ajax_success", verdict: "browser_verified", form: contact, fill: true },
  { scenario: "thank_you_redirect", verdict: "browser_verified", form: contact, fill: true, navigatesTo: /\/thank-you/ },
  { scenario: "spa_success", verdict: "browser_verified", form: contact, fill: true },
  { scenario: "outcome_event_missing", verdict: "outcome_observed_event_missing", form: contact, fill: true },
  { scenario: "datalayer_tag_not_firing", verdict: "datalayer_event_observed_tag_not_firing", form: contact, fill: true },
  { scenario: "tag_fired_request_missing", verdict: "tag_fired_request_missing", form: contact, fill: true },
  { scenario: "missing_required_parameter", verdict: "missing_parameter", form: contact, fill: true },
  { scenario: "duplicate_request", verdict: "duplicate_fire", form: contact, fill: true },
  { scenario: "consent_denied", verdict: "consent_limited", form: contact, fill: true },
  { scenario: "server_error", verdict: "submission_failed", form: contact, fill: true },
  { scenario: "dynamic_form", verdict: "browser_verified", form: { label: "Dynamic contact", selector: "form#dynamic-contact" }, fill: true },
  { scenario: "multiple_forms", verdict: "browser_verified", form: contact, fill: true },
  { scenario: "embedded_form", verdict: "browser_verified", form: { label: "Request a demo", selector: "form[aria-label='Request a demo']" }, fill: true },
  // Verdict precedence: the form endpoint's answer outranks the page's own success signal.
  { scenario: "server_error_with_success_event", verdict: "submission_failed", form: contact, fill: true, nextAction: /page reported success, but the form endpoint returned HTTP 503.*GA4 may count a lead/ },
  { scenario: "redirect_server_error", verdict: "submission_failed", form: contact, fill: true, navigatesTo: /\/thank-you/, nextAction: /page reported success, but the form endpoint returned HTTP 503/ },
  { scenario: "endpoint_rejection_with_success_event", verdict: "expected_non_conversion", form: contact, fill: true, nextAction: /page reported success, but the form endpoint rejected the submission with HTTP 422/ },
  { scenario: "server_error_retry_success", verdict: "browser_verified", form: contact, fill: true },
  { scenario: "third_party_error_after_success", verdict: "browser_verified", form: contact, fill: true },
];

/** Signals the extension actually received from the page observer, read in its isolated world. */
async function receivedSignals(page: Page): Promise<string> {
  return JSON.stringify(await evaluateInExtensionWorld<unknown>(
    page,
    "(() => { const bridge = globalThis[Symbol.for('trimtale.pageSignalBridge')]; return bridge ? bridge.received : null; })()",
  ));
}

async function verdictFlagAttributes(page: Page): Promise<string[]> {
  return page.evaluate(() => document.documentElement.getAttributeNames().filter((name) => name.startsWith("data-")));
}

for (const item of cases) {
  test(`real signals: ${item.scenario} gets ${item.verdict} without page flags`, async () => {
    const journey = await openExtensionJourney(item.scenario);
    const apiBodies: string[] = [];
    journey.context.on("request", (request) => {
      if (request.url().startsWith("http://127.0.0.1:18787")) apiBodies.push(`${request.url()} ${request.postData() ?? ""}`);
    });
    try {
      const { page, root } = journey;
      expect(await verdictFlagAttributes(page)).toEqual([]);
      await journey.send("Track leads from this form");
      await root.getByRole("button", { name: item.form.label, exact: true }).click();
      await root.getByRole("button", { name: "Review setup" }).click();
      await root.getByRole("button", { name: "Confirm setup" }).click();
      await root.getByRole("button", { name: "Start verification" }).click();
      await expect(root.getByText(/Verification is ready/)).toBeVisible();

      const form = page.locator(item.form.selector);
      if (item.fill) await form.locator("input[type='email']").fill(sentinel);
      const signalLog = await receivedSignals(page);
      await form.locator("button[type='submit']").click();
      if (item.navigatesTo) await page.waitForURL(item.navigatesTo);

      await expect(root.getByText(`Verdict: ${item.verdict}`, { exact: false })).toBeVisible({ timeout: 10_000 });
      await expect(root.getByText("Platform confirmation: unverified", { exact: false })).toBeVisible();
      if (item.nextAction) await expect(root.getByText(item.nextAction).first()).toBeVisible();
      expect(await verdictFlagAttributes(page)).toEqual([]);

      const crossed = `${signalLog}\n${await receivedSignals(page)}`;
      expect(crossed).not.toContain("private-sentinel");
      expect(apiBodies.join("\n")).not.toContain("private-sentinel");
      expect(await root.innerText()).not.toContain("private-sentinel");
    } finally {
      await journey.close();
    }
  });
}

test("real signals: a cross-origin iframe form is reported as not inspectable", async () => {
  const journey = await openExtensionJourney("cross_origin_iframe");
  try {
    const { page, root } = journey;
    expect(await verdictFlagAttributes(page)).toEqual([]);
    await journey.send("Track leads from this form");
    await expect(root.getByRole("button", { name: "Start verification" })).toHaveCount(0);
    await expect(root.getByText(/Verdict:/)).toHaveCount(0);
  } finally {
    await journey.close();
  }
});

test("real signals: the page observer stays idle until verification, then reports consent and lead events but not their values", async () => {
  const journey = await openExtensionJourney("consent_denied");
  try {
    const { page, root } = journey;
    await page.waitForTimeout(300);
    expect(await receivedSignals(page)).toBe("[]");
    await journey.send("Track leads from this form");
    await root.getByRole("button", { name: "Contact sales", exact: true }).click();
    await root.getByRole("button", { name: "Review setup" }).click();
    await root.getByRole("button", { name: "Confirm setup" }).click();
    await root.getByRole("button", { name: "Start verification" }).click();
    await page.evaluate((value) => {
      const layer = (window as Window & { dataLayer?: unknown[] }).dataLayer!;
      layer.push({ event: "generate_lead", form_id: "contact", email: value, form_name: value });
    }, sentinel);
    await expect.poll(() => receivedSignals(page)).toContain("\"event\":\"generate_lead\"");
    const log = await receivedSignals(page);
    expect(log).toContain("\"analyticsStorage\":\"denied\"");
    expect(log).toContain("\"formId\":\"contact\"");
    expect(log).not.toContain("private-sentinel");
  } finally {
    await journey.close();
  }
});
