# alexanderk.dev

My personal site: about me, my projects, my research, and stats from my GitHub.

**Live:** [alexanderk.dev](https://alexanderk.dev)

Built with [Astro](https://astro.build) into plain HTML, CSS and JavaScript, and hosted on Cloudflare. The most interactive pages, the Chicago home value map, the PA job market charts and the fitness dashboard, are built from [Svelte](https://svelte.dev) components.

## Building

`npm install`, then `npm run build` writes the site to `dist/`, which is what Cloudflare serves. `npm run dev` serves it locally while you edit. `wrangler deploy` (and `wrangler dev`) run the tests and then the build first, so deploys need no extra step, and a failing test stops the deploy.

| Where | What |
| --- | --- |
| `src/layouts/` | The page shell (head, header, footer) in `BaseLayout.astro`, plus the project and research post layouts built on it |
| `src/pages/` | One file per page; its path is the page's address |
| `src/data/` | The projects and research posts; their pages, the Work page's lists, the Research page and `/sitemap.xml` are built from these. `person.ts` describes me for search engines |
| `src/components/`, `src/styles/` | Small shared pieces (the folded README, Fig. 1 of Open Tradesman, "Off the clock" with my photos) and page styles: `editorial.css` for what most pages share, and one stylesheet per page's own layout (`home.css`, `about.css`, `work.css`, `research.css`, `stats.css`, `private.css`) |
| `src/components/home-value/` | The Chicago home value map, chart, table and form (Svelte), loaded only on that post. Its opening summary and the drive times to the sample workplace are worked out when the site is built, so the page doesn't jump when the data loads and the full drive time grid loads only when a reader names another workplace |
| `src/components/fitness/` | The fitness dashboard: one Svelte component per panel, loaded only on that page |
| `src/components/pa-jobs/` | The PA job market post's map and charts (Svelte + Observable Plot), reading `public/research/pa-job-market.json`. Each has its numbers as a folded table under it |
| `public/` | Copied to the site as is: `css/style.css`, the browser scripts in `js/`, images and data files, `robots.txt`, and `_headers` (how long browsers may cache fonts, photos and Astro's bundles) |
| `scripts/link-previews.mjs` | Makes the link-preview images (`public/og.jpg`, and `public/projects/<slug>.jpg` for projects with a `preview`); run it after changing one of their headlines (it needs Playwright, see the top of the file) |
| `worker/` | The Cloudflare Worker: GitHub data, the private section's unlock code and the fitness API (never uploaded as a file) |

To add a project: add an entry to `src/data/projects.ts` (its `tier` puts it under Featured, More work or Archive on the Work page), then copy one of the pages in `src/pages/projects/` to `<slug>.astro` and write its sections. To add a research post, follow the steps at the top of `src/pages/research/_template.astro`.

I used AI to help write the text on this site.

## Design

An editorial look, dark only: headlines in Newsreader, text in Libre Franklin, and labels and dates in IBM Plex Mono, all self-hosted from `public/fonts/` (Latin only, with their licenses). One accent color, a green called Forest. Every color and font is a CSS variable at the top of `public/css/style.css`; the homepage's and the Work pages' layouts are in `src/styles/`. Every page has the same header (Work, Research, About, Resume, Email) and footer; the footer's lock icon opens the unlock box.

Behind every page is Hubble's [Pillars of Creation](https://esahubble.org/images/heic1501a/) (`public/img/pillars-*.webp`, already dimmed), by NASA, ESA/Hubble and the Hubble Heritage Team, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Text gets a soft dark edge over it, and charts, maps, tables and code sit on solid panels. The photos in "Off the clock", on the homepage and the About page, are my own (`public/img/photos/`). `public/resume.pdf` is my resume.

## Tests

`npm test` runs the tests in `tests/` (after `npm install`). They build the site and check every page (title, description, header, footer, link previews, canonical links, structured data) and that every internal link and file exists at its clean address, that the sitemap lists exactly the public pages, and that no page shows a phone number. They also cover the unlock code and private section, the fitness dashboard's API, and the Chicago home value scoring in `public/js/chicago-home-value-model.js` (plain JavaScript the map's components call), checking it ranks the sample values exactly as the Python in [Home-Value-Score](https://github.com/amkashyap1220/Home-Value-Score) does.

## Fitness tracking (private)

`/private/fitness-tracking` is a dashboard for my workouts, built from the Svelte components in `src/components/fitness/` (`Dashboard.svelte` loads the data and lays out the panels). The data is in a separate repo (`fitness-data`), never in this one: `worker/fitness.js` reads it through the GitHub API, behind the unlock code. It needs one more Worker secret, `FITNESS_GITHUB_TOKEN`: a fine-grained GitHub token with access to `fitness-data` only, Contents read and write.

