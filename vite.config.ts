import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  // The site can be served from a subpath, such as /schools/. Data files are fetched against
  // import.meta.env.BASE_URL, so they follow this too.
  base: process.env.BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  build: {
    // mapbox-gl is one 1.8 MB chunk on its own, loaded only when a token is set.
    chunkSizeWarningLimit: 1850,
    // deck.gl and luma.gl change far less often than the app, so they get a chunk of their own.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "deck", test: /node_modules[\\/]@(deck|luma|loaders)\.gl[\\/]/ }],
        },
      },
    },
  },
});
