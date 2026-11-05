// Makes the link-preview images (what iMessage, Slack, LinkedIn and others show
// for a link): public/og.jpg for most pages, and public/projects/<slug>.jpg for
// the featured projects that have `preview` set in src/data/projects.ts. Each
// is 1200 x 630, set in the site's own fonts over the Hubble background.
//
// Run it again after changing a headline. It needs Playwright, which isn't one
// of the site's dependencies:
//   npm install --no-save playwright && npx playwright install chromium
//   node scripts/link-previews.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const file = (p) => pathToFileURL(path.join(root, "public", p)).href;

// The cards: the default, then one per featured project (kept in step with projects.ts by hand)
const cards = [
  {
    out: "og.jpg",
    kicker: ["Software developer", "Chicago area"],
    name: "Alexander Kashyap",
    dek: "I build software, dig into data, and share what I learn.",
    foot: ["Repositories", "Lab", "About"],
  },
  {
    out: "projects/open-tradesman.jpg",
    kicker: ["Open Tradesman", "PayPal AI Hackathon"],
    hed: "Talk through the job in your language. The customer gets a priced estimate in theirs.",
    foot: ["By Alexander Kashyap"],
  },
  {
    out: "projects/alexanderk-dev.jpg",
    kicker: ["This site", "Astro", "Cloudflare"],
    hed: "A static site that keeps its own numbers fresh",
    dek: "Can a static site stay current, and prove every page works, without a server to look after?",
    foot: ["By Alexander Kashyap"],
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const list = (items) => items.map(esc).join("<i> &middot; </i>");
const page = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Newsreader; font-weight: 400; src: url(${file("fonts/newsreader-text-400.woff2")}); }
  @font-face { font-family: Newsreader; font-weight: 600; src: url(${file("fonts/newsreader-display-600.woff2")}); }
  @font-face { font-family: Plex; font-weight: 500; src: url(${file("fonts/ibm-plex-mono-500.woff2")}); }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; background: #0d0b09; color: #EDE9E1; }
  body { position: relative; }
  .sky { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 42%; }
  /* Darker on the left, where the words are */
  .shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgb(13 11 9 / 0.9) 0%, rgb(13 11 9 / 0.72) 50%, rgb(13 11 9 / 0) 100%); }
  .card { position: absolute; inset: 64px 72px 56px; display: flex; flex-direction: column; text-shadow: 0 0 12px rgb(13 11 9 / 0.8); }
  .kicker, .foot { font: 500 22px/1.3 Plex; letter-spacing: 0.06em; text-transform: uppercase; }
  .kicker { color: #6FD39A; }
  .kicker i, .foot i { font-style: normal; color: #A39E94; }
  .name { margin-top: 18px; font: 600 112px/1 Newsreader; letter-spacing: -0.02em; }
  .hed { margin-top: 20px; max-width: 900px; font: 600 68px/1.06 Newsreader; letter-spacing: -0.015em; text-wrap: balance; }
  .rule { margin-top: 28px; width: 100%; border-top: 6px double #EDE9E1; }
  .dek { margin-top: 24px; max-width: 880px; font: 400 38px/1.3 Newsreader; color: #EDE9E1; }
  .hed + .rule + .dek { font-size: 32px; color: #C9C4BA; }
  .foot { margin-top: auto; display: flex; justify-content: space-between; color: #A39E94; }
  .foot b { font-weight: 500; color: #EDE9E1; }
</style></head><body>
  <img class="sky" src="${file("img/deep-field-1600.webp")}" alt="">
  <div class="shade"></div>
  <div class="card">
    <p class="kicker">${list(c.kicker)}</p>
    ${c.name ? `<p class="name">${esc(c.name)}</p>` : `<p class="hed">${esc(c.hed)}</p>`}
    <div class="rule"></div>
    ${c.dek ? `<p class="dek">${esc(c.dek)}</p>` : ""}
    <p class="foot"><b>alexanderk.dev</b><span>${list(c.foot)}</span></p>
  </div>
</body></html>`;

// Each card is written next to the fonts and photo it uses, opened, and photographed
const draft = path.join(root, "public", ".link-preview.html");
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const c of cards) {
  fs.writeFileSync(draft, page(c));
  await tab.goto(pathToFileURL(draft).href, { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  const out = path.join(root, "public", c.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await tab.screenshot({ path: out, type: "jpeg", quality: 86 });
  console.log(c.out, Math.round(fs.statSync(out).size / 1024) + " KB");
}
await browser.close();
fs.rmSync(draft);
