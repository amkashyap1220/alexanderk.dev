// Tests for the login and private section in worker/auth.js (run with: node --test tests/)
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { handleAuth } from "../worker/auth.js";

const SITE = "https://alexanderk.dev";

// A fake Cloudflare environment: secrets, a rate limiter, and static files that echo their path
function env({ user = "alex", pass = "correct horse", allow = true } = {}) {
  const served = [];
  return {
    LOGIN_USERNAME: user,
    LOGIN_PASSWORD: pass,
    LOGIN_LIMITER: { limit: async () => ({ success: allow }) },
    ASSETS: { fetch: async (req) => { const p = new URL(req.url).pathname; served.push(p); return new Response("file " + p); } },
    served,
  };
}

const get = (path, cookie) => new Request(SITE + path, { headers: cookie ? { Cookie: cookie } : {} });
const post = (path, fields, cookie) => new Request(SITE + path, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", ...(cookie ? { Cookie: cookie } : {}) },
  body: new URLSearchParams(fields),
});
const cookies = (res) => res.headers.getSetCookie();
const cookieFrom = (res) => (cookies(res).find((c) => c.startsWith("session=")) || "").split(";")[0];

async function logIn(e, next = "/private/") {
  const res = await handleAuth(post("/login", { username: "alex", password: "correct horse", next }), e);
  return cookieFrom(res);
}

test("private pages redirect to the login without sending the file", async () => {
  const e = env();
  const res = await handleAuth(get("/private/notes.html"), e);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/login?next=%2Fprivate%2Fnotes.html");
  assert.deepEqual(e.served, []);
});

test("the right username and password set a secure session cookie and go back to the page", async () => {
  const e = env();
  const res = await handleAuth(post("/login", { username: "alex", password: "correct horse", next: "/private/notes.html" }), e);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/private/notes.html");
  const [sessionCookie, hintCookie] = cookies(res);
  assert.match(sessionCookie, /^session=\d+\.[\w-]+; Path=\/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax$/);
  // the display hint for the Private tab: readable by scripts, so NOT HttpOnly
  assert.equal(hintCookie, "signed_in=1; Path=/; Max-Age=604800; Secure; SameSite=Lax");
});

test("logged in, private pages are served and never cached", async () => {
  const e = env();
  const cookie = await logIn(e);
  const res = await handleAuth(get("/private/", cookie), e);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "file /private/");
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");
});

test("a wrong password or username doesn't log in", async () => {
  for (const fields of [{ username: "alex", password: "nope" }, { username: "bob", password: "correct horse" }, {}]) {
    const res = await handleAuth(post("/login", { next: "/private/", ...fields }), env());
    assert.equal(res.headers.get("Location"), "/login?next=%2Fprivate%2F&error=wrong");
    assert.deepEqual(cookies(res), []);
  }
});

test("forged, edited and expired cookies are rejected", async () => {
  const e = env();
  const [, sig] = (await logIn(e)).split(".");
  const later = Date.now() + 365 * 86400000;
  for (const cookie of ["session=" + later + "." + sig, "session=" + later + ".AAAA", "session=1000." + sig, "session=junk"]) {
    const res = await handleAuth(get("/private/", cookie), e);
    assert.equal(res.status, 303, cookie);
  }
});

test("changing the password logs out existing sessions", async () => {
  const cookie = await logIn(env());
  const res = await handleAuth(get("/private/", cookie), env({ pass: "a new password" }));
  assert.equal(res.status, 303);
});

test("after logging in, it only ever sends you into the private section", async () => {
  for (const next of ["https://evil.example", "//evil.example", "/private/../index.html", "/projects/", "javascript:alert(1)"]) {
    const res = await handleAuth(post("/login", { username: "alex", password: "correct horse", next }), env());
    assert.equal(res.headers.get("Location"), "/private/", next);
  }
});

test("too many tries are turned away before the password is checked", async () => {
  const res = await handleAuth(post("/login", { username: "alex", password: "correct horse", next: "/private/" }), env({ allow: false }));
  assert.equal(res.headers.get("Location"), "/login?next=%2Fprivate%2F&error=slow");
  assert.deepEqual(cookies(res), []);
});

test("without the secrets set, nothing private opens", async () => {
  const e = env({ user: "", pass: "" });
  assert.equal((await handleAuth(get("/private/", "session=1.x"), e)).status, 303);
  const res = await handleAuth(post("/login", { username: "", password: "", next: "/private/" }), e);
  assert.equal(res.headers.get("Location"), "/login?next=%2Fprivate%2F&error=setup");
});

test("the login page is served, or skipped when already logged in", async () => {
  const e = env();
  const page = await handleAuth(get("/login?next=/private/notes.html"), e);
  assert.equal(await page.text(), "file /login");
  const cookie = await logIn(e);
  const skip = await handleAuth(get("/login?next=/private/notes.html", cookie), e);
  assert.equal(skip.status, 303);
  assert.equal(skip.headers.get("Location"), "/private/notes.html");
});

test("logging out clears the session and hides the Private tab", async () => {
  const res = await handleAuth(post("/logout", {}), env());
  assert.equal(res.headers.get("Location"), "/");
  const [s, h] = cookies(res);
  assert.match(s, /^session=; Path=\/; Max-Age=0/);
  assert.match(h, /^signed_in=; Path=\/; Max-Age=0/);
});

test("the Private tab hint alone opens nothing, and an expired login clears it", async () => {
  const res = await handleAuth(get("/private/fitness-tracking.html", "signed_in=1"), env());
  assert.equal(res.status, 303);
  assert.match(cookies(res)[0], /^signed_in=; Path=\/; Max-Age=0/);
});

test("the rest of the site isn't affected", async () => {
  const e = env();
  assert.equal(await handleAuth(get("/projects/"), e), null);
  const res = await worker.fetch(get("/research/"), e, { waitUntil() {} });
  assert.equal(await res.text(), "file /research/");
});
