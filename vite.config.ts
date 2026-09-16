import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  // The site can be served from a subpath, such as /viclens/ on GitHub Pages. Data files are
  // fetched against import.meta.env.BASE_URL, so they follow this too.
  base: process.env.BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1800 },
});
