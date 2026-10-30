import { expect, test, type Page } from "@playwright/test";
import { evaluateInExtensionWorld, openExtensionJourney, type ExtensionJourney } from "./helpers/extension-journey.js";
import { expectVerdictFinding } from "./helpers/verdict.js";

// Regression contract for forge-proof page signals: a page script cannot forge, start, read or
// disable the channel between the MAIN-world page observer and the extension. Each attack runs
// from the page's own JavaScript world (an inline <script> or page.evaluate), the same place a
// real site's or third-party tag's script runs. The fixture form shows its success message but
// never pushes generate_lead and never fires the GA4 tag, so the true verdict is
// outcome_observed_event_missing; a forged generate_lead would turn it into
// datalayer_event_observed_tag_not_firing and a forged denied consent into consent_limited.

type Received = Array<{ kind: string; event?: string; analyticsStorage?: string; formId?: string }>;

const receivedSignals = (page: Page) => evaluateInExtensionWorld<Received | null>(
  page,
  "(() => { const bridge = globalThis[Symbol.for('trimtale.pageSignalBridge')]; return bridge ? bridge.received : null; })()",
);

async function startContactVerification(journey: ExtensionJourney): Promise<void> {
  const { root } = journey;
  await journey.send("Track leads from this form");
  await root.getByRole("button", { name: "Contact sales", exact: true }).click();
  await root.getByRole("button", { name: "Review setup" }).click();
  await root.getByRole("button", { name: "Confirm setup" }).click();
  await root.getByRole("button", { name: "Start verification" }).click();
  await expect(root.getByText(/Verification is ready/)).toBeVisible();
}

for (const adversary of ["datalayer", "consent"] as const) {
  test(`forgery: a page forging ${adversary} signals cannot change the verdict or read the signal stream`, async () => {
    const journey = await openExtensionJourney("outcome_event_missing", undefined, undefined, { adversary });
    try {
      const { page, root } = journey;
      await startContactVerification(journey);
      const form = page.locator("form#contact");
      await form.locator("input[type='email']").fill("lead@example.com");
      await form.locator("button[type='submit']").click();

      await expectVerdictFinding(root, { code: "outcome_observed_event_missing", platformConfirmation: "unverified" }, { timeout: 10_000 });

      // The extension received the page's real consent default, and nothing the page forged.
      const received = await receivedSignals(page);
      expect(received).toContainEqual(expect.objectContaining({ kind: "consent", analyticsStorage: "granted" }));
      expect(received?.filter((signal) => signal.kind === "datalayer_event")).toEqual([]);
      expect(received?.filter((signal) => signal.kind === "consent" && signal.analyticsStorage === "denied")).toEqual([]);

      // Nothing the observer sent, by any route, was visible to the page.
      const stolen = await page.evaluate(() => (window as Window & { __stolenSignals?: string[] }).__stolenSignals ?? null);
      expect(stolen).toEqual([]);
    } finally {
      await journey.close();
    }
  });
}

test("forgery: a synthetic (untrusted) submit event from a page script does not start a verification run", async () => {
  const journey = await openExtensionJourney("outcome_event_missing");
  try {
    const { page, root } = journey;
    await startContactVerification(journey);
    await page.evaluate(() => {
      const form = document.querySelector<HTMLFormElement>("form#contact")!;
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("invalid", { cancelable: true }));
    });
    // The page's own handler still ran (it showed its success message)...
    await expect(page.getByRole("status").filter({ hasText: "Thanks" })).toBeVisible();
    // ...but no run began, so no verdict is produced from a submit nobody made.
    await page.waitForTimeout(5_000);
    await expect(root.locator("article.finding")).toHaveCount(0);
  } finally {
    await journey.close();
  }
});

test("forgery: a guard flag the page sets before the observer loads does not disable it", async () => {
  const journey = await openExtensionJourney("consent_denied", undefined, async (context) => {
    // addInitScript runs before the page's own scripts — earlier than any real page script can.
    await context.addInitScript(() => {
      Object.defineProperty(window, "__trimtalePageObserver", { value: true, writable: false, configurable: false });
    });
  });
  try {
    const { page, root } = journey;
    await startContactVerification(journey);
    const form = page.locator("form#contact");
    await form.locator("input[type='email']").fill("lead@example.com");
    await form.locator("button[type='submit']").click();
    // consent_limited is reachable only through the observer's dataLayer consent signal here.
    await expectVerdictFinding(root, { code: "consent_limited" }, { timeout: 10_000 });
  } finally {
    await journey.close();
  }
});
