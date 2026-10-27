// Builds the site into dist/, which Cloudflare serves (see wrangler.jsonc).
// Pages in src/pages/ use the shared layout (src/layouts/); the rest are
// still plain files in public/, copied to dist/ as is, until they move over.
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://alexanderk.dev",
  // Files land where they sit in src/pages, so URLs stay the same:
  // login.astro -> login.html, projects/index.astro -> projects/index.html
  build: { format: "preserve" },
});
