/* ==========================================================================
   Fitness tracker API for the private dashboard (private/fitness-tracking).

   The workout log lives in the repo amkashyap1220/fitness-data, never in
   this one. A daily Claude session commits workouts there;
   this file reads it for the dashboard and saves what the dashboard can
   change: lift rankings, and requests for new lifts (plain text; the next
   daily session works out the lift's slot and muscles and adds it).

     GET  /private/api/fitness/data         everything the dashboard draws
     GET  /private/api/fitness/engine.js    the repo's plan engine, so the
                                            page computes plans with the
                                            same code as the daily session
     POST /private/api/fitness/preferences  { rankings, never }
     POST /private/api/fitness/request      { text } ask for a new lift, or
                                            { cancel: n } take one back
     POST /private/api/fitness/weight       { date, weight } a weigh-in in lb,
                                            or { date, remove: true }

   Only reached when logged in (worker/index.js checks first). Needs a
   FITNESS_GITHUB_TOKEN secret: a fine-grained GitHub token with access to
   fitness-data only, Contents read and write.
   ========================================================================== */

const REPO = "amkashyap1220/fitness-data";
const MAX_REQUESTS = 50;
const enc = new TextEncoder();
const dec = new TextDecoder();

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8" },
});
const fail = (status, error) => json({ error }, status);

function github(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...init,
    headers: {
      Authorization: "Bearer " + env.FITNESS_GITHUB_TOKEN.trim(),   // a pasted secret can carry a newline
      "User-Agent": "alexanderk.dev",
      Accept: "application/vnd.github+json",
      ...init.headers,
    },
  });
}

// What went wrong, in words that say what to fix (shown on the page)
class GitHubError extends Error {
  constructor(status, path) {
    super({
      401: "GitHub rejected FITNESS_GITHUB_TOKEN (401): it's mistyped, expired or revoked. Make a new one and update the secret.",
      403: "GitHub refused FITNESS_GITHUB_TOKEN (403): give it the Contents permission (Read and write) on fitness-data.",
      404: `GitHub can't see ${REPO} with FITNESS_GITHUB_TOKEN (404 on ${path}): the token's resource owner must be amkashyap1220 and its repository access must include fitness-data.`,
    }[status] || `GitHub answered ${status} for ${path}. Try again in a minute.`);
    this.status = status;
  }
}

// A file's text, or null if it isn't there
async function readRaw(env, path) {
  const res = await github(env, "contents/" + path, { headers: { Accept: "application/vnd.github.raw+json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new GitHubError(res.status, path);
  return res.text();
}

// A JSON file and its sha (needed to save it back); `empty` if it isn't there yet
async function readWithSha(env, path, empty) {
  const res = await github(env, "contents/" + path);
  if (res.status === 404 && empty !== undefined) return { data: empty, sha: undefined };
  if (!res.ok) throw new GitHubError(res.status, path);
  const file = await res.json();
  const bytes = Uint8Array.from(atob(file.content.replace(/\n/g, "")), (c) => c.charCodeAt(0));
  return { data: JSON.parse(dec.decode(bytes)), sha: file.sha };
}

function base64(text) {
  const bytes = enc.encode(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

// Saves only if nobody changed the file since it was read (GitHub checks the sha)
async function write(env, path, data, sha, message) {
  const res = await github(env, "contents/" + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha, content: base64(JSON.stringify(data, null, 2) + "\n") }),
  });
  if (res.status === 409 || res.status === 422) return "conflict";
  if (!res.ok) throw new GitHubError(res.status, path);
  return "ok";
}

async function readAll(env) {
  const [program, exercises, preferences, state, bodyweight, listing] = await Promise.all([
    readRaw(env, "program.json"), readRaw(env, "exercises.json"), readRaw(env, "preferences.json"),
    readRaw(env, "state.json"), readRaw(env, "bodyweight.json"), github(env, "contents/workouts"),
  ]);
  // A private repo the token can't see looks exactly like a missing file
  if (!program || !exercises || !preferences) throw new GitHubError(404, "program.json");
  const files = listing.ok ? (await listing.json()).map((f) => f.name).filter((n) => /^\d{4}\.json$/.test(n)).sort() : [];
  const years = await Promise.all(files.map((f) => readRaw(env, "workouts/" + f)));
  const workouts = Object.assign({}, ...years.filter(Boolean).map((t) => JSON.parse(t)));
  return {
    program: JSON.parse(program), exercises: JSON.parse(exercises), preferences: JSON.parse(preferences),
    state: state ? JSON.parse(state) : null, workouts, bodyweight: bodyweight ? JSON.parse(bodyweight) : {},
  };
}

/* ---------- checking what the page sends ---------- */
export function checkPreferences(body, program, exercises) {
  const byId = new Map(exercises.exercises.map((e) => [e.id, e]));
  if (!body || typeof body !== "object") return "Expected { rankings, never }.";
  const { rankings, never } = body;
  if (!rankings || typeof rankings !== "object" || Array.isArray(rankings)) return "rankings must be an object of slot: [lift ids].";
  for (const [slot, ids] of Object.entries(rankings)) {
    if (!program.slots[slot]) return `Unknown slot "${slot}".`;
    if (!Array.isArray(ids) || ids.length > 50) return `rankings.${slot} must be a list.`;
    if (new Set(ids).size !== ids.length) return `rankings.${slot} lists a lift twice.`;
    for (const id of ids) {
      if (!byId.has(id)) return `Unknown lift "${id}".`;
      if (byId.get(id).slot !== slot) return `"${id}" isn't a ${program.slots[slot].name} lift.`;
    }
  }
  if (!Array.isArray(never) || never.some((id) => !byId.has(id))) return "never must be a list of lift ids.";
  return null;
}

export function checkWeight(body) {
  if (!body || typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || isNaN(Date.parse(body.date))) return "Pick a date.";
  if (body.remove === true) return null;
  if (typeof body.weight !== "number" || !(body.weight >= 50 && body.weight <= 700)) return "Enter your weight in lb (50 to 700).";
  return null;
}

/* ---------- the routes ---------- */
export async function handleFitness(request, env) {
  const path = new URL(request.url).pathname.replace(/^\/private\/api\/fitness\//, "");
  if (!env.FITNESS_GITHUB_TOKEN) return fail(503, "FITNESS_GITHUB_TOKEN isn't set in the Worker's secrets.");

  try {
    if (request.method === "GET" && path === "data") return json(await readAll(env));
    if (request.method === "GET" && path === "engine.js") {
      const code = await readRaw(env, "engine/engine.js");
      if (!code) throw new GitHubError(404, "engine/engine.js");
      return new Response(code, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
    }

    if (request.method === "POST" && (path === "preferences" || path === "request" || path === "weight")) {
      // Only the dashboard itself can save (the login cookie is SameSite=Lax as well)
      if (request.headers.get("Origin") !== new URL(request.url).origin) return fail(403, "Wrong origin.");
      const body = await request.json().catch(() => null);
      const conflict = () => fail(409, "Changed somewhere else meanwhile. Reload and try again.");

      if (path === "weight") {
        const problem = checkWeight(body);
        if (problem) return fail(400, problem);
        const file = await readWithSha(env, "bodyweight.json", {});
        const all = { ...file.data };
        if (body.remove) delete all[body.date];
        else all[body.date] = Math.round(body.weight * 10) / 10;
        const next = Object.fromEntries(Object.entries(all).sort(([a], [b]) => (a < b ? -1 : 1)));
        const message = body.remove ? `Remove weigh-in for ${body.date}` : `Weigh-in ${body.date}: ${next[body.date]} lb`;
        const saved = await write(env, "bodyweight.json", next, file.sha, message);
        return saved === "ok" ? json({ bodyweight: next }) : conflict();
      }

      const prefs = await readWithSha(env, "preferences.json");

      if (path === "preferences") {
        const [program, exercises] = await Promise.all([readRaw(env, "program.json").then(JSON.parse), readRaw(env, "exercises.json").then(JSON.parse)]);
        const problem = checkPreferences(body, program, exercises);
        if (problem) return fail(400, problem);
        const rankings = Object.fromEntries(Object.entries(body.rankings).filter(([, ids]) => ids.length));
        const next = { ...prefs.data, rankings, never: body.never };
        const saved = await write(env, "preferences.json", next, prefs.sha, "Update lift rankings from the dashboard");
        return saved === "ok" ? json({ preferences: next }) : conflict();
      }

      // A new lift is just words; the daily session turns them into a catalog entry
      const requests = prefs.data.requests || [];
      let message;
      if (body && Number.isInteger(body.cancel)) {
        if (!requests[body.cancel]) return fail(400, "No such request.");
        const [gone] = requests.splice(body.cancel, 1);
        message = `Cancel lift request "${gone.text}"`;
      } else {
        const text = body && typeof body.text === "string" ? body.text.trim().replace(/\s+/g, " ") : "";
        if (!text || text.length > 200) return fail(400, "Type the lift (up to 200 characters).");
        if (requests.length >= MAX_REQUESTS) return fail(400, "That's a lot of waiting requests. Let a session add them first.");
        requests.push({ text, at: new Date().toISOString() });
        message = `Request lift "${text}" from the dashboard`;
      }
      const next = { ...prefs.data, requests };
      const saved = await write(env, "preferences.json", next, prefs.sha, message);
      return saved === "ok" ? json({ preferences: next }) : conflict();
    }

    return fail(404, "Not found");
  } catch (err) {
    console.error("fitness:", err.message);
    return fail(502, err instanceof GitHubError ? err.message : "Couldn't reach the fitness data. Try again in a minute.");
  }
}
