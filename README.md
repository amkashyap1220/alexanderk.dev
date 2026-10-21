# alexanderk.dev

My personal site: an About page with my resume info, and a Projects page with live GitHub stats.

**Live:** [alexanderk.dev](https://alexanderk.dev)

## Files

```
index.html       About: summary, experience, education, skills
projects.html    Projects, with live stars / commits / language / last update
css/style.css    All styling (colors at the top; dark mode follows the system)
js/github.js     Fills in the GitHub stats
wrangler.jsonc   Cloudflare settings
.assetsignore    Keeps README, config, and .git off the live site
```

Plain HTML, CSS, and JavaScript. No frameworks, no build step.

## Editing

- **Resume info:** edit `index.html`.
- **Add a project:** copy an `<article class="project">` in `projects.html` and change the repo name in each `data-gh="owner/repo"`.

GitHub stats come from GitHub's public API (no key) and are cached in the browser for 30 minutes, since GitHub allows 60 requests an hour.

## Run locally

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Privacy

No phone number, email, street address, or resume download is published.

## Deployment

Connected to a Cloudflare Worker through Workers Builds. Every push to `main` runs `npx wrangler deploy`, which uploads the site.
