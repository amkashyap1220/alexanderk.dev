# alexanderk.dev

My personal site: about me and my projects, inside a macOS Terminal window running a small zsh look-alike. The site is navigated only by typing commands.

**Live:** [alexanderk.dev](https://alexanderk.dev)

## Try it

```
help                 every command
ls / ls -la          list files
cd projects          change directory (cd .., cd ~, cd -)
cat about.txt        print a file
open linkedin.webloc open a link in a new tab (github.webloc in ~ and each project)
neofetch             the quick version
```

Also: `pwd`, `history`, `clear` (Ctrl+L), `man <cmd>`, `echo`, `date`, `git status`, Tab completion, ↑/↓ history, Ctrl+C. Shortcuts: `about`, `experience`, `education`, `skills`, `projects`, `linkedin`, `github`.

## Built with

- Plain HTML, CSS, and JavaScript (no frameworks, no build step)
- GitHub REST API for live star and commit counts
- Cloudflare Workers (static assets), redeployed automatically on every push to `main`

## How it's organized

It's a single page: the whole browser tab is the terminal, and `cd` changes directory in place without reloading. The address bar follows the current directory (`/projects/switch-to-youtube`), so links can be shared; Cloudflare serves `index.html` for every path (`not_found_handling: single-page-application`) and the terminal opens in the matching directory.

The terminal has a virtual filesystem rooted at `~`:

```
~/about.txt  experience.txt  education.txt  skills.txt  github.webloc  linkedin.webloc
~/projects/<project>/README.md  github.webloc
```

`.webloc` files are macOS website shortcuts (an XML property list holding one URL). `open` opens them in a new tab; `open` on a text file points you to `cat` instead, since a real Mac would launch a text editor.

```
index.html               The page; file contents live in <template id="tpl-..."> tags
css/style.css            Terminal styles (colors at the top)
js/terminal.js           The shell: filesystem, commands, prompt
js/github.js             Live GitHub stats
tools/build_pages.py     Generates index.html
wrangler.jsonc           Cloudflare config (single-page mode)
.assetsignore            Keeps README, tools, config, .git off the live site
```

## Editing content

Edit file contents (about, experience, skills, project READMEs) in `tools/build_pages.py`, then regenerate:

```
python tools/build_pages.py .
```

## Add a project

1. Add it to `PROJECTS` at the top of `js/terminal.js`.
2. In `tools/build_pages.py`, add its README template and a row in the projects table.
3. Run `python tools/build_pages.py .`

## Run locally

```
python -m http.server 8000
```

Then open http://localhost:8000. (Locally, only `/` works on reload; deep links like `/projects/...` need Cloudflare's single-page mode.)

## Privacy

No resume download, phone number, email, or street address is published here. Only information already public on LinkedIn and GitHub is shown.

## Deployment

Connected to a Cloudflare Worker through Workers Builds. Every push to `main` runs `npx wrangler deploy`, which reads `wrangler.jsonc` and uploads the site. `.assetsignore` keeps non-site files (README, tools, config, `.git`) from being published.
