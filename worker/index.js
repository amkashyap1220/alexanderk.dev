/* ==========================================================================
   Cloudflare Worker: keeps the site's GitHub numbers fresh, and guards the
   private section (login: see worker/auth.js; the fitness dashboard's data:
   see worker/fitness.js).

   Every 5 minutes (Cron Trigger in wrangler.jsonc) it asks GitHub for every
   repo's stars, commit count, languages and last push, the last year of
   contributions, the 90-day activity feed, and the READMEs, and saves the result in KV storage. Visitors'
   browsers read it from /data/github.json, so they never call GitHub (and
   never hit its 60-requests-an-hour limit). Everything else on the site is
   plain static files, served as before.

   Needs a GITHUB_TOKEN secret (Worker settings > Variables and Secrets): a
   fine-grained GitHub token with read access to public repos only.

   Free-plan limits it stays within: 50 outside requests per run (one
   GraphQL query covers all repos; a README is only re-fetched when it
   changed) and 1,000 KV writes a day (it only saves when something changed).

   The keys and shapes are what js/gh.js looks up, so the browser can use
   the file as is.
   ========================================================================== */

import { handleAuth, loggedIn, privateResponse } from "./auth.js";
import { handleFitness } from "./fitness.js";

const USER = "amkashyap1220";
const DATA_KEY = "github.json";
const MAX_READMES_PER_RUN = 30;   // stays under 50 requests even on the first run
const NAME = /^[\w.-]+$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // The fitness dashboard's data (worker/fitness.js): logged in only, and a 401 rather than a redirect
    if (url.pathname.startsWith("/private/api/fitness/")) {
      if (!(await loggedIn(request, env))) return privateResponse(new Response('{"error":"Log in first."}', { status: 401, headers: { "Content-Type": "application/json" } }));
      return privateResponse(await handleFitness(request, env));
    }
    const auth = await handleAuth(request, env);   // /login, /logout and /private/...
    if (auth) return auth;
    if (url.pathname !== "/data/github.json") return env.ASSETS.fetch(request);

    const body = await env.GITHUB_DATA.get(DATA_KEY);
    if (!body) {
      ctx.waitUntil(refresh(env).catch((e) => console.error("refresh failed:", e.message)));
      return new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } });
    }
    return new Response(body, {
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60" },
    });
  },

  async scheduled(event, env) {
    const result = await refresh(env);   // a failure shows up in the Worker's logs
    console.log("refreshed", JSON.stringify(result));
  },
};

async function refresh(env) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN secret is not set");
  const github = (path, init = {}) => fetch("https://api.github.com/" + path, {
    ...init,
    headers: { Authorization: "Bearer " + env.GITHUB_TOKEN, "User-Agent": "alexanderk.dev", ...init.headers },
  });

  const previousText = await env.GITHUB_DATA.get(DATA_KEY);
  const previous = previousText ? JSON.parse(previousText) : {};
  const data = {};
  const keep = (key) => { if (key in previous) data[key] = previous[key]; };

  // 1. Repos shown on the site that aren't mine (e.g. kashyap6/CollegeExperience)
  const extras = await siteRepos(env)
    .then((all) => all.filter(([owner]) => owner.toLowerCase() !== USER.toLowerCase()))
    .catch(() => []);

  // 2. One GraphQL query: profile, every public non-fork repo, and the extras
  const fields = `name nameWithOwner url stargazerCount pushedAt primaryLanguage { name }
    languages(first: 50, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
    defaultBranchRef { target { ... on Commit { history { totalCount } } } }
    readme: object(expression: "HEAD:README.md") { oid }`;
  const extraQueries = extras.map(([owner, name], i) => `x${i}: repository(owner: "${owner}", name: "${name}") { ${fields} }`).join("\n");
  const query = `{
    user(login: "${USER}") {
      createdAt
      contributionsCollection { totalCommitContributions contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } }
      repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false, orderBy: { field: NAME, direction: ASC }) { nodes { ${fields} } }
    }
    ${extraQueries}
  }`;
  const res = await github("graphql", { method: "POST", body: JSON.stringify({ query }) });
  const result = await res.json();
  if (!res.ok || !result.data || !result.data.user) throw new Error("GraphQL: " + res.status + " " + JSON.stringify(result.errors || result.message));

  const own = result.data.user.repositories.nodes;
  const others = extras.map((_, i) => result.data["x" + i]).filter(Boolean);

  data[`user:${USER}`.toLowerCase()] = { since: result.data.user.createdAt };
  // The last year of contributions, for the heat map: GitHub's own calendar, so it matches the profile.
  // Only days with something on them are kept ({ "2026-03-04": 5 }); from/to give the whole range.
  const calendar = result.data.user.contributionsCollection;
  const allDays = calendar.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  data[`contributions:${USER}`.toLowerCase()] = {
    total: calendar.contributionCalendar.totalContributions,
    commits: calendar.totalCommitContributions,
    from: allDays[0].date,
    to: allDays[allDays.length - 1].date,
    days: Object.fromEntries(allDays.filter((d) => d.contributionCount).map((d) => [d.date, d.contributionCount])),
  };
  data[`repos:${USER}`.toLowerCase()] = own.map((r) => ({
    name: r.name, fullName: r.nameWithOwner, url: r.url, stars: r.stargazerCount, pushed: r.pushedAt,
  }));

  const readmeOids = (previous._readmeOids || {});
  const newOids = {};
  const readmesToFetch = [];
  for (const r of [...own, ...others]) {
    const key = r.nameWithOwner.toLowerCase();
    const commits = r.defaultBranchRef && r.defaultBranchRef.target.history ? r.defaultBranchRef.target.history.totalCount : 0;
    const languages = {};
    r.languages.edges.forEach((e) => { languages[e.node.name] = e.size; });
    data["commits:" + key] = commits;
    data["languages:" + key] = languages;
    data["repo:" + key] = { stars: r.stargazerCount, language: r.primaryLanguage && r.primaryLanguage.name, pushed: r.pushedAt, commits };

    // README: reuse the saved copy unless the file changed
    if (!r.readme) continue;
    if (readmeOids[key] === r.readme.oid && ("readme:" + key) in previous) {
      keep("readme:" + key);
      newOids[key] = r.readme.oid;
    } else {
      readmesToFetch.push([r.nameWithOwner, r.readme.oid]);
    }
  }

  // 3. Changed READMEs, rendered (and sanitized) by GitHub, a few at a time
  for (const [name, oid] of readmesToFetch.slice(0, MAX_READMES_PER_RUN)) {
    const key = name.toLowerCase();
    try {
      const r = await github(`repos/${name}/readme`, { headers: { Accept: "application/vnd.github.html+json" } });
      if (!r.ok) throw new Error(String(r.status));
      data["readme:" + key] = await r.text();
      newOids[key] = oid;
    } catch (e) {
      keep("readme:" + key);   // try again next run
      if (readmeOids[key]) newOids[key] = readmeOids[key];
    }
  }
  readmesToFetch.slice(MAX_READMES_PER_RUN).forEach(([name]) => {
    const key = name.toLowerCase();
    keep("readme:" + key);   // the rest get fetched on the next runs
    if (readmeOids[key]) newOids[key] = readmeOids[key];
  });
  data._readmeOids = newOids;

  // 4. Public activity: only goes back 90 days (300 events at most)
  try {
    const events = new Map();   // by event id: new events can shift the pages while we read them, repeating some
    for (let page = 1; page <= 3; page++) {
      const r = await github(`users/${USER}/events/public?per_page=100&page=${page}`);
      if (!r.ok) throw new Error(String(r.status));
      const batch = await r.json();
      batch.forEach((e) => events.set(e.id, { type: e.type, repo: e.repo.name, at: e.created_at, ref: (e.payload && e.payload.ref) || null }));
      if (batch.length < 100) break;
    }
    // Newest first. GitHub's order isn't guaranteed, so sort by time
    data[`events:${USER}`.toLowerCase()] = [...events.values()].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
  } catch (e) {
    keep(`events:${USER}`.toLowerCase());
  }

  // 5. Save only when something changed (KV allows 1,000 writes a day)
  const text = JSON.stringify(Object.fromEntries(Object.entries(data).sort()));   // same order every run
  if (text !== previousText) await env.GITHUB_DATA.put(DATA_KEY, text);
  return { changed: text !== previousText, readmesFetched: Math.min(readmesToFetch.length, MAX_READMES_PER_RUN) };
}

// Every owner/repo named in a data-gh attribute on the Projects page, as [owner, name]
async function siteRepos(env) {
  const html = await env.ASSETS.fetch(new Request("https://site/projects/")).then((r) => r.text());
  const found = new Set();
  for (const m of html.matchAll(/data-gh="([^"\/]+)\/([^"]+)"/g)) {
    if (NAME.test(m[1]) && NAME.test(m[2])) found.add(m[1] + "/" + m[2]);
  }
  return [...found].map((r) => r.split("/"));
}

export { refresh };
