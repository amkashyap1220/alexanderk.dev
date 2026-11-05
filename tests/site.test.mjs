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
  for (const p of ["index.html", "about.html", "404.html", "unlock.html", "projects/index.html", "research/index.html", "stats/index.html", "private/index.html"]) {
    assert.ok(pages.some((x) => x.file === p), p);
  }
});

test("every page has a title, a description and the site header and footer", () => {
  for (const { file, html } of pages) {
    assert.equal(all(html, /<title>([^<]+)<\/title>/g).length, 1, file + ": one <title>");
    assert.match(html, /<meta name="description" content="[^"]+"/, file + ": description");
    assert.match(html, /<a class="nav-private" href="\/private\/"/, file + ": Private tab");
    // The Private tab shows once unlocked, from a line of script in <head> (no extra request)
    assert.ok(html.includes('document.documentElement.classList.add("signed-in")'), file + ": signed-in check");
    // The shared styles come first, so each page's own styles can build on them
    const styles = all(html, /<link rel="stylesheet" href="([^"]+)"|<style>/g);
    assert.match(styles[0] ?? "", /^\/_astro\/site\.[\w-]+\.css$/, file + ": shared stylesheet first");
    assert.match(html, /class="icon-btn unlock-link" href="\/unlock"/, file + ": footer lock icon");
    // The main nav: Work, Research and About, in a <nav> every page has (the ☰ menu it replaced is gone)
    const nav = html.match(/<nav class="site-nav" aria-label="Main">([\s\S]*?)<\/nav>/)?.[1] ?? "";
    assert.match(nav, /<a href="\/projects\/"[^>]*>Repositories<\/a>/, file + ": nav Repositories");
    assert.match(nav, /<a href="\/research\/"[^>]*>Lab<\/a>/, file + ": nav Lab");
    assert.match(nav, /<a href="\/about"[^>]*>About<\/a>/, file + ": nav About");
    assert.match(html, /<a class="cta cta-solid" href="\/resume\.pdf">/, file + ": Resume in the header");
    // The unlock box: a visible title, a close button, and a labeled field tied to its error message
    assert.match(html, /<dialog class="unlock-dialog" id="unlock-dialog" aria-labelledby="unlock-dialog-h">/, file + ": unlock box");
    assert.match(html, /<h2 class="unlock-title" id="unlock-dialog-h">/, file + ": unlock box title");
    assert.match(html, /<button class="unlock-close" type="button" aria-label="Close" data-close>/, file + ": unlock box close button");
    assert.match(html, /<label class="unlock-label" for="unlock-dialog-code">[\s\S]*?id="unlock-dialog-code"[^>]*aria-describedby="unlock-dialog-error"[\s\S]*?id="unlock-dialog-error"/, file + ": unlock field and its error");
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

test("the Repositories page lists every project under Featured repositories and More repositories, and every project page has its facts", () => {
  const slugs = all(fs.readFileSync("src/data/projects.ts", "utf8"), /slug: "([^"]+)"/g);
  const work = pages.find((x) => x.file === "projects/index.html").html;
  for (const tier of ["Featured repositories", "More repositories"]) assert.match(work, new RegExp(`class="h-label">${tier}<`), "Repositories: " + tier);
  assert.match(work, new RegExp(`<span>${slugs.length} projects</span>`), "Work: the project count");
  for (const slug of slugs) {
    // A research project is listed by its write-up, which links on to the project page
    const writeup = pages.find((x) => x.file.startsWith("research/") && x.html.includes(`href="/projects/${slug}"`) && work.includes(`href="/${x.file.replace(/\.html$/, "")}"`));
    assert.ok(work.includes(`href="/projects/${slug}"`) || writeup, `Work: a link to ${slug}, or to a write-up that links to it`);
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
  assert.match(index, /class="h-label">Featured</, "Lab: featured");
  for (const slug of slugs) {
    assert.ok(index.includes(`href="/research/${slug}"`), `Research: a link to ${slug}`);
    const page = pages.find((x) => x.file === `research/${slug}.html`)?.html;
    assert.ok(page, `research/${slug}.html`);
    assert.match(page, /<p class="byline">[\s\S]*?By Alexander Kashyap[\s\S]*?Data through/, slug + ": byline");
    assert.match(page, /class="h-label">What I found<\/h2>\s*<ol>(\s*<li>[\s\S]*?<\/li>){3}/, slug + ": at least three findings");
    assert.match(page, /class="h-label">Read next</, slug + ": what to read next");
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

test("link previews and canonical links point at the page's own address, and their images exist", () => {
  for (const { file, html } of pages) {
    const url = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    assert.equal(canonical, url, file + ": the canonical link is the link preview's address");
    if (!url) continue;
    const own = "/" + file.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");
    assert.equal(new URL(url).pathname, own, file);
    const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    assert.ok(image && fileFor(new URL(image).pathname), `${file}: preview image ${image}`);
  }
});

test("the sitemap lists exactly the public pages, and robots.txt points to it", () => {
  const listed = all(fs.readFileSync(path.join(out, "sitemap.xml"), "utf8"), /<loc>([^<]+)<\/loc>/g).sort();
  const shared = pages.map((p) => p.html.match(/<meta property="og:url" content="([^"]+)"/)?.[1]).filter(Boolean).sort();
  assert.deepEqual(listed, shared);
  for (const { file, html } of pages) {
    if (/<meta name="robots" content="noindex/.test(html)) assert.ok(!listed.some((u) => fileFor(new URL(u).pathname) === "/" + file), file + " is noindex");
  }
  assert.match(fs.readFileSync(path.join(out, "robots.txt"), "utf8"), /^Sitemap: https:\/\/alexanderk\.dev\/sitemap\.xml$/m);
});

test("structured data is valid JSON, and names me on the homepage, the About page and every post", () => {
  for (const { file, html } of pages) {
    for (const json of all(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const data = JSON.parse(json);
      assert.equal(data["@context"], "https://schema.org", file);
    }
  }
  const ld = (file) => JSON.stringify(JSON.parse(pages.find((x) => x.file === file).html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]));
  for (const file of ["index.html", "about.html"]) assert.match(ld(file), /"@type":"Person".*"name":"Alexander Kashyap"/, file);
  for (const slug of all(fs.readFileSync("src/data/research.ts", "utf8"), /slug: "([^"]+)"/g)) {
    assert.match(ld(`research/${slug}.html`), /"@type":"Article".*"datePublished":"\d{4}-\d\d-\d\d".*"author":\{"@type":"Person"/, slug);
  }
});

test("hashed bundles are cached for good; pages are not", () => {
  const rules = fs.readFileSync(path.join(out, "_headers"), "utf8");
  assert.match(rules, /^\/_astro\/\*\n\s+Cache-Control: public, max-age=31536000, immutable$/m);
  assert.doesNotMatch(rules, /^\/\*$|^\/$|\.html/m, "no rule for pages");
});

test("the About, Stats and 404 pages have what they promise", () => {
  const about = pages.find((x) => x.file === "about.html").html;
  for (const place of ["K-Rise Systems", "Outlier, a Scale AI platform", "Northern Illinois University", "Chamberlain Group"]) assert.ok(about.includes(`<h3>${place}</h3>`), "About: " + place);
  assert.match(about, /id="tools-h"[^>]*>Toolbox</, "About: the toolbox");
  assert.match(about, /id="otc-h"[^>]*>Off the clock</, "About: Off the clock");
  assert.match(about, /href="\/stats\/"/, "About: a link to GitHub Stats");
  const stats = pages.find((x) => x.file === "stats/index.html").html;
  assert.match(stats, /Public repos only; my day-to-day C#\/\.NET work lives in private company repos\./, "Stats: the framing line");
  assert.equal((stats.match(/<div data-figure="/g) || []).length, 5, "Stats: five numbers, drawn before the data arrives");
  const notFound = pages.find((x) => x.file === "404.html").html;
  for (const href of ["/projects/open-tradesman", "/research/chicago-home-value", "/projects/alexanderk-dev"]) assert.ok(notFound.includes(`href="${href}"`), "404: " + href);
  assert.match(notFound, /href="mailto:alexander\.kashyap@gmail\.com"/, "404: email");
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
