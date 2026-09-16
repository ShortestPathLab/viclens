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
  await page.locator(".count").filter({ hasText: "2,301" }).waitFor({ state: "attached" });
  await page.waitForFunction(() => !document.body.innerText.includes("Loading zone boundaries"));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `artifacts/${name}.png` });
  if (name === "mobile") {
    await page.getByRole("button", { name: /Explore .* schools/ }).click();
    await page.screenshot({ path: "artifacts/mobile-panel.png" });
  }
  if (name === "desktop") {
    await page.getByText("Local government areas", { exact: true }).click();
    await page.getByLabel("Inspect an LGA").selectOption({ label: "Melbourne" });
    await page.screenshot({ path: "artifacts/desktop-lga.png" });
  }
  await page.close();
}
await browser.close();
