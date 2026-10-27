# alexanderk.dev

My personal site: about me, my projects, my research, and stats from my GitHub.

**Live:** [alexanderk.dev](https://alexanderk.dev)

Built with [Astro](https://astro.build) into plain HTML, CSS and JavaScript, and hosted on Cloudflare.

## Building

`npm install`, then `npm run build` writes the site to `dist/`, which is what Cloudflare serves. `wrangler deploy` (and `wrangler dev`) run the build first, so deploys need no extra step.

The page shell (head, header, footer) lives once in `src/layouts/BaseLayout.astro`. Pages in `src/pages/` use it; the rest are still plain files in `public/`, copied to `dist/` as is, and move over a few at a time.

To add a project: add an entry to `src/data/projects.ts` (it feeds the Projects page card and the page's header, live GitHub numbers and README), then copy one of the pages in `src/pages/projects/` to `<slug>.astro` and write its sections. To add a research post, follow the steps at the top of `src/pages/research/_template.astro`.

The Worker (`worker/`) and the tests are never uploaded.

I used AI to help write the text on this site.

## Tests

`npm test` (or `node --test`) runs the tests in `tests/` (no install needed). They cover the login and private section, the fitness dashboard's API, and the Chicago home value scoring in `public/js/chicago-home-value-model.js` and check it ranks the sample values exactly as the Python in [Home-Value-Score](https://github.com/amkashyap1220/Home-Value-Score) does.

## Fitness tracking (private)

`/private/fitness-tracking` is a dashboard for my workouts. The data is in a separate private repo (`fitness-data`), never in this one: `worker/fitness.js` reads it through the GitHub API, behind the login. It needs one more Worker secret, `FITNESS_GITHUB_TOKEN`: a fine-grained GitHub token with access to `fitness-data` only, Contents read and write.

