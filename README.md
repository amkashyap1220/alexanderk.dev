# alexanderk.dev

My personal site: my resume and projects, in a full-page terminal that works like zsh on a Mac. The site is navigated only by typing commands.

**Live:** [alexanderk.dev](https://alexanderk.dev)

## Try it

```
ls                     list files (ls -la for details)
cat resume.md          print my resume
cd projects            go into a folder (cd .., cd ~, cd -)
cat README.md          read about a project, from inside its folder
open linkedin.webloc   open a link in a new tab (github.webloc too)
```

Also: `pwd`, `history`, `clear` (Ctrl+L), `man <command>`, `echo`, `date`, `git status` / `git log` inside a project, Tab completion, ↑/↓ for history, Ctrl+C to cancel.

## Files

```
index.html       The page
css/style.css    All styling (colors at the top)
js/terminal.js   The terminal: pretend filesystem, commands, prompt
js/github.js     Live GitHub star / commit counts
files/           The Markdown files you can `cat` (resume, project READMEs)
wrangler.jsonc   Cloudflare settings
.assetsignore    Keeps README, config, and .git off the live site
```

No frameworks, no build step, nothing to install.

## How it works

- **Pretend filesystem.** `js/terminal.js` lists the folders and files at the top (`DIRS` and `FILES`):

  ```
  ~/resume.md  github.webloc  linkedin.webloc
  ~/projects/<project>/README.md  github.webloc
  ```

- **`cat`** prints a file's raw text, exactly like `cat` on a Mac. The `.md` files are real files in `files/`, loaded when the page opens.
- **`.webloc`** files are macOS website shortcuts. `open` opens them in a new tab. `open` on a text file points you to `cat`, since a real Mac would launch a text editor.
- **One page, no reloads.** `cd` just changes the current folder and updates the address bar (for example `/projects/switch-to-youtube`), so links can be shared. Cloudflare serves `index.html` for every address (`single-page-application` mode in `wrangler.jsonc`), and the terminal starts in the matching folder.

## Editing

- **Resume or a project write-up:** edit its `.md` file in `files/`.
- **Add a project:**
  1. Add it to `PROJECTS` at the top of `js/terminal.js`.
  2. Write `files/projects/<slug>/README.md`.
  3. Add a row to `tpl-projects-table` in `index.html`.
- **Colors:** change the variables at the top of `css/style.css`.

## Run locally

```
python -m http.server 8000
```

Then open http://localhost:8000. (Locally only `/` works on reload; addresses like `/projects/...` need Cloudflare's single-page mode.)

## Privacy

No phone number, email, street address, or resume download is published. In `files/resume.md` the phone and email are replaced with █ blocks.

## Deployment

Connected to a Cloudflare Worker through Workers Builds. Every push to `main` runs `npx wrangler deploy`, which reads `wrangler.jsonc` and uploads the site.
