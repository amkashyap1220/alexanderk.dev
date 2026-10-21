/* ==========================================================================
   gh.js: the small toolkit every GitHub-powered page shares.
   Loaded before js/github.js and js/stats.js; exposes window.GH.

   - GH.cached(key, fetcher): runs fetcher() once, saves the answer in the
     browser for 30 minutes (GitHub allows 60 requests an hour without a
     key), and shares one in-flight request between everyone who asks.
   - GH.api(path): fetch from api.github.com; throws on an error status.
   - GH.repo / GH.commits / GH.languages / GH.readme: cached lookups, so
     the Projects and Stats pages reuse each other's data.
   - GH.languageColor(name): GitHub's color for a language, or null.
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

  // GitHub's colors for common languages (from github-linguist), used for the
  // dots next to language names and the bars on the Stats page
  const LANGUAGE_COLORS = {
    "C": "#555555", "C#": "#178600", "C++": "#f34b7d", "CSS": "#563d7c", "Dart": "#00B4AB",
    "Dockerfile": "#384d54", "Go": "#00ADD8", "HTML": "#e34c26", "Java": "#b07219",
    "JavaScript": "#f1e05a", "Jupyter Notebook": "#DA5B0B", "Kotlin": "#A97BFF", "PHP": "#4F5D95",
    "PLpgSQL": "#336790", "PowerShell": "#012456", "Python": "#3572A5", "R": "#198CE7",
    "Ruby": "#701516", "Rust": "#dea584", "SCSS": "#c6538c", "Shell": "#89e051", "SQL": "#e38c00",
    "Swift": "#F05138", "TSQL": "#e38c00", "TypeScript": "#3178c6", "Vue": "#41b883",
  };
  const languageColor = (name) => LANGUAGE_COLORS[name] || null;

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

  window.GH = { cached, api, commits, repo, languages, readme, languageColor, timeAgo, el };
})();
