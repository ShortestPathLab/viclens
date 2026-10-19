import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// The data is built locally by `npm run data`; the tests read its counts rather than fixing them.
const report = JSON.parse(readFileSync("public/data/report.json", "utf8"));
const total = new Intl.NumberFormat("en-AU").format(report.matching.schools);

// Selects are listbox comboboxes, not native selects: open the trigger, then pick the option.
async function choose(page: Page, field: string, option: string | RegExp) {
  await page.getByLabel(field, { exact: true }).click();
  // A plain name matches exactly, so "Catholic" picks the sector, not a school with it in its name.
  await page
    .getByRole(
      "option",
      typeof option === "string" ? { name: option, exact: true } : { name: option },
    )
    .first()
    .click();
}
const openLayers = (page: Page) => page.getByRole("tab", { name: "Map layers" }).click();
// Each test gets a fresh browser context, so the saved layers start from the defaults.
const layerRows = (page: Page) =>
  page.getByRole("list", { name: "Map layers" }).getByRole("listitem");
// An open layer's text includes its dataset picker, which names every dataset, so a row is
// identified by its grip, whose name is the layer's own.
const grip = (page: Page, index: number) =>
  layerRows(page)
    .nth(index)
    .getByRole("button", { name: /^Move .* layer$/ });

test("search, school details and filters", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".count")).toHaveText(`${total} schools`);
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
  await expect(page.locator(".count")).not.toHaveText(`${total} schools`);
  await page.locator(".school-row").first().click();
  await expect(page.getByText(/FTE students, February/)).toBeVisible();
  await page.getByRole("button", { name: "Close school details" }).click();
  await page.getByRole("button", { name: "Clear filters" }).first().click();

  await page.getByRole("button", { name: "About the data" }).click();
  const about = page.getByRole("dialog", { name: "About the data" });
  await expect(
    about.getByRole("heading", { name: "School locations", exact: false }).first(),
  ).toBeVisible();
  // The modal makes the page behind it inert, which Playwright's role queries still match, so the
  // close button is looked up inside the dialog rather than across the page.
  await about.getByRole("button", { name: "Close", exact: true }).click();
  expect(errors).toEqual([]);
});

test("layers can be configured, added, hidden and reordered", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await openLayers(page);
  await expect(layerRows(page)).toHaveCount(2);
  await expect(grip(page, 0)).toHaveAccessibleName("Move Schools layer");

  // Shade schools by enrolment change instead of colouring them by type.
  await page.getByRole("button", { name: /^Schools Coloured by school type/ }).click();
  await choose(page, "Displayed as", /^Graduated colour/);
  await choose(page, "Shade by", /^Enrolments, February/);
  await expect(page.getByRole("button", { name: /^Schools Shaded by enrolments/ })).toBeVisible();
  await expect(page.locator(".legend-title").first()).toHaveText("Schools");

  // Add council areas, then open one through the accessible picker.
  await page.getByRole("button", { name: "Add layer" }).click();
  await page.getByRole("menuitem", { name: /^Local government areas/ }).click();
  await expect(layerRows(page)).toHaveCount(3);
  // Areas land under the points above them.
  await expect(grip(page, 1)).toHaveAccessibleName("Move Local government areas layer");
  await choose(page, "Inspect an area", "Melbourne");
  const area = page.getByRole("region", { name: "Area details" });
  await expect(area).toBeVisible();
  await expect(area.getByRole("row").first()).toBeVisible();

  // Hiding the layer closes its card; the eye is a toggle button.
  const eye = page.getByRole("button", { name: "Show Local government areas layer" });
  await expect(eye).toHaveAttribute("aria-pressed", "true");
  await eye.click();
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  await expect(area).toHaveCount(0);

  // Keyboard reorder: pick up the zones layer, move it to the top and drop it. Each key waits for
  // the list's spoken announcement, so a press never lands before the previous move is measured.
  // dnd-kit measures on animation frames, which the software renderer here produces slowly.
  const live = (text: RegExp) => expect(page.getByText(text)).toBeAttached({ timeout: 15_000 });
  await page.getByRole("button", { name: "Move Enrolment zones layer" }).focus();
  await page.keyboard.press("Space");
  await live(/^Picked up Enrolment zones/);
  await page.keyboard.press("ArrowUp");
  await live(/moved to position 2 of 3/);
  await page.keyboard.press("ArrowUp");
  await live(/moved to position 1 of 3/);
  await page.keyboard.press("Space");
  await live(/dropped at position 1 of 3/);
  await expect(grip(page, 0)).toHaveAccessibleName("Move Enrolment zones layer");

  // The arrangement survives a reload.
  await page.reload();
  await openLayers(page);
  await expect(layerRows(page)).toHaveCount(3);
  await expect(grip(page, 0)).toHaveAccessibleName("Move Enrolment zones layer");
  expect(errors).toEqual([]);
});

test("mobile explorer is usable without covering the map permanently", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Schools", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Victorian schools", exact: true })).toBeVisible();
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
  await expect(page.locator(".count")).toHaveText(`${total} schools`);
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
