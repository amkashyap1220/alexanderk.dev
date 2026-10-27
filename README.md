# alexanderk.dev

My personal site: about me, my projects, my research, and stats from my GitHub.

**Live:** [alexanderk.dev](https://alexanderk.dev)

Built with [Astro](https://astro.build) into plain HTML, CSS and JavaScript, and hosted on Cloudflare. The two most interactive pages, the Chicago home value map and the fitness dashboard, are built from [Svelte](https://svelte.dev) components.

## Building

`npm install`, then `npm run build` writes the site to `dist/`, which is what Cloudflare serves. `npm run dev` serves it locally while you edit. `wrangler deploy` (and `wrangler dev`) run the build first, so deploys need no extra step.

| Where | What |
| --- | --- |
| `src/layouts/` | The page shell (head, header, footer) in `BaseLayout.astro`, plus the project and research post layouts built on it |
| `src/pages/` | One file per page; its path is the page's address |
| `src/data/` | The projects and research posts; their pages and the Projects and Research cards are built from these |
| `src/components/`, `src/styles/` | Small shared pieces (README, chips, GitHub numbers) and page-only styles |
| `src/components/home-value/` | The Chicago home value map, chart, table and form (Svelte), loaded only on that post |
| `src/components/fitness/` | The fitness dashboard: one Svelte component per panel, loaded only on that page |
| `public/` | Copied to the site as is: `css/style.css`, the browser scripts in `js/`, images and data files |
| `worker/` | The Cloudflare Worker: GitHub data, login and the fitness API (never uploaded as a file) |

To add a project: add an entry to `src/data/projects.ts`, then copy one of the pages in `src/pages/projects/` to `<slug>.astro` and write its sections. To add a research post, follow the steps at the top of `src/pages/research/_template.astro`.

I used AI to help write the text on this site.

## Tests

`npm test` runs the tests in `tests/` (after `npm install`). They build the site and check every page (title, description, header, footer, link previews) and that every internal link and file exists at its clean address. They also cover the login and private section, the fitness dashboard's API, and the Chicago home value scoring in `public/js/chicago-home-value-model.js` (plain JavaScript the map's components call), checking it ranks the sample values exactly as the Python in [Home-Value-Score](https://github.com/amkashyap1220/Home-Value-Score) does.

## Fitness tracking (private)

`/private/fitness-tracking` is a dashboard for my workouts, built from the Svelte components in `src/components/fitness/` (`Dashboard.svelte` loads the data and lays out the panels). The data is in a separate private repo (`fitness-data`), never in this one: `worker/fitness.js` reads it through the GitHub API, behind the login. It needs one more Worker secret, `FITNESS_GITHUB_TOKEN`: a fine-grained GitHub token with access to `fitness-data` only, Contents read and write.

