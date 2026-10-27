# alexanderk.dev

My personal site: about me, my projects, my research, and stats from my GitHub.

**Live:** [alexanderk.dev](https://alexanderk.dev)

Plain HTML, CSS and JavaScript, built with [Astro](https://astro.build) and hosted on Cloudflare.

## Building

`npm install`, then `npm run build` writes the site to `dist/`, which is what Cloudflare serves. `wrangler deploy` (and `wrangler dev`) run the build first, so deploys need no extra step.

The pages are still plain files in `public/`, copied to `dist/` as is. They move into `src/` as they get shared layouts. The Worker (`worker/`), the tests and `templates/` are never uploaded.

I used AI to help write the text on this site.

## Tests

`npm test` (or `node --test`) runs the tests in `tests/` (no install needed). They cover the login and private section, the fitness dashboard's API, and the Chicago home value scoring in `public/js/chicago-home-value-model.js` and check it ranks the sample values exactly as the Python in [Home-Value-Score](https://github.com/amkashyap1220/Home-Value-Score) does.

## Fitness tracking (private)

`/private/fitness-tracking` is a dashboard for my workouts. The data is in a separate private repo (`fitness-data`), never in this one: `worker/fitness.js` reads it through the GitHub API, behind the login. It needs one more Worker secret, `FITNESS_GITHUB_TOKEN`: a fine-grained GitHub token with access to `fitness-data` only, Contents read and write.

