/* ==========================================================================
   Live GitHub stats
   Any element like <span data-gh="owner/repo" data-field="stars"></span>
   gets filled in. Fields: stars, commits, language, updated.
   Optional data-width="N" pads the value to N characters (for tables).

   Content printed later by the terminal calls window.GH.fill(element).
   Uses GitHub's public API (no key needed). Results are cached in the
   visitor's browser for 30 minutes, since GitHub allows 60 requests/hour
   per visitor without a key.
   ========================================================================== */

(function () {
  const CACHE_MINUTES = 30;
  const API = "https://api.github.com/repos/";
  const pending = {};

  function readCache(repo) {
    try {
      const item = JSON.parse(localStorage.getItem("gh:" + repo) || "null");
      if (!item || Date.now() - item.time > CACHE_MINUTES * 60 * 1000) return null;
      return item.data;
    } catch (e) {
      return null;
    }
  }

  function writeCache(repo, data) {
    try {
      localStorage.setItem("gh:" + repo, JSON.stringify({ time: Date.now(), data }));
    } catch (e) {
      /* storage unavailable — fine, we just won't cache */
    }
  }

  // GitHub doesn't return a total commit count directly. Asking for 1 commit
  // per page and reading the page number of the "last" link gives the total.
  async function countCommits(repo) {
    const res = await fetch(API + repo + "/commits?per_page=1");
    if (!res.ok) throw new Error("commits " + res.status);
    const link = res.headers.get("Link");
    if (link) {
      const match = link.match(/[?&]page=(\d+)>; rel="last"/);
      if (match) return Number(match[1]);
    }
    const list = await res.json();
    return list.length;
  }

  function load(repo) {
    if (pending[repo]) return pending[repo];
    pending[repo] = (async () => {
      const cached = readCache(repo);
      if (cached) return cached;
      const res = await fetch(API + repo);
      if (!res.ok) throw new Error("repo " + res.status);
      const info = await res.json();
      const commits = await countCommits(repo);
      const data = { stars: info.stargazers_count, language: info.language, pushed: info.pushed_at, commits };
      writeCache(repo, data);
      return data;
    })();
    return pending[repo];
  }

  function timeAgo(iso) {
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "1 day ago";
    if (days < 30) return days + " days ago";
    const months = Math.floor(days / 30);
    if (months < 12) return months + (months === 1 ? " month ago" : " months ago");
    const years = Math.floor(months / 12);
    return years + (years === 1 ? " year ago" : " years ago");
  }

  function value(d, field) {
    if (field === "stars") return String(d.stars);
    if (field === "commits") return String(d.commits);
    if (field === "language") return d.language || "--";
    if (field === "updated") return d.pushed ? timeAgo(d.pushed) : "--";
    return "--";
  }

  function put(el, text) {
    const w = Number(el.dataset.width || 0);
    if (w && text.length > w) text = text.slice(0, w - 1) + "\u2026";   // keep table columns aligned
    el.textContent = w ? (el.dataset.align === "left" ? text.padEnd(w) : text.padStart(w)) : text;
  }

  function fill(scope) {
    const byRepo = {};
    (scope || document).querySelectorAll("[data-gh][data-field]").forEach((el) => {
      (byRepo[el.dataset.gh] = byRepo[el.dataset.gh] || []).push(el);
    });
    Object.keys(byRepo).forEach((repo) => {
      const els = byRepo[repo];
      els.forEach((el) => put(el, "..."));
      load(repo)
        .then((d) => els.forEach((el) => put(el, value(d, el.dataset.field))))
        .catch(() => els.forEach((el) => put(el, "--")));
    });
  }

  window.GH = { fill };
  fill(document);
})();
