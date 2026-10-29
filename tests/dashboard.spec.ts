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
    .getByRole("link", { name: "Explore an illustrative demo" })
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
    page.getByRole("columnheader", { name: "Realized P&L" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: /Will the central bank hold rates/ }),
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
