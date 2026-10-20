/* ==========================================================================
   Live GitHub stats
   Any element like <div class="gh-stats" data-repo="owner/repo"></div>
   gets filled with stars, commit count, main language and last update.

   Uses GitHub's public API (no key needed). Results are cached in the
   visitor's browser for 30 minutes, since GitHub allows 60 requests/hour
   per visitor without a key.
   ========================================================================== */

(function () {
  const CACHE_MINUTES = 30;
  const API = "https://api.github.com/repos/";

  const icons = {
    star: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>',
    commit: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>',
    code: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"/></svg>',
    clock: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/></svg>',
  };

  function readCache(repo) {
    try {
      const raw = localStorage.getItem("gh:" + repo);
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (Date.now() - item.time > CACHE_MINUTES * 60 * 1000) return null;
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

  async function load(repo) {
    const cached = readCache(repo);
    if (cached) return cached;

    const res = await fetch(API + repo);
    if (!res.ok) throw new Error("repo " + res.status);
    const info = await res.json();
    const commits = await countCommits(repo);

    const data = {
      stars: info.stargazers_count,
      language: info.language,
      pushed: info.pushed_at,
      commits,
    };
    writeCache(repo, data);
    return data;
  }

  function timeAgo(iso) {
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return days + " days ago";
    const months = Math.floor(days / 30);
    if (months < 12) return months + (months === 1 ? " month ago" : " months ago");
    const years = Math.floor(months / 12);
    return years + (years === 1 ? " year ago" : " years ago");
  }

  function render(el, d) {
    const parts = [
      `<span title="GitHub stars">${icons.star}<strong>${d.stars.toLocaleString()}</strong> stars</span>`,
      `<span title="Total commits">${icons.commit}<strong>${d.commits.toLocaleString()}</strong> commits</span>`,
    ];
    if (d.language) parts.push(`<span>${icons.code}${d.language}</span>`);
    if (d.pushed) parts.push(`<span>${icons.clock}Updated ${timeAgo(d.pushed)}</span>`);
    el.innerHTML = parts.join("");
  }

  document.querySelectorAll(".gh-stats[data-repo]").forEach((el) => {
    const repo = el.dataset.repo;
    el.innerHTML = "<span>Loading GitHub stats…</span>";
    load(repo)
      .then((d) => render(el, d))
      .catch(() => {
        el.innerHTML = "<span>GitHub stats unavailable right now</span>";
      });
  });
})();
