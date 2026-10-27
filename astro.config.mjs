// Builds the site into dist/, which Cloudflare serves (see wrangler.jsonc).
// For now every page is a plain file in public/, copied to dist/ as is;
// pages move into src/ as they get shared layouts.
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://alexanderk.dev",
});
