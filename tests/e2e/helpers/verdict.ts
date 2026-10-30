import { expect, type Locator } from "@playwright/test";

export interface ExpectedVerdict {
  code: string;
  browserVerification?: string;
  platformConfirmation?: string;
}

/**
 * A run verdict renders as a finding that leads with the plain-language outcome.
 * The raw contract fields stay one click away under "Show evidence", in mono.
 */
export async function expectVerdictFinding(
  root: Locator,
  expected: ExpectedVerdict,
  options: { timeout?: number } = {},
): Promise<Locator> {
  const finding = root.locator(`article.finding[data-verdict-code="${expected.code}"]`).last();
  await expect(finding).toBeVisible(options);

  const title = finding.locator(".finding-title");
  await expect(title).toBeVisible();
  const titleText = await title.innerText();
  expect(titleText, "the verdict leads with an outcome sentence, not a code").not.toContain(expected.code);
  expect(titleText).toMatch(/^[A-Z0-9]/);
  for (const label of ["Observed", "Why", "Fix", "Verify"]) {
    await expect(finding.locator("dt", { hasText: label }).first()).toBeVisible();
  }

  const evidence = finding.locator("dl.evidence");
  await expect(evidence).toBeHidden();
  const toggle = finding.getByRole("button", { name: "Show evidence" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(finding.getByRole("button", { name: "Hide evidence" })).toHaveAttribute("aria-expanded", "true");
  await expect(evidence).toBeVisible();
  const value = (field: string) => evidence.locator(`dt[data-field="${field}"] + dd`);
  await expect(value("verdict.code")).toHaveText(expected.code);
  if (expected.browserVerification) await expect(value("verdict.browserVerification")).toHaveText(expected.browserVerification);
  if (expected.platformConfirmation) await expect(value("verdict.platformConfirmation")).toHaveText(expected.platformConfirmation);
  return finding;
}
