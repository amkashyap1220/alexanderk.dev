// Tests for the fitness dashboard's API in worker/fitness.js (run with: node --test tests/)
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { handleAuth } from "../worker/auth.js";

const SITE = "https://alexanderk.dev";
const API = SITE + "/private/api/fitness/";

// A fake fitness-data repo behind a fake GitHub API: files by path, with a sha per version
function repo() {
  const files = {
    "program.json": { slots: { h_press: { name: "Horizontal press", day: "push" }, v_press: { name: "Vertical press", day: "push" } }, muscles: { chest: "Chest", front_delts: "Front delts", triceps: "Triceps" } },
    "exercises.json": { exercises: [
      { id: "bench-press", name: "Barbell bench press", slot: "h_press", primary: ["chest"], secondary: [], type: "compound", reps: [6, 10], increment: 5 },
      { id: "db-bench-press", name: "Dumbbell bench press", slot: "h_press", primary: ["chest"], secondary: [], type: "compound", reps: [8, 12], increment: 5 },
      { id: "ohp", name: "Barbell overhead press", slot: "v_press", primary: ["front_delts"], secondary: [], type: "compound", reps: [6, 10], increment: 5 },
    ] },
    "preferences.json": { units: "lb", timezone: "America/Chicago", rankings: { h_press: ["bench-press"] }, never: [] },
    "state.json": { plan: { day: "push" } },
    "workouts/2025.json": { "2025-12-30": { status: "completed", day: "push" } },
    "workouts/2026.json": { "2026-01-02": { status: "skipped", day: "pull" } },
    "engine/engine.js": "export const x = 1;",
  };
  const shas = Object.fromEntries(Object.keys(files).map((p) => [p, "sha-" + p]));
  const calls = [];
  const fetch = async (url, init = {}) => {
    const path = decodeURIComponent(new URL(url).pathname.replace("/repos/amkashyap1220/fitness-data/contents/", ""));
    calls.push({ path, method: init.method || "GET", auth: init.headers.Authorization, body: init.body });
    if (path === "workouts") return Response.json(Object.keys(files).filter((p) => p.startsWith("workouts/")).map((p) => ({ name: p.slice(9) })).concat([{ name: "README.md" }]));
    if (!(path in files)) return new Response("", { status: 404 });
    if (init.method === "PUT") {
      const body = JSON.parse(init.body);
      if (body.sha !== shas[path]) return new Response("", { status: 409 });
      files[path] = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0))));
      shas[path] += "+";
      return Response.json({});
    }
    const text = typeof files[path] === "string" ? files[path] : JSON.stringify(files[path]);
    if ((init.headers.Accept || "").includes("raw")) return new Response(text);
    return Response.json({ sha: shas[path], content: btoa(String.fromCharCode(...new TextEncoder().encode(text))) });
  };
  return { files, calls, fetch };
}

function env(extra = {}) {
  return {
    LOGIN_USERNAME: "alex", LOGIN_PASSWORD: "pw", FITNESS_GITHUB_TOKEN: "token",
    LOGIN_LIMITER: { limit: async () => ({ success: true }) },
    ASSETS: { fetch: async (req) => new Response("file " + new URL(req.url).pathname) },
    ...extra,
  };
}

async function cookie(e) {
  const res = await handleAuth(new Request(SITE + "/login", { method: "POST", body: new URLSearchParams({ username: "alex", password: "pw" }) }), e);
  return res.headers.getSetCookie().find((c) => c.startsWith("session=")).split(";")[0];
}

// Runs a request through the whole Worker with GitHub faked
async function call(r, e, path, init = {}) {
  const real = globalThis.fetch;
  globalThis.fetch = r.fetch;
  try { return await worker.fetch(new Request(API + path, init), e, { waitUntil() {} }); }
  finally { globalThis.fetch = real; }
}
const postJson = (c, body, origin = SITE) => ({ method: "POST", headers: { Cookie: c, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("signed out, the API answers 401 and never touches GitHub", async () => {
  const r = repo();
  const res = await call(r, env(), "data");
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");
  assert.equal(r.calls.length, 0);
});

test("signed in, the data comes back merged across year files and never cached", async () => {
  const r = repo(), e = env();
  const res = await call(r, e, "data", { headers: { Cookie: await cookie(e) } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");
  const data = await res.json();
  assert.deepEqual(Object.keys(data.workouts), ["2025-12-30", "2026-01-02"]);
  assert.equal(data.preferences.timezone, "America/Chicago");
  assert.equal(data.state.plan.day, "push");
  assert.ok(r.calls.every((c) => c.auth === "Bearer token"));
});

test("the plan engine is served as a script", async () => {
  const r = repo(), e = env();
  const res = await call(r, e, "engine.js", { headers: { Cookie: await cookie(e) } });
  assert.match(res.headers.get("Content-Type"), /^text\/javascript/);
  assert.equal(await res.text(), "export const x = 1;");
});

test("without the GitHub token set, it says so", async () => {
  const r = repo(), e = env({ FITNESS_GITHUB_TOKEN: "" });
  const res = await call(r, e, "data", { headers: { Cookie: await cookie(e) } });
  assert.equal(res.status, 503);
  assert.equal(r.calls.length, 0);
});

test("saving rankings from another site is refused", async () => {
  const r = repo(), e = env();
  const res = await call(r, e, "preferences", postJson(await cookie(e), { rankings: {}, never: [] }, "https://evil.example"));
  assert.equal(res.status, 403);
  assert.ok(!r.calls.some((c) => c.method === "PUT"));
});

test("rankings are checked: real lifts, in their own slot", async () => {
  const r = repo(), e = env(), c = await cookie(e);
  for (const body of [
    { rankings: { h_press: ["nope"] }, never: [] },
    { rankings: { h_press: ["ohp"] }, never: [] },
    { rankings: { nowhere: [] }, never: [] },
    { rankings: { h_press: ["bench-press", "bench-press"] }, never: [] },
    { rankings: {}, never: ["nope"] },
  ]) {
    const res = await call(r, e, "preferences", postJson(c, body));
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.ok(!r.calls.some((x) => x.method === "PUT"));
});

test("good rankings are saved, keeping the other settings", async () => {
  const r = repo(), e = env();
  const res = await call(r, e, "preferences", postJson(await cookie(e), { rankings: { h_press: ["db-bench-press", "bench-press"], v_press: [] }, never: ["ohp"] }));
  assert.equal(res.status, 200);
  assert.deepEqual(r.files["preferences.json"], { units: "lb", timezone: "America/Chicago", rankings: { h_press: ["db-bench-press", "bench-press"] }, never: ["ohp"] });
});

test("a new lift is added to the catalog, and only its own fields", async () => {
  const r = repo(), e = env();
  const lift = { name: "Landmine press", slot: "v_press", primary: ["front_delts"], secondary: ["triceps"], type: "compound", reps: [8, 12], increment: 5, equipment: "barbell", admin: true };
  const res = await call(r, e, "exercise", postJson(await cookie(e), { exercise: lift }));
  assert.equal(res.status, 200);
  const added = r.files["exercises.json"].exercises.at(-1);
  assert.equal(added.id, "landmine-press");
  assert.equal(added.custom, true);
  assert.equal(added.admin, undefined);
  // Same name again is refused
  const again = await call(r, e, "exercise", postJson(await cookie(e), { exercise: lift }));
  assert.equal(again.status, 400);
});

test("bad lifts are refused", async () => {
  const r = repo(), e = env(), c = await cookie(e);
  const ok = { name: "Cable press", slot: "h_press", primary: ["chest"], type: "compound", reps: [8, 12], increment: 5 };
  for (const bad of [{ name: "" }, { slot: "nowhere" }, { primary: [] }, { primary: ["wings"] }, { reps: [12, 8] }, { increment: 3 }, { type: "other" }, { id: "missing" }]) {
    const res = await call(r, e, "exercise", postJson(c, { exercise: { ...ok, ...bad } }));
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
});

test("moving a lift to another slot takes it out of the old slot's ranking", async () => {
  const r = repo(), e = env();
  const edit = { id: "bench-press", name: "Barbell bench press", slot: "v_press", primary: ["chest"], type: "compound", reps: [6, 10], increment: 5 };
  const res = await call(r, e, "exercise", postJson(await cookie(e), { exercise: edit }));
  assert.equal(res.status, 200);
  assert.equal(r.files["exercises.json"].exercises.find((x) => x.id === "bench-press").slot, "v_press");
  assert.deepEqual(r.files["preferences.json"].rankings.h_press, []);
});

test("a save that loses a race with another change asks to reload", async () => {
  const r = repo(), e = env();
  const real = r.fetch;
  r.fetch = async (url, init = {}) => {
    if (init.method === "PUT") return new Response("", { status: 409 });
    return real(url, init);
  };
  const res = await call(r, e, "preferences", postJson(await cookie(e), { rankings: {}, never: [] }));
  assert.equal(res.status, 409);
});
