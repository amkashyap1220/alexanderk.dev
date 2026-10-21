/* ==========================================================================
   Live GitHub stats
   Fills in any element like:
     <span data-gh="owner/repo" data-field="stars"></span>
   Fields: stars, commits, language, updated.

   Also fills in a project's README, as GitHub shows it:
     <div data-readme="owner/repo"></div>

   Uses GitHub's public API (no key needed). Answers are saved in the
   browser for 30 minutes, because GitHub allows 60 requests an hour.
   ========================================================================== */

(function () {
  const CACHE_MINUTES = 30;
  const API = "https://api.github.com/repos/";
  const requests = {};   // one request per repo, shared by everything on the page

  function cached(repo) {
    try {
      const saved = JSON.parse(localStorage.getItem("gh:" + repo));
      if (saved && Date.now() - saved.time < CACHE_MINUTES * 60 * 1000) return saved.data;
    } catch (e) { /* storage blocked: just fetch */ }
    return null;
  }

  function save(repo, data) {
    try { localStorage.setItem("gh:" + repo, JSON.stringify({ time: Date.now(), data })); } catch (e) { /* ignore */ }
  }

  // GitHub doesn't give a total commit count directly. Asking for 1 commit per
  // page and reading the number of the last page gives the total.
  async function countCommits(repo) {
    const res = await fetch(API + repo + "/commits?per_page=1");
    if (!res.ok) throw new Error("GitHub error " + res.status);
    const last = (res.headers.get("Link") || "").match(/[?&]page=(\d+)>; rel="last"/);
    return last ? Number(last[1]) : (await res.json()).length;
  }

  function load(repo) {
    requests[repo] = requests[repo] || (async () => {
      const hit = cached(repo);
      if (hit) return hit;
      const res = await fetch(API + repo);
      if (!res.ok) throw new Error("GitHub error " + res.status);
      const info = await res.json();
      const data = { stars: info.stargazers_count, language: info.language, pushed: info.pushed_at, commits: await countCommits(repo) };
      save(repo, data);
      return data;
    })();
    return requests[repo];
  }

  function timeAgo(date) {
    const days = Math.floor((Date.now() - new Date(date)) / 86400000);
    if (days < 1) return "today";
    if (days < 30) return days + (days === 1 ? " day ago" : " days ago");
    const months = Math.floor(days / 30);
    if (months < 12) return months + (months === 1 ? " month ago" : " months ago");
    const years = Math.floor(months / 12);
    return years + (years === 1 ? " year ago" : " years ago");
  }

  function show(data, field) {
    if (field === "stars") return String(data.stars);
    if (field === "commits") return String(data.commits);
    if (field === "language") return data.language || "--";
    if (field === "updated") return data.pushed ? timeAgo(data.pushed) : "--";
    return "--";
  }

  function fill(scope) {
    scope.querySelectorAll("[data-gh]").forEach((el) => {
      el.textContent = "...";
      load(el.dataset.gh)
        .then((data) => { el.textContent = show(data, el.dataset.field); })
        .catch(() => { el.textContent = "--"; });
    });
  }

  // README: GitHub's API returns it already turned into HTML (and made safe by GitHub)
  async function loadReadme(repo) {
    const key = repo + ":readme";
    const hit = cached(key);
    if (hit) return hit;
    const res = await fetch(API + repo + "/readme", { headers: { Accept: "application/vnd.github.html+json" } });
    if (!res.ok) throw new Error("GitHub error " + res.status);
    const html = await res.text();
    save(key, html);
    return html;
  }

  function fillReadme(el) {
    const repo = el.dataset.readme;
    loadReadme(repo)
      .then((html) => {
        el.innerHTML = html;
        // Relative images and links in a README point inside the repo, so point them at GitHub
        el.querySelectorAll("img[src]").forEach((img) => {
          const src = img.getAttribute("src");
          if (!/^(https?:|data:)/.test(src)) img.src = "https://raw.githubusercontent.com/" + repo + "/HEAD/" + src.replace(/^\.?\//, "");
        });
        el.querySelectorAll("a[href]").forEach((a) => {
          const href = a.getAttribute("href");
          if (href.startsWith("#")) return;
          if (!/^(https?:|mailto:)/.test(href)) a.href = "https://github.com/" + repo + "/blob/HEAD/" + href.replace(/^\.?\//, "");
          a.target = "_blank";
          a.rel = "noopener";
        });
      })
      .catch(() => {
        el.innerHTML = '<p class="muted">Couldn\'t load the README right now. <a href="https://github.com/' + repo + '#readme">Read it on GitHub</a>.</p>';
      });
  }

  fill(document);
  document.querySelectorAll("[data-readme]").forEach(fillReadme);
})();
