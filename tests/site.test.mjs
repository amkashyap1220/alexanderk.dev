// Builds the site and checks every page in it (needs `npm install` first; run with: npm test)
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const out = fs.mkdtempSync(path.join(os.tmpdir(), "site-"));
const astro = path.join("node_modules", ".bin", process.platform === "win32" ? "astro.cmd" : "astro");
if (!fs.existsSync(astro)) throw new Error("Astro isn't installed: run npm install first");
execFileSync(astro, ["build", "--outDir", out, "--silent"], { stdio: "inherit" });
test.after(() => fs.rmSync(out, { recursive: true, force: true }));

const files = fs.readdirSync(out, { recursive: true }).map(String).filter((f) => f.endsWith(".html"));
const pages = files.map((f) => ({ file: f.split(path.sep).join("/"), html: fs.readFileSync(path.join(out, f), "utf8") }));
const all = (html, re) => [...html.matchAll(re)].map((m) => m[1]);

// Handled by the Worker, not files: unlocking and locking, the GitHub data and the fitness API
const DYNAMIC = /^\/(unlock|lock)$|^\/data\/|^\/private\/api\//;

// The file Cloudflare would serve for a site address, or null
function fileFor(address) {
  const p = decodeURIComponent(address.split(/[?#]/)[0]);
  const candidates = p.endsWith("/") ? [p + "index.html"] : [p, p + ".html"];
  return candidates.find((c) => fs.existsSync(path.join(out, c)) && fs.statSync(path.join(out, c)).isFile()) ?? null;
}

test("the site builds every page", () => {
  assert.ok(pages.length >= 20, `built ${pages.length} pages`);
  for (const p of ["index.html", "404.html", "unlock.html", "projects/index.html", "research/index.html", "stats/index.html", "private/index.html"]) {
    assert.ok(pages.some((x) => x.file === p), p);
  }
});

test("every page has a title, a description and the site header and footer", () => {
  for (const { file, html } of pages) {
    assert.equal(all(html, /<title>([^<]+)<\/title>/g).length, 1, file + ": one <title>");
    assert.match(html, /<meta name="description" content="[^"]+"/, file + ": description");
    assert.match(html, /<a class="nav-private" href="\/private\/"/, file + ": Private tab");
    assert.match(html, /<script src="\/js\/signed-in\.js"><\/script>/, file + ": signed-in.js");
    assert.match(html, /class="icon-btn unlock-link" href="\/unlock"/, file + ": footer lock icon");
    // The main nav: Work, Research and About, in a <nav> every page has (the ☰ menu it replaced is gone)
    const nav = html.match(/<nav class="site-nav" aria-label="Main">([\s\S]*?)<\/nav>/)?.[1] ?? "";
    assert.match(nav, /<a href="\/projects\/"[^>]*>Work<\/a>/, file + ": nav Work");
    assert.match(nav, /<a href="\/research\/"[^>]*>Research<\/a>/, file + ": nav Research");
    assert.match(nav, /<a href="\/#about"[^>]*>About<\/a>/, file + ": nav About");
    assert.match(html, /<a class="cta cta-solid" href="\/resume\.pdf">/, file + ": Resume in the header");
    assert.match(html, /<dialog class="unlock-dialog"/, file + ": unlock box");
    assert.match(html, /<footer class="site-footer">/, file + ": footer");
    assert.ok(all(html, /aria-current="(page)"/g).length <= 1, file + ": at most one current tab");
  }
});

test("the resume is there to download, and the homepage shows the email address", () => {
  assert.ok(fileFor("/resume.pdf"), "/resume.pdf");
  assert.equal(fs.readFileSync(path.join(out, "resume.pdf")).subarray(0, 5).toString(), "%PDF-", "resume.pdf is a PDF");
  const home = pages.find((x) => x.file === "index.html").html;
  assert.match(home, />alexander\.kashyap@gmail\.com<\/a>/, "the email address, as text");
  assert.match(home, /href="mailto:alexander\.kashyap@gmail\.com"/, "a mailto link");
});

test("no page shows a phone number", () => {
  // US-style numbers: 555-123-4567, (555) 123-4567, 555.123.4567, +1 555 123 4567
  const phone = /(?:\+1[\s.-]?)?(?:\(\d{3}\)\s?|\b\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/;
  for (const { file, html } of pages) {
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
    assert.doesNotMatch(text, phone, file);
    assert.doesNotMatch(html, /href="tel:/, file + ": tel: link");
  }
});

test("link previews point at the page's own address", () => {
  for (const { file, html } of pages) {
    const url = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
    if (!url) continue;
    const own = "/" + file.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");
    assert.equal(new URL(url).pathname, own, file);
  }
});

test("every link and file a page uses exists, at its clean address", () => {
  for (const { file, html } of pages) {
    // component-url and renderer-url: the scripts behind a Svelte component (astro-island)
    for (const ref of all(html, /(?:href|src|component-url|renderer-url)="(\/(?!\/)[^"]*)"/g)) {
      if (DYNAMIC.test(ref.split(/[?#]/)[0])) continue;
      assert.ok(fileFor(ref), `${file}: ${ref} doesn't exist`);
      assert.doesNotMatch(ref, /\.html([?#]|$)/, `${file}: link to ${ref} without .html`);
    }
    // Responsive images: every size listed in srcset
    for (const set of all(html, /srcset="([^"]+)"/g)) {
      for (const ref of set.split(",").map((c) => c.trim().split(/\s+/)[0])) {
        assert.ok(ref.startsWith("/") && fileFor(ref), `${file}: ${ref} (srcset) doesn't exist`);
      }
    }
  }
});
