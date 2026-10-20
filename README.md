# alexanderk.dev

My personal site: resume, projects, and write-ups explaining how each project works.

**Live:** [alexanderk.dev](https://alexanderk.dev)

## Built with

- Plain HTML, CSS, and JavaScript (no frameworks, no build step)
- GitHub REST API for live star and commit counts on project pages
- Cloudflare Pages for hosting, with automatic deploys on every push to `main`

## Project structure

```
index.html                     About / resume
projects/index.html            Project list
projects/<project>/index.html  One page per project
css/style.css                  All styles (theme colors at the top)
js/github.js                   Live GitHub stats
404.html                       Not-found page
```

## Run locally

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Adding a project

1. Copy `projects/switch-to-youtube/` to a new folder and edit the content.
2. Set `data-repo="owner/repo"` on the `.gh-stats` element to show live stats.
3. Add a card for it in `projects/index.html`.

## Deployment

Connected to Cloudflare Pages. Every push to `main` redeploys the site automatically.
