/* ==========================================================================
   gh.js: the small toolkit every GitHub-powered page shares.
   Loaded before js/github.js and js/stats.js; exposes window.GH.

   - GH.cached(key, fetcher): runs fetcher() once, saves the answer in the
     browser for 30 minutes (GitHub allows 60 requests an hour without a
     key), and shares one in-flight request between everyone who asks.
   - GH.api(path): fetch from api.github.com; throws on an error status.
   - GH.repo / GH.commits / GH.languages / GH.readme: cached lookups, so
     the Projects and Stats pages reuse each other's data.
   - GH.timeAgo(date), GH.el(tag, class, text): display helpers.
   ========================================================================== */

(function () {
  const API = "https://api.github.com/";
  const CACHE_MINUTES = 30;
  const inFlight = {};   // one shared request per key, for this page view

  function cached(key, fetcher) {
    key = "gh:" + key.toLowerCase();
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && Date.now() - saved.time < CACHE_MINUTES * 60 * 1000) return Promise.resolve(saved.data);
    } catch (e) { /* storage blocked: just fetch */ }

    inFlight[key] = inFlight[key] || fetcher()
      .then((data) => {
        try { localStorage.setItem(key, JSON.stringify({ time: Date.now(), data })); } catch (e) { /* full or blocked */ }
        return data;
      })
      .finally(() => { delete inFlight[key]; });   // a failed request can be tried again
    return inFlight[key];
  }

  async function api(path, options) {
    const res = await fetch(API + path, options);
    if (!res.ok) throw new Error("GitHub error " + res.status);
    return res;
  }

  // GitHub has no "total commits" field. Ask for 1 commit per page:
  // the number of the last page in the Link header is the total.
  const commits = (repo) => cached("commits:" + repo, async () => {
    const res = await api("repos/" + repo + "/commits?per_page=1");
    const last = (res.headers.get("Link") || "").match(/[?&]page=(\d+)>; rel="last"/);
    return last ? Number(last[1]) : (await res.json()).length;
  });

  const repo = (name) => cached("repo:" + name, async () => {
    const [info, total] = await Promise.all([api("repos/" + name).then((r) => r.json()), commits(name)]);
    return { stars: info.stargazers_count, language: info.language, pushed: info.pushed_at, commits: total };
  });

  const languages = (name) => cached("languages:" + name, () => api("repos/" + name + "/languages").then((r) => r.json()));

  // GitHub returns the README already rendered (and sanitized) as HTML
  const readme = (name) => cached("readme:" + name, () =>
    api("repos/" + name + "/readme", { headers: { Accept: "application/vnd.github.html+json" } }).then((r) => r.text()));

  function timeAgo(date) {
    const days = Math.floor((Date.now() - new Date(date)) / 86400000);
    if (days < 1) return "today";
    if (days < 30) return days + (days === 1 ? " day ago" : " days ago");
    const months = Math.floor(days / 30);
    if (months < 12) return months + (months === 1 ? " month ago" : " months ago");
    const years = Math.floor(months / 12);
    return years + (years === 1 ? " year ago" : " years ago");
  }

  // Builds an element. Text always goes in as textContent, never as HTML.
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  window.GH = { cached, api, commits, repo, languages, readme, timeAgo, el };
})();
