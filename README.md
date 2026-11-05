# alexanderk.dev

My personal site: my work, my research, a bit about me, and live stats from my GitHub.

**Live:** [alexanderk.dev](https://alexanderk.dev)

## How it's built

- **[Astro](https://astro.build)** turns the pages into plain HTML, CSS and a little JavaScript.
- **[Svelte](https://svelte.dev)** powers the interactive pages: the Chicago home value map, the PA job market charts and my fitness dashboard.
- **[Cloudflare Workers](https://workers.cloudflare.com)** host the site. A small Worker keeps the GitHub numbers fresh and guards the private pages.

## Run it

```sh
npm install
npm run dev     # local site at http://localhost:4321
npm test        # build the site and check every page
npm run build   # write the site to dist/
```

Deploying runs the tests first, so a failing test stops the deploy.

## Where things are

| Folder | What's in it |
| --- | --- |
| `src/pages/` | One file per page. The file's path is the page's address. |
| `src/data/` | The lists of projects and research posts that the pages are built from. |
| `src/layouts/` | The shared page frame (header and footer), plus the project and research post layouts. |
| `src/components/` | Pieces shared by several pages, and the Svelte components for the map, charts and dashboard. |
| `src/styles/` | The styles. `site.css` holds the colors, fonts, header and footer. |
| `public/` | Files served as they are: images, fonts, data, scripts and the resume. |
| `worker/` | The Cloudflare Worker. |
| `tests/` | The tests. |

## Adding things

- **A project:** add it to `src/data/projects.ts`, then copy a page in `src/pages/repositories/` to `<slug>.astro` and fill it in.
- **A research post:** follow the steps at the top of `src/pages/lab/_template.astro`.

## Secrets

The Worker needs these, set with `wrangler secret put`:

- `GITHUB_TOKEN`: reads my public GitHub data.
- `UNLOCK_CODE`: the code for the private section.
- `FITNESS_GITHUB_TOKEN`: reads and writes the separate `fitness-data` repo for the fitness dashboard.

## Credits

- Fonts: Newsreader, Libre Franklin and IBM Plex Mono, all open source, served from `public/fonts/`.
- Top photo: a sunset over Lisle, Illinois, my own photo, dimmed.
- Technology logos: [Simple Icons](https://simpleicons.org) (CC0).
- The photos are my own.
- I used AI to help write the text on this site.
