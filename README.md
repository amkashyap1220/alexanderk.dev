# alexanderk.dev

My personal site: an About page with my resume info, and a Projects page with live GitHub stats.

**Live:** [alexanderk.dev](https://alexanderk.dev)

## Files

```
index.html                     About: summary, experience, education, skills
projects/index.html            Projects list, with live stars / commits / language / last update
projects/<project>.html        One page per project: its GitHub README, then "How it works"
css/style.css                  All styling: Fira Code, color tokens at the top (light + .dark)
js/theme.js                    Light/dark toggle (remembers the choice; defaults to the system setting)
js/github.js                   Fills in GitHub stats and READMEs
wrangler.jsonc                 Cloudflare settings
.assetsignore                  Keeps README, config, and .git off the live site
```

Plain HTML, CSS, and JavaScript. No frameworks, no build step.

## Editing

- **Resume info:** edit `index.html`.
- **Add a project:**
  1. Copy an `<article class="project">` in `projects/index.html`, change the repo name in each `data-gh="owner/repo"`, and link it to the new page.
  2. Copy a page in `projects/` (for example `switch-to-youtube.html`) and change the name and every `owner/repo`.
- **Project README:** edit the README in that project's GitHub repo. The site loads it live.
- **How it works:** each project page has a marked `#how-it-works` section for your own HTML, CSS, and JS.

GitHub stats and READMEs come from GitHub's public API (no key) and are cached in the browser for 30 minutes, since GitHub allows 60 requests an hour.

## Run locally

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Privacy

No phone number, email, street address, or resume download is published.

## Deployment

Connected to a Cloudflare Worker through Workers Builds. Every push to `main` runs `npx wrangler deploy`, which uploads the site.
