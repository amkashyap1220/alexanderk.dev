/* ==========================================================================
   READMEs for the project pages (needs js/gh.js), and GitHub numbers for
   any page that asks for them.

     <b data-gh="owner/repo" data-field="stars|commits|language|updated">--</b>
     <div data-readme="owner/repo">...</div>

   A README inside a folded <details> ("From the repo") loads the first time
   it's opened, so the page doesn't download the GitHub data until then.
   Anything left as "--" means that repo isn't in /data/github.json (yet).
   ========================================================================== */

(function () {
  const { repo, readme, timeAgo, languageColor } = window.GH;

  function show(data, field) {
    if (field === "stars") return String(data.stars);
    if (field === "commits") return String(data.commits);
    if (field === "language") return data.language || "--";
    if (field === "updated") return data.pushed ? timeAgo(data.pushed) : "--";
    return "--";
  }

  document.querySelectorAll("[data-gh]").forEach((el) => {
    el.textContent = "...";
    repo(el.dataset.gh)
      .then((data) => {
        el.textContent = show(data, el.dataset.field);
        const color = el.dataset.field === "language" && languageColor(data.language);
        if (color) el.style.setProperty("--lang", color);   // CSS draws a dot in this color
      })
      .catch(() => { el.textContent = "--"; });
  });

  // A README's relative image and link paths point inside its repo, so send them to GitHub
  function fixPaths(box, name) {
    const inRepo = (path) => !/^(https?:|mailto:|data:|#)/.test(path);
    const clean = (path) => path.replace(/^\.?\//, "");
    box.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src");
      if (inRepo(src)) img.src = "https://raw.githubusercontent.com/" + name + "/HEAD/" + clean(src);
      if (!img.hasAttribute("alt")) img.alt = "";   // README images without alt text are treated as decoration
      img.loading = "lazy";
    });
    box.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (href.startsWith("#")) return;
      if (inRepo(href)) a.href = "https://github.com/" + name + "/blob/HEAD/" + clean(href);
      a.target = "_blank";
      a.rel = "noopener";
    });
  }

  // The README sits under the page's own "From the repo" heading (an <h2>), so
  // its headings move down two levels (h1 -> h3) to keep the page outline in order
  function demoteHeadings(box) {
    box.querySelectorAll("h1, h2, h3, h4").forEach((h) => {
      const level = Math.min(6, Number(h.tagName[1]) + 2);
      const lower = document.createElement("h" + level);
      [...h.attributes].forEach((attr) => lower.setAttribute(attr.name, attr.value));
      lower.append(...h.childNodes);
      h.replaceWith(lower);
    });
  }

  function load(box) {
    const name = box.dataset.readme;
    box.setAttribute("aria-busy", "true");
    box.textContent = "";
    box.append(window.GH.el("p", "muted", "Loading the README from GitHub\u2026"));
    readme(name)
      .then((html) => {
        box.innerHTML = html;   // sanitized by GitHub's renderer
        fixPaths(box, name);
        demoteHeadings(box);
      })
      .catch(() => {
        box.textContent = "";
        const p = window.GH.el("p", "muted", "Couldn't load the README right now. ");
        const link = window.GH.el("a", null, "Read it on GitHub");
        link.href = "https://github.com/" + name + "#readme";
        p.append(link, ".");
        box.append(p);
      })
      .finally(() => box.setAttribute("aria-busy", "false"));
  }

  document.querySelectorAll("[data-readme]").forEach((box) => {
    const fold = box.closest("details");
    if (!fold) return load(box);
    if (fold.open) return load(box);
    fold.addEventListener("toggle", () => { if (fold.open) load(box); }, { once: true });
  });
})();
