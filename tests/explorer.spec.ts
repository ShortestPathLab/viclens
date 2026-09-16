import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

// Selects are listbox comboboxes, not native selects: open the trigger, then pick the option.
async function choose(page: Page, field: string, option: string) {
  await page.getByLabel(field, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
const openLayers = (page: Page) => page.getByRole("tab", { name: "Map layers" }).click();
// The switch role sits on a visually hidden input, so drive the switches by their visible label.
const toggle = (page: Page, label: string) => page.getByText(label, { exact: true }).click();

test("search, school details, filters, layer controls and source notes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".count")).toHaveText("2,301 schools");
  await expect(page.locator("canvas").first()).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Search schools" });
  await search.fill("Balnarring");
  await expect(page.locator(".count")).toHaveText("1 school");
  await page.getByRole("option", { name: /Balnarring Primary School/ }).click();
  await expect(page.getByRole("heading", { name: "Balnarring Primary School" })).toBeVisible();
  await expect(page.locator(".level-row")).toHaveCount(7);
  await page.getByRole("button", { name: "Close school details" }).click();

  await search.fill("no-such-school-xyz");
  await expect(page.getByRole("heading", { name: "No schools match" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await choose(page, "Sector", "Catholic");
  // Filtering is deferred, so wait for the narrowed list before picking from it.
  await expect(page.locator(".count")).not.toHaveText("2,301 schools");
  await page.locator(".school-row").first().click();
  await expect(page.getByText("No school-level enrolments")).toBeVisible();
  await page.getByRole("button", { name: "Close school details" }).click();
  await page.getByRole("button", { name: "Clear filters" }).first().click();

  await openLayers(page);
  await toggle(page, "Show 2026 zones");
  await expect(page.getByLabel("Year level", { exact: true })).toHaveCount(0);
  await toggle(page, "Show 2026 zones");
  await choose(page, "Year level", "Year 12");
  await expect(page.getByText("Loading boundaries")).toHaveCount(0);
  await toggle(page, "Colour by region");
  await expect(page.locator(".legend-title")).toHaveText("Education region");

  await toggle(page, "Show boundaries");
  await choose(page, "Inspect an LGA", "Melbourne");
  const lga = page.getByRole("region", { name: "Local government area details" });
  await expect(lga).toBeVisible();
  await expect(lga.getByRole("row")).toHaveCount(4);

  await page.getByRole("button", { name: "About the data" }).click();
  await expect(page.getByRole("heading", { name: "One map, four sources" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect(errors).toEqual([]);
});

test("mobile explorer is usable without covering the map permanently", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Schools", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Schools", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search schools" }).fill("Balnarring");
  await expect(page.locator(".count")).toHaveText("1 school");
  await page.getByRole("option", { name: /Balnarring Primary School/ }).click();
  // Opening a school closes the filters drawer and rests its detail on the map instead.
  await expect(page.getByRole("heading", { name: "Balnarring Primary School" })).toBeVisible();
  await expect(page.locator("#explorer-panel")).toHaveCount(0);
  const sheet = page.getByRole("complementary", { name: "School details" });
  await expect(sheet).toBeVisible();
  expect((await sheet.boundingBox())!.height).toBeLessThan(844 * 0.4);
  await page.getByRole("button", { name: "Close school details" }).click();
  await expect(sheet).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("failed school data can be retried", async ({ page }) => {
  await page.route("**/data/schools.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/");
  await expect(page.getByText("Schools did not load")).toBeVisible();
  await page.unroute("**/data/schools.json");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".count")).toHaveText("2,301 schools");
});

test("keyboard navigation reaches mobile results and restores school focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip map to school results" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#explorer-panel")).toBeVisible();
  await expect(page.locator("#school-results")).toBeFocused();
  await page.getByRole("searchbox", { name: "Search schools" }).fill("Balnarring");
  const school = page.getByRole("option", { name: /Balnarring Primary School/ });
  await school.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Balnarring Primary School" })).toBeFocused();
  await page.getByRole("button", { name: "Close school details" }).click();
  await expect(page.getByRole("button", { name: "Schools", exact: true })).toBeFocused();
});

test("the theme can be switched and the map follows", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
