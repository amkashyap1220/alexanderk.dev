// Builds the site into dist/, which Cloudflare serves (see wrangler.jsonc).
// Pages in src/pages/ use the shared layout (src/layouts/). Most pages are
// plain HTML with a little JavaScript from public/js/; the Chicago home value
// map and the fitness dashboard are built from Svelte components
// (src/components/home-value/ and fitness/), which Astro compiles into
// scripts for those pages only.
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";

export default defineConfig({
  site: "https://alexanderk.dev",
  integrations: [svelte()],
  // Files land where they sit in src/pages, so URLs stay the same:
  // login.astro -> login.html, projects/index.astro -> projects/index.html
  build: { format: "preserve" },
});
