import { test, expect } from "@playwright/test";
test("actual portfolio separates its data from the fictional preview", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Paper only", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Research journal" }),
  ).toBeVisible();
  await expect(
    page.getByText("Illustrative preview", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("DEMO-INFLATION", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("link", { name: "View demo", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("Illustrative preview", { exact: true }),
  ).toBeVisible();
});
test("research filters, evidence expansion, and settlement history work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo");
  await expect(page.locator(".research-card")).toHaveCount(4);
  await page.getByRole("button", { name: /Watching 1/ }).click();
  await expect(page.locator(".research-card")).toHaveCount(1);
  await page.getByRole("button", { name: /All research 4/ }).click();
  await page
    .getByRole("searchbox", { name: "Search research markets" })
    .fill("inflation");
  await expect(page.locator(".research-card")).toHaveCount(1);
  await page.locator(".research-card-trigger").click();
  await expect(
    page.getByText("The counterargument", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Settlement criteria", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Illustrative source/ }),
  ).toHaveAttribute("href", "https://www.bls.gov/cpi/");
  await page.getByRole("button", { name: "Settled 1", exact: true }).click();
  await expect(
    page.getByText("Net profit / loss", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".position-card")
      .getByRole("heading", { name: /Will the central bank hold rates/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
});
test("methodology explains the actual simulation assumptions", async ({
  page,
}) => {
  await page.goto("/methodology");
  await expect(
    page.getByRole("heading", { name: "How a paper trade is recorded" }),
  ).toBeVisible();
  await expect(page.getByText(/There is no early-exit trading/)).toBeVisible();
});

test("empty search can be reset and research is keyboard accessible", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("searchbox").fill("no-matching-market");
  await expect(page.getByText("No matching research")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".research-card")).toHaveCount(4);
  const card = page.locator(".research-card-trigger").first();
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("aria-expanded", "true");
  await expect(card.getByText("Close analysis")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("aria-expanded", "false");
});

test("position cards separate stake, gross return and profit", async ({
  page,
}) => {
  await page.goto("/demo");
  const card = page.locator(".position-card").first();
  await expect(card.getByText("$447.16", { exact: true })).toBeVisible();
  await expect(card.getByText("$1,000.00", { exact: true })).toBeVisible();
  await expect(card.getByText("$552.84", { exact: true })).toBeVisible();
  await expect(
    card.getByText("Expected result · estimated", { exact: true }),
  ).toBeVisible();
  await card.getByText("Analysis & fill details", { exact: true }).click();
  await expect(
    card.getByText("Counterarguments & uncertainty", { exact: true }),
  ).toBeVisible();
  await card.getByText("Original research record", { exact: true }).click();
  await expect(card.locator("pre")).toContainText("DEMO-INFLATION");
  await page.getByRole("button", { name: "Settled 1", exact: true }).click();
  await expect(
    page.locator(".position-card").getByText("Won", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".position-card").getByText("$373.34", { exact: true }),
  ).toBeVisible();
});

test("schedule shows local timezone with UTC toggle without fetching demo markets", async ({
  browser,
}) => {
  const context = await browser.newContext({
    timezoneId: "America/Los_Angeles",
  });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/positions/")) requests.push(r.url());
  });
  await page.goto("http://127.0.0.1:3000/demo");
  const timing = page.locator(".position-timing").first();
  await expect(timing.locator(".timing-primary")).toContainText("PDT");
  await expect(
    timing.getByText("Times: America/Los_Angeles"),
  ).not.toBeVisible();
  await timing.getByText("Dates", { exact: true }).click();
  await expect(timing.getByText("Times: America/Los_Angeles")).toBeVisible();
  await expect(timing).toContainText("PDT");
  await timing.getByRole("button", { name: "Use UTC" }).click();
  await expect(timing.getByText("Times: UTC")).toBeVisible();
  await expect(timing).toContainText("Oct 25, 2026, 2:00 PM UTC");
  expect(requests).toEqual([]);
  await context.close();
});
