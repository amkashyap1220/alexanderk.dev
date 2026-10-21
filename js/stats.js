/* ==========================================================================
   Stats page: everything comes from GitHub's public API (no key).

     1. EXTRACT    one request for the profile, one for the repo list,
                   two per repo (languages, commit count), up to three for
                   the last 90 days of public activity
     2. TRANSFORM  skip forks, add up bytes per language, count commits,
                   bucket activity by day, weekday and hour
     3. LOAD       draw the numbers, the language bars and the heatmap

   The fetched data is saved in the browser for 30 minutes, because GitHub
   allows 60 requests an hour without a key.
   ========================================================================== */

(function () {
  const USER = "amkashyap1220";
  const TIME_ZONE = "America/Chicago";       // activity is bucketed in my time zone
  const CACHE_KEY = "gh:stats";
  const CACHE_MINUTES = 30;
  const API = "https://api.github.com/";

  // Repos that have a page on this site; everything else links to GitHub
  const PROJECT_PAGES = {
    "SwitchToYoutube": "/projects/switch-to-youtube.html",
    "alexanderk.dev": "/projects/alexanderk-dev.html",
  };


  // ---------------------------------------------------------------- 1. extract
  async function get(path) {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error("GitHub error " + res.status);
    return res;
  }

  // Total commits on the default branch: ask for 1 per page, read the last page number
  async function countCommits(repo) {
    const res = await get("repos/" + repo + "/commits?per_page=1");
    const last = (res.headers.get("Link") || "").match(/[?&]page=(\d+)>; rel="last"/);
    return last ? Number(last[1]) : (await res.json()).length;
  }

  // Public events only go back 90 days (max 300), 100 per page
  async function recentEvents() {
    const events = [];
    for (let page = 1; page <= 3; page++) {
      const batch = await (await get("users/" + USER + "/events/public?per_page=100&page=" + page)).json();
      events.push(...batch);
      if (batch.length < 100) break;
    }
    return events;
  }

  async function fetchAll() {
    const [user, allRepos] = await Promise.all([
      get("users/" + USER).then((r) => r.json()),
      get("users/" + USER + "/repos?per_page=100&type=owner").then((r) => r.json()),
    ]);
    const repos = allRepos.filter((r) => !r.fork);    // forks are mostly other people's code

    // Languages and commit counts for every repo, all at once. One failing repo doesn't sink the page.
    const details = await Promise.all(repos.map(async (r) => {
      const [languages, commits] = await Promise.all([
        get("repos/" + r.full_name + "/languages").then((res) => res.json()).catch(() => ({})),
        countCommits(r.full_name).catch(() => 0),
      ]);
      return { name: r.name, url: r.html_url, stars: r.stargazers_count, pushed: r.pushed_at, languages, commits };
    }));

    // Activity is optional: if it fails, the rest of the page still shows
    const events = await recentEvents().catch(() => null);

    return {
      since: user.created_at,
      repos: details,
      events: events && events.map((e) => ({
        type: e.type,
        repo: e.repo.name,
        at: e.created_at,
        ref: e.payload && e.payload.ref,
      })),
    };
  }

  async function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (saved && Date.now() - saved.time < CACHE_MINUTES * 60 * 1000) return saved.data;
    } catch (e) { /* storage blocked: just fetch */ }
    const data = await fetchAll();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data })); } catch (e) { /* ignore */ }
    return data;
  }


  // ---------------------------------------------------------------- 2. transform
  // { language: { bytes, repos } }, biggest first
  function languageTotals(repos) {
    const totals = {};
    repos.forEach((r) => {
      Object.entries(r.languages).forEach(([lang, bytes]) => {
        totals[lang] = totals[lang] || { name: lang, bytes: 0, repos: 0 };
        totals[lang].bytes += bytes;
        totals[lang].repos += 1;
      });
    });
    return Object.values(totals);
  }

  // "2026-10-20" for a moment, in TIME_ZONE
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "long" });
  const hourOf = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" });

  function activityByDay(events) {
    const counts = {};
    events.forEach((e) => { const d = dayKey.format(new Date(e.at)); counts[d] = (counts[d] || 0) + 1; });
    return counts;
  }

  // The value that appears most often, e.g. the busiest weekday
  function mostCommon(values) {
    const counts = {};
    values.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  }


  // ---------------------------------------------------------------- 3. load (draw)
  // Builds an element; text always goes in as textContent, never as HTML
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
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

  const linkFor = (repo) => PROJECT_PAGES[repo.name] || repo.url;
  const sum = (list, key) => list.reduce((total, x) => total + x[key], 0);

  function drawNumbers(data) {
    const box = document.getElementById("numbers");
    const langs = languageTotals(data.repos);
    const tiles = [
      [data.repos.length.toLocaleString(), "public repos"],
      [sum(data.repos, "commits").toLocaleString(), "commits"],
      [sum(data.repos, "stars").toLocaleString(), "stars"],
      [langs.length.toLocaleString(), "languages"],
      [String(new Date(data.since).getFullYear()), "on GitHub since"],   // no comma in a year
    ];
    box.textContent = "";
    tiles.forEach(([value, label]) => {
      const tile = el("div", "card stat");
      tile.append(el("p", "stat-value", value), el("p", "stat-label", label));
      box.append(tile);
    });

    // Most-starred and most recently pushed repo
    const highlights = document.getElementById("highlights");
    highlights.textContent = "";
    if (!data.repos.length) return;
    const top = [...data.repos].sort((a, b) => b.stars - a.stars)[0];
    const latest = [...data.repos].sort((a, b) => new Date(b.pushed) - new Date(a.pushed))[0];
    [["Most starred", top, "★ " + top.stars], ["Last updated", latest, timeAgo(latest.pushed)]].forEach(([label, repo, detail]) => {
      const line = el("p");
      const link = el("a", null, repo.name);
      link.href = linkFor(repo);
      line.append(el("span", "muted", label + ": "), link, el("span", "muted", " · " + detail));
      highlights.append(line);
    });
  }

  let languageMode = "bytes";   // or "repos"

  function drawLanguages(data) {
    const box = document.getElementById("languages");
    const langs = languageTotals(data.repos).sort((a, b) => b[languageMode] - a[languageMode] || b.bytes - a.bytes);
    const total = languageMode === "bytes" ? sum(langs, "bytes") : data.repos.length;
    box.textContent = "";
    if (!langs.length) return box.append(el("p", "muted", "No languages found yet."));

    // Show the top 8; fold the rest into "Other" (only when measuring bytes, where shares add up to 100%)
    let shown = langs.slice(0, 8);
    if (languageMode === "bytes" && langs.length > 8) {
      shown.push({ name: "Other", bytes: sum(langs.slice(8), "bytes"), repos: 0 });
    }
    const biggest = shown[0][languageMode];

    shown.forEach((lang) => {
      const value = lang[languageMode];
      const row = el("div", "bar-row");
      const track = el("div", "bar-track");
      const bar = el("div", "bar");
      bar.style.width = Math.max(1, (value / biggest) * 100) + "%";   // longest bar = full width
      track.append(bar);
      const amount = languageMode === "bytes"
        ? ((value / total) * 100).toFixed(1) + "%"
        : value + " of " + total + (total === 1 ? " repo" : " repos");
      row.append(el("span", "bar-name", lang.name), track, el("span", "bar-value", amount));
      box.append(row);
    });
  }

  function drawActivity(events) {
    const grid = document.getElementById("heatmap");
    const summary = document.getElementById("activity-summary");
    const feed = document.getElementById("latest");
    grid.textContent = summary.textContent = feed.textContent = "";
    if (!events) return summary.append(el("p", "muted", "Couldn't load recent activity from GitHub right now."));

    // 13 weeks of days, Sunday-first columns like GitHub, ending today
    const counts = activityByDay(events);
    const today = dayKey.format(new Date());
    const [y, m, d] = today.split("-").map(Number);
    const todayUTC = Date.UTC(y, m - 1, d);
    const start = todayUTC - (new Date(todayUTC).getUTCDay() + 12 * 7) * 86400000;
    const busiest = Math.max(1, ...Object.values(counts));
    for (let t = start; t <= todayUTC; t += 86400000) {
      const key = new Date(t).toISOString().slice(0, 10);
      const n = counts[key] || 0;
      const cell = el("span", "cell");
      // 0 = empty; otherwise one of 4 shades, darker = busier
      cell.dataset.level = n === 0 ? 0 : Math.ceil((n / busiest) * 4);
      cell.title = key + ": " + n + (n === 1 ? " event" : " events");
      grid.append(cell);
    }

    if (!events.length) return summary.append(el("p", "muted", "No public activity in the last 90 days."));

    const days = Object.keys(counts).length;
    const day = mostCommon(events.map((e) => weekdayName.format(new Date(e.at))));
    const hour = Number(mostCommon(events.map((e) => hourOf.format(new Date(e.at)))));
    const clock = (h) => ((h + 11) % 12 + 1) + (h < 12 ? "am" : "pm");
    summary.append(
      el("p", null, events.length + " public events on " + days + " different days in the last 90 days."),
      el("p", "muted", "Busiest day: " + day + ". Busiest hour: " + clock(hour) + "–" + clock((hour + 1) % 24) + " (Chicago time).")
    );

    // Last 5 pushes
    events.filter((e) => e.type === "PushEvent").slice(0, 5).forEach((e) => {
      const item = el("li");
      const repo = el("a", null, e.repo.split("/")[1]);
      repo.href = "https://github.com/" + e.repo;
      repo.target = "_blank";
      repo.rel = "noopener";
      item.append(el("span", "muted", "Pushed to "), el("code", null, (e.ref || "").replace("refs/heads/", "")),
        el("span", "muted", " in "), repo, el("span", "muted", " · " + timeAgo(e.at)));
      feed.append(item);
    });
  }

  function showError() {
    ["numbers", "languages", "activity-summary"].forEach((id) => {
      const box = document.getElementById(id);
      box.textContent = "";
      box.append(el("p", "muted", "Couldn't reach GitHub right now. Try again in a few minutes."));
    });
  }

  // The "by code size / by repos" toggle
  let data = null;
  document.querySelectorAll("[data-language-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      languageMode = button.dataset.languageMode;
      document.querySelectorAll("[data-language-mode]").forEach((b) => b.setAttribute("aria-pressed", b === button));
      if (data) drawLanguages(data);
    });
  });

  load()
    .then((result) => {
      data = result;
      drawNumbers(data);
      drawLanguages(data);
      drawActivity(data.events);
    })
    .catch(showError);
})();
