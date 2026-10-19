import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:5173",
    // The browser draws WebGL in software here, where one redraw of the basemap takes a second or
    // more. Camera flights and eased padding redraw every frame, so they would stretch to many
    // seconds. The tests check behaviour, not motion, so they run with reduced motion.
    reducedMotion: "reduce",
    launchOptions: {
      args: [
        "--enable-webgl",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  timeout: 60000,
});
