# alexanderk.dev

My development site: Currently an about page with my info and a projects page.

**Live:** [alexanderk.dev](https://alexanderk.dev)

## Files

```
index.html                     About: summary, experience, education, skills
projects/index.html            Projects list 
projects/<project>.html        One page per project: its GitHub README, then a "Walkthrough"
writing/                       Writing: list of posts + _template.html for new ones
stats/index.html               GitHub Stats: live numbers, languages and activity from GitHub
css/style.css                  All styling (colors, spacing and type sizes at the top)
js/theme.js                    Light/dark: follows the visitor's system, toggle overrides
js/gh.js                       Shared GitHub fetching: reads /data/github.json, else live + 30-minute cache
js/github.js                   Fills in GitHub stats and READMEs
js/stats.js                    Fetches and draws the Stats page
worker/index.js                Cloudflare script: refreshes GitHub data every 5 min, serves /data/github.json
404.html, favicon*.svg         Not-found page and tab icons (light, dark)
wrangler.jsonc                 Cloudflare settings
.assetsignore                  Keeps README, config, and .git off the live site
```

## Editing

- **Resume info:** `index.html`.
- **Add a project:**
  1. Copy an `<article class="card project">` in `projects/index.html`, change the repo name in each `data-gh="owner/repo"`, and link it to the new page.
  2. Copy a page in `projects/` (for example `switch-to-youtube.html`) and change the name and every `owner/repo`.
- **New post:** copy `writing/_template.html`, then add it to the list in `writing/index.html`.
- **WIP** each project page has a marked `#walkthrough`

## Deployment
Connected to a Cloudflare Worker through Workers Builds. Every push to main runs npx wrangler deploy, which uploads the site.

The GitHub data needs a `GITHUB_TOKEN` secret on the Worker (Settings > Variables and Secrets): a fine-grained GitHub token with read-only access to public repos.