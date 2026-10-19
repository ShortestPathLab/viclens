import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  args: [
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (e) => console.error(name, e.message));
  await page.goto("http://127.0.0.1:5173");
  await page.locator(".count").filter({ hasText: "schools" }).waitFor({ state: "attached" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `artifacts/${name}.png` });
  if (name === "mobile") {
    await page.getByRole("button", { name: "Schools", exact: true }).click();
    await page.screenshot({ path: "artifacts/mobile-panel.png" });
  }
  if (name === "desktop") {
    await page.getByRole("tab", { name: "Map layers" }).click();
    await page.getByRole("button", { name: "Add layer" }).click();
    await page.getByRole("menuitem", { name: /^Statistical areas/ }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "artifacts/desktop-layers.png" });
  }
  await page.close();
}
await browser.close();
