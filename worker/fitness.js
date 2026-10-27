/* ==========================================================================
   Fitness tracker API for the private dashboard (private/fitness-tracking).

   The workout log lives in the PRIVATE repo amkashyap1220/fitness-data,
   never in this public one. A daily Claude session commits workouts there;
   this file reads it for the dashboard and saves the two things the
   dashboard can change: lift rankings and the lift catalog.

     GET  /private/api/fitness/data         everything the dashboard draws
     GET  /private/api/fitness/engine.js    the repo's plan engine, so the
                                            page computes plans with the
                                            same code as the daily session
     POST /private/api/fitness/preferences  { rankings, never }
     POST /private/api/fitness/exercise     { exercise } add or edit a lift

   Only reached when logged in (worker/index.js checks first). Needs a
   FITNESS_GITHUB_TOKEN secret: a fine-grained GitHub token with access to
   fitness-data only, Contents read and write.
   ========================================================================== */

const REPO = "amkashyap1220/fitness-data";
const ID = /^[a-z0-9-]{1,64}$/;
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
      Authorization: "Bearer " + env.FITNESS_GITHUB_TOKEN,
      "User-Agent": "alexanderk.dev",
      Accept: "application/vnd.github+json",
      ...init.headers,
    },
  });
}

// A file's text, or null if it isn't there
async function readRaw(env, path) {
  const res = await github(env, "contents/" + path, { headers: { Accept: "application/vnd.github.raw+json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} reading ${path}`);
  return res.text();
}

// A JSON file and its sha (needed to save it back)
async function readWithSha(env, path) {
  const res = await github(env, "contents/" + path);
  if (!res.ok) throw new Error(`GitHub ${res.status} reading ${path}`);
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
  if (!res.ok) throw new Error(`GitHub ${res.status} saving ${path}`);
  return "ok";
}

async function readAll(env) {
  const [program, exercises, preferences, state, listing] = await Promise.all([
    readRaw(env, "program.json"), readRaw(env, "exercises.json"), readRaw(env, "preferences.json"),
    readRaw(env, "state.json"), github(env, "contents/workouts"),
  ]);
  if (!program || !exercises || !preferences) throw new Error("fitness-data is missing program.json, exercises.json or preferences.json");
  const files = listing.ok ? (await listing.json()).map((f) => f.name).filter((n) => /^\d{4}\.json$/.test(n)).sort() : [];
  const years = await Promise.all(files.map((f) => readRaw(env, "workouts/" + f)));
  const workouts = Object.assign({}, ...years.filter(Boolean).map((t) => JSON.parse(t)));
  return {
    program: JSON.parse(program), exercises: JSON.parse(exercises), preferences: JSON.parse(preferences),
    state: state ? JSON.parse(state) : null, workouts,
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

export function checkExercise(e, program, exercises) {
  if (!e || typeof e !== "object") return "Expected { exercise }.";
  const name = typeof e.name === "string" ? e.name.trim() : "";
  if (!name || name.length > 60) return "The name must be 1 to 60 characters.";
  if (e.id !== undefined && !ID.test(e.id)) return "Bad lift id.";
  if (!program.slots[e.slot]) return "Pick a slot.";
  const muscles = (list) => Array.isArray(list) && list.every((m) => program.muscles[m]);
  if (!muscles(e.primary) || !e.primary.length) return "Pick at least one main muscle.";
  if (e.secondary !== undefined && !muscles(e.secondary)) return "Unknown secondary muscle.";
  if (!["compound", "isolation"].includes(e.type)) return "Type must be compound or isolation.";
  if (!Array.isArray(e.reps) || e.reps.length !== 2 || !e.reps.every((r) => Number.isInteger(r) && r >= 1 && r <= 50) || e.reps[0] > e.reps[1]) return "Reps must be a low and high number, 1 to 50.";
  if (![2.5, 5, 10].includes(e.increment)) return "Increment must be 2.5, 5 or 10 lb.";
  const id = e.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!ID.test(id)) return "That name doesn't make a usable id.";
  if (!e.id && exercises.exercises.some((x) => x.id === id)) return `There's already a lift called "${id}".`;
  if (e.id && !exercises.exercises.some((x) => x.id === id)) return `No lift "${id}" to edit.`;
  return null;
}

// Only the fields a lift has, nothing else the page might send
function cleanExercise(e, id, old = {}) {
  const { bodyweight, ...kept } = old;
  return {
    ...kept,
    id, name: e.name.trim(), slot: e.slot, primary: e.primary, secondary: e.secondary || [],
    equipment: typeof e.equipment === "string" && e.equipment ? e.equipment.slice(0, 20) : old.equipment || "other",
    type: e.type, reps: e.reps, increment: e.increment,
    ...(e.bodyweight ? { bodyweight: true } : {}),
    ...(old.id ? {} : { custom: true }),
  };
}

/* ---------- the routes ---------- */
export async function handleFitness(request, env) {
  const path = new URL(request.url).pathname.replace(/^\/private\/api\/fitness\//, "");
  if (!env.FITNESS_GITHUB_TOKEN) return fail(503, "FITNESS_GITHUB_TOKEN isn't set in the Worker's secrets.");

  try {
    if (request.method === "GET" && path === "data") return json(await readAll(env));
    if (request.method === "GET" && path === "engine.js") {
      const code = await readRaw(env, "engine/engine.js");
      if (!code) return fail(404, "engine/engine.js not found");
      return new Response(code, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
    }

    if (request.method === "POST" && (path === "preferences" || path === "exercise")) {
      // Only the dashboard itself can save (the login cookie is SameSite=Lax as well)
      if (request.headers.get("Origin") !== new URL(request.url).origin) return fail(403, "Wrong origin.");
      const body = await request.json().catch(() => null);
      const [program, exercises] = await Promise.all([readRaw(env, "program.json").then(JSON.parse), readWithSha(env, "exercises.json")]);

      if (path === "preferences") {
        const problem = checkPreferences(body, program, exercises.data);
        if (problem) return fail(400, problem);
        const prefs = await readWithSha(env, "preferences.json");
        const rankings = Object.fromEntries(Object.entries(body.rankings).filter(([, ids]) => ids.length));
        const next = { ...prefs.data, rankings, never: body.never };
        const saved = await write(env, "preferences.json", next, prefs.sha, "Update lift rankings from the dashboard");
        return saved === "ok" ? json({ preferences: next }) : fail(409, "Changed somewhere else meanwhile. Reload and try again.");
      }

      const e = body && body.exercise;
      const problem = checkExercise(e, program, exercises.data);
      if (problem) return fail(400, problem);
      const list = exercises.data.exercises;
      const id = e.id || e.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const at = list.findIndex((x) => x.id === id);
      const lift = cleanExercise(e, id, at >= 0 ? list[at] : {});
      const movedFrom = at >= 0 && list[at].slot !== lift.slot ? list[at].slot : null;
      if (at >= 0) list[at] = lift; else list.push(lift);
      const saved = await write(env, "exercises.json", exercises.data, exercises.sha, `${at >= 0 ? "Edit" : "Add"} ${lift.name} from the dashboard`);
      if (saved !== "ok") return fail(409, "Changed somewhere else meanwhile. Reload and try again.");
      // A lift moved to another slot leaves its old slot's ranking
      if (movedFrom) {
        const prefs = await readWithSha(env, "preferences.json");
        const ranked = (prefs.data.rankings || {})[movedFrom];
        if (ranked && ranked.includes(id)) {
          prefs.data.rankings[movedFrom] = ranked.filter((x) => x !== id);
          await write(env, "preferences.json", prefs.data, prefs.sha, `Unrank ${lift.name} from its old slot`);
        }
      }
      return json({ exercise: lift });
    }

    return fail(404, "Not found");
  } catch (err) {
    console.error("fitness:", err.message);
    return fail(502, "Couldn't reach the fitness data. Try again in a minute.");
  }
}
