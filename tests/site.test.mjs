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

test("the Work page lists every project in three tiers, and every project page has its facts", () => {
  const slugs = all(fs.readFileSync("src/data/projects.ts", "utf8"), /slug: "([^"]+)"/g);
  const work = pages.find((x) => x.file === "projects/index.html").html;
  for (const tier of ["Featured", "More work", "Archive"]) assert.match(work, new RegExp(`class="h-label">${tier}<`), "Work: " + tier);
  assert.match(work, new RegExp(`<span>${slugs.length} projects</span>`), "Work: the project count");
  for (const slug of slugs) {
    assert.ok(work.includes(`href="/projects/${slug}"`), `Work: a link to ${slug}`);
    const page = pages.find((x) => x.file === `projects/${slug}.html`)?.html;
    assert.ok(page, `projects/${slug}.html`);
    assert.match(page, /<aside class="cs-facts"/, slug + ": facts");
    assert.doesNotMatch(page, /Work in progress/, slug + ": no empty walkthrough");
    // A README waits, folded, until it's opened
    if (page.includes("data-readme=")) assert.match(page, /<details class="repo-fold">[\s\S]*?data-readme=/, slug + ": README folded");
  }
});

test("the Research page lists every post, and every post has its byline, findings and charts' numbers", () => {
  const slugs = all(fs.readFileSync("src/data/research.ts", "utf8"), /slug: "([^"]+)"/g);
  const index = pages.find((x) => x.file === "research/index.html").html;
  assert.match(index, /class="h-label">Lead investigation</, "Research: the lead investigation");
  for (const slug of slugs) {
    assert.ok(index.includes(`href="/research/${slug}"`), `Research: a link to ${slug}`);
    const page = pages.find((x) => x.file === `research/${slug}.html`)?.html;
    assert.ok(page, `research/${slug}.html`);
    assert.match(page, /<p class="byline">[\s\S]*?By Alexander Kashyap[\s\S]*?Data through/, slug + ": byline");
    assert.match(page, /class="h-label">What I found<\/h2>\s*<ol>(\s*<li>[\s\S]*?<\/li>){3}/, slug + ": at least three findings");
    assert.match(page, /class="h-label">Next investigation</, slug + ": the next investigation");
  }
  // Every PA chart has its numbers as a table, in the page as built
  const pa = pages.find((x) => x.file === "research/pa-job-market.html").html;
  const charts = (pa.match(/<div class="pa-(?:chart|map)"/g) || []).length;
  assert.ok(charts > 0, "PA: charts");
  assert.equal((pa.match(/<summary>Show the numbers<\/summary>/g) || []).length, charts, "PA: a table for every chart");
  // The Chicago map's opening summary is worked out when the site is built, so the page doesn't jump when the data loads
  const chicago = pages.find((x) => x.file === "research/chicago-home-value.html").html;
  assert.match(chicago, /id="hv-summary"[^>]*>(<!--[^>]*-->)*<b>Your top \d+ to buy\.<\/b> Best fit: /, "Chicago: the summary as built");
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
