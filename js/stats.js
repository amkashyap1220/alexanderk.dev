/* ==========================================================================
   Stats page: everything comes from GitHub's public API (no key), through
   the shared, cached helpers in js/gh.js.

     1. EXTRACT    the profile, the repo list, languages and commit count per
                   repo, and the last 90 days of public activity
     2. TRANSFORM  skip forks, add up languages, count commits, find the
                   busiest weekday and hour
     3. LOAD       draw the numbers, the language bars and the activity
   ========================================================================== */

(function () {
  const { cached, api, commits, languages, languageColor, timeAgo, el } = window.GH;
  const USER = "amkashyap1220";
  const TIME_ZONE = "America/Chicago";       // activity is bucketed in my time zone

  // Repos that have a page on this site; everything else links to GitHub
  const PROJECT_PAGES = {
    "SwitchToYoutube": "/projects/switch-to-youtube.html",
    "alexanderk.dev": "/projects/alexanderk-dev.html",
    "Gaps-Between-The-Primes": "/projects/gaps-between-the-primes.html",
  };


  // ---------------------------------------------------------------- 1. extract
  const json = (path) => api(path).then((r) => r.json());

  const profile = () => cached("user:" + USER, () =>
    json("users/" + USER).then((u) => ({ since: u.created_at })));

  // Forks are skipped: they're mostly other people's code
  const ownRepos = () => cached("repos:" + USER, () =>
    json("users/" + USER + "/repos?per_page=100&type=owner").then((list) => list
      .filter((r) => !r.fork)
      .map((r) => ({ name: r.name, fullName: r.full_name, url: r.html_url, stars: r.stargazers_count, pushed: r.pushed_at }))));

  // Public events only go back 90 days (max 300), 100 per page
  const recentEvents = () => cached("events:" + USER, async () => {
    const events = [];
    for (let page = 1; page <= 3; page++) {
      const batch = await json("users/" + USER + "/events/public?per_page=100&page=" + page);
      events.push(...batch.map((e) => ({ type: e.type, repo: e.repo.name, at: e.created_at, ref: e.payload && e.payload.ref })));
      if (batch.length < 100) break;
    }
    return events;
  });

  async function fetchAll() {
    const [user, repos] = await Promise.all([profile(), ownRepos()]);
    // Languages and commits for every repo at once; one failing repo doesn't sink the page
    const details = await Promise.all(repos.map(async (r) => ({
      ...r,
      languages: await languages(r.fullName).catch(() => ({})),
      commits: await commits(r.fullName).catch(() => 0),
    })));
    return { since: user.since, repos: details };
  }


  // ---------------------------------------------------------------- 2. transform
  // [{ name, bytes, repos }] for every language
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

  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "long" });
  const hourOf = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" });

  // The value that appears most often, e.g. the busiest weekday
  function mostCommon(values) {
    const counts = {};
    values.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  }

  const sum = (list, key) => list.reduce((total, x) => total + x[key], 0);


  // ---------------------------------------------------------------- 3. load (draw)
  const linkFor = (repo) => PROJECT_PAGES[repo.name] || repo.url;
  const done = (box) => box.setAttribute("aria-busy", "false");

  function drawNumbers(data) {
    const box = document.getElementById("numbers");
    document.getElementById("numbers-status").hidden = true;
    const tiles = [
      ["public repos", data.repos.length.toLocaleString()],
      ["commits", sum(data.repos, "commits").toLocaleString()],
      ["stars", sum(data.repos, "stars").toLocaleString()],
      ["languages", languageTotals(data.repos).length.toLocaleString()],
      ["on GitHub since", String(new Date(data.since).getFullYear())],   // no comma in a year
    ];
    box.textContent = "";
    tiles.forEach(([label, value]) => {
      const tile = el("div", "card stat");
      tile.append(el("dt", "stat-label", label), el("dd", "stat-value", value));   // shown number-first by CSS
      box.append(tile);
    });

    // Most-starred and most recently pushed repo
    const highlights = document.getElementById("highlights");
    highlights.textContent = "";
    if (!data.repos.length) return;
    const top = [...data.repos].sort((a, b) => b.stars - a.stars)[0];
    const latest = [...data.repos].sort((a, b) => new Date(b.pushed) - new Date(a.pushed))[0];
    [["Most starred", top, "★", " " + top.stars], ["Last updated", latest, null, timeAgo(latest.pushed)]].forEach(([label, repo, icon, detail]) => {
      const line = el("p");
      const link = el("a", null, repo.name);
      link.href = linkFor(repo);
      line.append(el("span", "muted", label + ": "), link, el("span", "muted", " · "));
      if (icon) line.append(el("span", "star", icon));   // the star
      line.append(el("span", "muted", detail));
      highlights.append(line);
    });
  }

  let languageMode = "repos";   // or "bytes"

  function drawLanguages(data) {
    const box = document.getElementById("languages");
    const langs = languageTotals(data.repos).sort((a, b) => b[languageMode] - a[languageMode] || b.bytes - a.bytes);
    const total = languageMode === "bytes" ? sum(langs, "bytes") : data.repos.length;
    box.textContent = "";
    done(box);
    if (!langs.length) return box.append(el("p", "muted", "No languages found yet."));

    // Show the top 8; fold the rest into "Other" (only for code size, where shares add up to 100%)
    const shown = langs.slice(0, 8);
    if (languageMode === "bytes" && langs.length > 8) {
      shown.push({ name: "Other", bytes: sum(langs.slice(8), "bytes"), repos: 0 });
    }
    const biggest = shown[0][languageMode];

    shown.forEach((lang) => {
      const value = lang[languageMode];
      const amount = languageMode === "bytes"
        ? ((value / total) * 100).toFixed(1) + "%"
        : value + " of " + total + (total === 1 ? " repo" : " repos");
      const row = el("div", "bar-row");
      const track = el("div", "bar-track");
      const bar = el("div", "bar");
      bar.style.width = Math.max(1, (value / biggest) * 100) + "%";   // longest bar = full width
      const color = lang.name === "Other" ? "var(--muted)" : languageColor(lang.name);
      if (color) bar.style.setProperty("--lang", color);                // the language's Tango color
      track.setAttribute("aria-hidden", "true");                        // the text next to it says the same
      track.append(bar);
      row.append(el("span", "bar-name", lang.name), track, el("span", "bar-value", amount));
      box.append(row);
    });
  }

  function drawActivity(events) {
    const summary = document.getElementById("activity-summary");
    const feed = document.getElementById("latest");
    summary.textContent = feed.textContent = "";
    done(summary);
    if (!events) return summary.append(el("p", "muted", "Couldn't load recent activity from GitHub right now."));
    if (!events.length) return summary.append(el("p", "muted", "No public activity in the last 90 days."));

    const days = new Set(events.map((e) => dayKey.format(new Date(e.at)))).size;
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
      const when = el("time", null, timeAgo(e.at));
      when.dateTime = e.at;
      item.append(el("span", "muted", "Pushed to "), el("code", null, (e.ref || "").replace("refs/heads/", "")),
        el("span", "muted", " in "), repo, el("span", "muted", " · "), when);
      feed.append(item);
    });
  }

  // Activity handles its own errors; this covers the numbers and languages
  function showError() {
    const message = "Couldn't reach GitHub right now. Try again in a few minutes.";
    document.getElementById("numbers-status").textContent = message;
    const box = document.getElementById("languages");
    box.textContent = "";
    box.append(el("p", "muted", message));
    done(box);
  }

  // The "by repos / by code size" toggle
  let data = null;
  document.querySelectorAll("[data-language-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      languageMode = button.dataset.languageMode;
      document.querySelectorAll("[data-language-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      if (data) drawLanguages(data);
    });
  });

  fetchAll()
    .then((result) => {
      data = result;
      drawNumbers(data);
      drawLanguages(data);
    })
    .catch(showError);

  // Activity loads on its own: if it fails, the rest of the page still shows
  recentEvents().then(drawActivity, () => drawActivity(null));
})();
