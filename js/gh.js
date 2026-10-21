/* ==========================================================================
   gh.js: the small toolkit every GitHub-powered page shares.
   Loaded before js/github.js and js/stats.js; exposes window.GH.

   - GH.cached(key, fetcher): looks in /data/github.json first. The site's
     Cloudflare script (worker/index.js) refreshes it every 5 minutes, so
     visitors don't call GitHub at all (GitHub allows only 60 requests an
     hour per visitor). Anything not in the file (say, a project added
     since the last run) is fetched live, saved in the browser for 30
     minutes, and shared between everyone on the page who asks for it.
   - GH.api(path): fetch from api.github.com; throws on an error status.
   - GH.repo / GH.commits / GH.languages / GH.readme: cached lookups, so
     the Projects and Stats pages reuse each other's data.
   - GH.languageColor(name): the Tango color for a language, or null.
   - GH.timeAgo(date), GH.el(tag, class, text): display helpers.
   ========================================================================== */

(function () {
  const API = "https://api.github.com/";
  const CACHE_MINUTES = 30;
  const inFlight = {};   // one shared request per key, for this page view

  // Served by worker/index.js; keys match the ones below
  let savedFile;
  const saved = () => savedFile = savedFile || fetch("/data/github.json")
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({}));   // no file yet: everything is fetched live

  function cached(key, fetcher) {
    key = key.toLowerCase();
    return saved().then((file) => (key in file ? file[key] : live("gh:" + key, fetcher)));
  }

  function live(key, fetcher) {
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      if (stored && Date.now() - stored.time < CACHE_MINUTES * 60 * 1000) return Promise.resolve(stored.data);
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

  // A Tango color per language (Tango = the default GNOME / Linux palette),
  // picked to echo each language's usual color. Used for the dots next to
  // language names and the bars on the GitHub Stats page.
  const LANGUAGE_COLORS = {
    "Python": "#3465a4", "TypeScript": "#3465a4", "Go": "#729fcf", "R": "#729fcf", "Dart": "#729fcf",   // sky blue
    "PowerShell": "#204a87", "Dockerfile": "#204a87", "PLpgSQL": "#204a87",
    "JavaScript": "#edd400",                                                                          // butter
    "HTML": "#f57900", "Swift": "#f57900", "Rust": "#ce5c00", "Jupyter Notebook": "#fcaf3e",           // orange
    "CSS": "#75507b", "PHP": "#5c3566", "SCSS": "#ad7fa8", "Kotlin": "#ad7fa8",                         // plum
    "C++": "#cc0000", "Ruby": "#a40000",                                                               // scarlet red
    "C#": "#4e9a06", "Shell": "#73d216", "Vue": "#73d216",                                            // chameleon
    "Java": "#c17d11", "SQL": "#8f5902", "TSQL": "#8f5902",                                           // chocolate
    "C": "#888a85",                                                                                    // aluminium
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
