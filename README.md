# alexanderk.dev

My personal site: resume and projects inside a macOS Terminal window running a small zsh look-alike. The site is navigated only by typing commands.

**Live:** [alexanderk.dev](https://alexanderk.dev)

## Try it

```
help                 every command
ls / ls -la          list files
cd projects          change directory (cd .., cd ~, cd -)
cat about.txt        print a file
open resume.pdf      download the resume (open linkedin.url, open github.url)
neofetch             the quick version
```

Also: `pwd`, `history`, `clear` (Ctrl+L), `man <cmd>`, `echo`, `date`, `git status`, Tab completion, ↑/↓ history, Ctrl+C. Shortcuts: `about`, `experience`, `education`, `skills`, `projects`, `resume`, `linkedin`, `github`.

## Built with

- Plain HTML, CSS, and JavaScript (no frameworks, no build step)
- GitHub REST API for live star and commit counts
- Cloudflare Workers (static assets), redeployed automatically on every push to `main`

## How it's organized

The terminal has a virtual filesystem rooted at `~`:

```
~/about.txt  experience.txt  education.txt  skills.txt  resume.pdf  linkedin.url
~/projects/<project>/README.md  github.url
```

Every directory is a real page so links can be shared. The pages are identical shells that differ only in `<body data-cwd="...">`; all file contents live in `<template id="tpl-...">` tags on every page.

```
index.html                           ~
projects/index.html                  ~/projects
projects/<project>/index.html        ~/projects/<project>
404.html                             not-found page
assets/Alexander_Kashyap_Resume.pdf  resume.pdf
css/style.css                        Terminal styles (colors at the top)
js/terminal.js                       The shell: filesystem, commands, prompt
js/github.js                         Live GitHub stats
tools/build_pages.py                 Generates the HTML pages
wrangler.jsonc, .assetsignore        Cloudflare deploy config
```

## Editing content

File contents (about, experience, skills, project READMEs) are repeated on every page, so edit them in `tools/build_pages.py` and regenerate all pages:

```
python tools/build_pages.py .
```

## Add a project

1. Add it to `PROJECTS` at the top of `js/terminal.js`.
2. In `tools/build_pages.py`, add its README template, a row in the projects table, and a `page(...)` call.
3. Run `python tools/build_pages.py .`

## Run locally

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Update the resume

Replace `assets/Alexander_Kashyap_Resume.pdf` with a new PDF of the same name.

## Deployment

Connected to a Cloudflare Worker through Workers Builds. Every push to `main` runs `npx wrangler deploy`, which reads `wrangler.jsonc` and uploads the site. `.assetsignore` keeps non-site files (README, tools, config, `.git`) from being published.
