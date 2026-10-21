# alexanderk.dev

My development site: Currently an about page with my info and a projects page.

**Live:** [alexanderk.dev](https://alexanderk.dev)

## Files

```
index.html                     About: summary, experience, education, skills
projects/index.html            Projects list 
projects/<project>.html        One page per project: its GitHub README, then "How it works"
css/style.css                  All styling (colors at the top; dark mode follows the system)
js/github.js                   Fills in GitHub stats and READMEs
wrangler.jsonc                 Cloudflare settings
.assetsignore                  Keeps README, config, and .git off the live site
```

## Editing

- **Resume info:** `index.html`.
- **Add a project:**
  1. Copy an `<article class="project">` in `projects/index.html`, change the repo name in each `data-gh="owner/repo"`, and link it to the new page.
  2. Copy a page in `projects/` (for example `switch-to-youtube.html`) and change the name and every `owner/repo`.
- **WIP** each project page has a marked `#how-it-works`

## Deployment
Connected to a Cloudflare Worker through Workers Builds. Every push to main runs npx wrangler deploy, which uploads the site.