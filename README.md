# alexanderk.dev

My personal site: resume and projects on a green-phosphor CRT terminal. Every page has a working `COMMAND?` prompt, so you can navigate by typing (`HELP`, `DIR`, `CD PROJECTS`, `OPEN SWITCH-TO-YOUTUBE`, `1`, `RESUME`...) or just click.

**Live:** [alexanderk.dev](https://alexanderk.dev)

## Built with

- Plain HTML, CSS, and JavaScript (no frameworks, no build step)
- GitHub REST API for live star and commit counts on project pages
- Cloudflare Workers (static assets), redeployed automatically on every push to `main`

## Project structure

```
index.html                           About / resume
assets/Alexander_Kashyap_Resume.pdf  Downloadable resume
projects/index.html                  Project list
projects/<project>/index.html        One page per project
css/style.css                        All styles (theme colors at the top)
js/github.js                         Live GitHub stats
js/terminal.js                       Command prompt and boot screen
404.html                             Not-found page
wrangler.jsonc, .assetsignore        Cloudflare deploy config
```

## Run locally

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Add a project

1. Copy `projects/switch-to-youtube/` to a new folder and edit the content.
2. Point the live stats at the repo: `<span data-gh="owner/repo" data-field="stars"></span>` (fields: stars, commits, language, updated).
3. Add a row to the table and a README entry in `projects/index.html`.
4. Add it to the `PROJECTS` list at the top of `js/terminal.js` so `DIR` and `OPEN` know about it.

## Update the resume

Replace `assets/Alexander_Kashyap_Resume.pdf` with a new PDF of the same name.

## Deployment

Connected to a Cloudflare Worker through Workers Builds. Every push to `main` runs `npx wrangler deploy`, which reads `wrangler.jsonc` and uploads the site. `.assetsignore` keeps non-site files (README, config, `.git`) from being published.
