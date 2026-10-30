import { test, expect } from "@playwright/test";

test("refresh keeps filters, exposes sync failures, and retains the last readable portfolio", async ({
  page,
}) => {
  const baseline = await (await page.request.get("/api/portfolio")).json();
  const fixture = {
    ...baseline,
    mode: "local",
    cashCents: 9999900,
    syncErrors: [] as { ticker: string; message: string }[],
  };
  let fail = false;
  await page.route("**/api/portfolio", (route) =>
    route.fulfill({
      status: fail ? 503 : 200,
      json: fail ? { ...fixture, mode: "unavailable", cashCents: 0 } : fixture,
    }),
  );
  await page.goto("/#research");
  await page.getByRole("searchbox").fill("keep this search");
  const refresh = page.getByRole("button", { name: "Refresh portfolio" });
  await refresh.click();
  await expect(page.locator(".metric").last()).toContainText("$99,999.00");
  await expect(page.getByRole("searchbox")).toHaveValue("keep this search");
  fixture.syncErrors = [
    { ticker: "TEST-MARKET", message: "Official quote unavailable" },
  ];
  await refresh.click();
  await expect(
    page.getByText("Market review needs attention", { exact: true }),
  ).toBeVisible();
  await page.getByText("Show affected markets", { exact: true }).click();
  await expect(
    page.getByText("TEST-MARKET: Official quote unavailable"),
  ).toBeVisible();
  fail = true;
  await refresh.click();
  await expect(
    page.getByText("Portfolio refresh unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".metric").last()).toContainText("$99,999.00");
});

test("automatic refresh pauses in hidden tabs and resumes without writes", async ({
  page,
}) => {
  const fixture = await (await page.request.get("/api/portfolio")).json();
  fixture.mode = "local";
  let reads = 0;
  await page.route("**/api/portfolio", (route) => {
    reads++;
    return route.fulfill({ json: fixture });
  });
  await page.clock.install();
  await page.goto("/");
  const refresh = page.getByRole("button", { name: "Refresh portfolio" });
  await refresh.click();
  await expect.poll(() => reads).toBe(1);
  await expect(refresh).toBeEnabled();
  reads = 0;
  await page.evaluate(() =>
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    }),
  );
  await page.clock.fastForward(5 * 60000 + 1);
  expect(reads).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => reads).toBe(1);
});

test("demo remains isolated from portfolio refresh", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/portfolio")) requests.push(r.url());
  });
  await page.clock.install();
  await page.goto("/demo");
  await page.clock.fastForward(10 * 60000);
  await expect(
    page.getByRole("button", { name: "Refresh portfolio" }),
  ).toHaveCount(0);
  expect(requests).toEqual([]);
});
test("actual portfolio separates its data from the fictional preview", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/^Paper only\. Each row/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Portfolio overview" }),
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
  await page.goto("/demo#research");
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
  await page.getByRole("button", { name: "Close market detail" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await page.getByRole("button", { name: "Settled 1", exact: true }).click();
  await page.locator(".market-title").click();
  await expect(
    page.getByRole("dialog").getByText("Net profit / loss", { exact: true }),
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
  await page.goto("/demo#research");
  await page.getByRole("searchbox").fill("no-matching-market");
  await expect(page.getByText("No matching research")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".research-card")).toHaveCount(4);
  const card = page.locator(".research-card-trigger").first();
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close market detail" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card).toBeFocused();
});

test("position cards separate stake, gross return and profit", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.locator(".market-title").first().click();
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
  await page.getByRole("button", { name: "Close market detail" }).click();
  await page.getByRole("button", { name: "Settled 1", exact: true }).click();
  await page.locator(".market-title").first().click();
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
  await page.locator(".market-title").first().click();
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

test("opportunities, category filters and activity links open recorded research", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Find opportunities" }).click();
  await expect(
    page.getByRole("heading", { name: "Find the next opportunity" }),
  ).toBeVisible();
  await expect(page.locator(".opportunity-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Economics", exact: true }).click();
  await expect(page.locator(".opportunity-card")).toHaveCount(1);
  await page.getByRole("searchbox").fill("does-not-exist");
  await expect(page.getByText("No matching opportunities")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".opportunity-card")).toHaveCount(2);
  await page.getByRole("button", { name: "View research" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("The counterargument");
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Activity", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Decision history" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View research" }).first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "Original research record",
  );
});

test("dialog traps focus, restores scrolling, and supports browser navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo#research");
  const trigger = page.locator(".research-card-trigger").first();
  await trigger.click();
  const close = page.getByRole("button", { name: "Close market detail" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((dialog) => dialog.contains(document.activeElement)),
  ).toBe(true);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Activity", exact: true })
    .click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Research journal", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".research-card")).toHaveCount(4);
  expect(errors).toEqual([]);
});
