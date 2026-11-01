/* ==========================================================================
   gh.js: the small toolkit every GitHub-powered page shares.
   Loaded before js/github.js and js/stats.js; exposes window.GH.

   All GitHub data comes from /data/github.json, which the site's Cloudflare
   script (worker/index.js) refreshes from GitHub every 5 minutes. Visitors'
   browsers never call GitHub themselves.

   - GH.get(kind, name): one entry from that file, e.g. GH.get("repo",
     "owner/name"). Rejects if the file or the entry is missing (a project
     added in the last 5 minutes shows "--" until the next refresh).
   - GH.repo / GH.commits / GH.languages / GH.readme: shortcuts for get().
   - GH.languageColor(name): the Tango color for a language, or null.
   - GH.timeAgo(date), GH.el(tag, class, text): display helpers.
   ========================================================================== */

(function () {
  // Fetched once per page view and shared by everything that asks
  let file;
  const data = () => file = file || fetch("/data/github.json").then((res) => {
    if (!res.ok) throw new Error("No GitHub data yet (" + res.status + ")");
    return res.json();
  });

  const get = (kind, name) => data().then((all) => {
    const key = (kind + ":" + name).toLowerCase();
    if (!(key in all)) throw new Error("Not in the GitHub data: " + key);
    return all[key];
  });

  const repo = (name) => get("repo", name);            // { stars, language, pushed, commits }
  const commits = (name) => get("commits", name);
  const languages = (name) => get("languages", name);  // { language: bytes }
  const readme = (name) => get("readme", name);        // HTML, rendered and sanitized by GitHub

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

  window.GH = { get, repo, commits, languages, readme, languageColor, timeAgo, el };
})();
