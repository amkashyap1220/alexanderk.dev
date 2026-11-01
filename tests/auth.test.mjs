// Tests for the unlock code and private section in worker/auth.js (run with: node --test tests/)
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { handleAuth } from "../worker/auth.js";

const SITE = "https://alexanderk.dev";

// A fake Cloudflare environment: secrets, a rate limiter, and static files that echo their path
function env({ code = "1234", allow = true, allowAll = true } = {}) {
  const served = [];
  const keys = [];
  return {
    UNLOCK_CODE: code,
    UNLOCK_LIMITER: { limit: async ({ key }) => (keys.push(key), { success: allow }) },
    UNLOCK_GLOBAL: { limit: async ({ key }) => (keys.push(key), { success: allowAll }) },
    keys,
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
  const res = await handleAuth(post("/unlock", { code: "1234", next }), e);
  return cookieFrom(res);
}

test("private pages redirect to the unlock page without sending the file", async () => {
  const e = env();
  const res = await handleAuth(get("/private/notes.html"), e);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/unlock?next=%2Fprivate%2Fnotes.html");
  assert.deepEqual(e.served, []);
});

test("the right code sets a secure session cookie and goes on to the page", async () => {
  const e = env();
  const res = await handleAuth(post("/unlock", { code: "1234", next: "/private/notes.html" }), e);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/private/notes.html");
  const [sessionCookie, hintCookie] = cookies(res);
  assert.match(sessionCookie, /^session=\d+\.[\w-]+; Path=\/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax$/);
  // the display hint for the Private tab: readable by scripts, so NOT HttpOnly
  assert.equal(hintCookie, "signed_in=1; Path=/; Max-Age=31536000; Secure; SameSite=Lax");
});

test("unlocked, private pages are served and never cached", async () => {
  const e = env();
  const cookie = await logIn(e);
  const res = await handleAuth(get("/private/", cookie), e);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "file /private/");
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");
});

test("a wrong code doesn't unlock", async () => {
  for (const fields of [{ code: "1243" }, { code: "12345" }, { code: "" }, {}]) {
    const res = await handleAuth(post("/unlock", { next: "/private/", ...fields }), env());
    assert.equal(res.headers.get("Location"), "/unlock?next=%2Fprivate%2F&error=wrong");
    assert.deepEqual(cookies(res), []);
  }
});

test("forged, edited and expired cookies are rejected", async () => {
  const e = env();
  const [, sig] = (await logIn(e)).split(".");
  const later = Date.now() + 5 * 365 * 86400000;   // a different expiry than the real one
  for (const cookie of ["session=" + later + "." + sig, "session=" + later + ".AAAA", "session=1000." + sig, "session=junk"]) {
    const res = await handleAuth(get("/private/", cookie), e);
    assert.equal(res.status, 303, cookie);
  }
});

test("changing the code locks existing sessions out", async () => {
  const cookie = await logIn(env());
  const res = await handleAuth(get("/private/", cookie), env({ code: "9876" }));
  assert.equal(res.status, 303);
});

test("once unlocked, it only ever sends you into the private section", async () => {
  for (const next of ["https://evil.example", "//evil.example", "/private/../index.html", "/projects/", "javascript:alert(1)"]) {
    const res = await handleAuth(post("/unlock", { code: "1234", next }), env());
    assert.equal(res.headers.get("Location"), "/private/", next);
  }
});

test("too many tries, from one connection or from everyone, are turned away before the code is checked", async () => {
  for (const limits of [{ allow: false }, { allowAll: false }]) {
    const res = await handleAuth(post("/unlock", { code: "1234", next: "/private/" }), env(limits));
    assert.equal(res.headers.get("Location"), "/unlock?next=%2Fprivate%2F&error=slow");
    assert.deepEqual(cookies(res), []);
  }
});

test("every try counts against the connection's limit and the shared one", async () => {
  const e = env();
  await handleAuth(new Request(SITE + "/unlock", { method: "POST", headers: { "CF-Connecting-IP": "203.0.113.9" }, body: new URLSearchParams({ code: "0000" }) }), e);
  assert.deepEqual(e.keys, ["unlock:203.0.113.9", "unlock"]);
});

test("spaces around the code are ignored", async () => {
  const res = await handleAuth(post("/unlock", { code: " 1234 ", next: "/private/" }), env());
  assert.equal(res.headers.get("Location"), "/private/");
});

test("without the secrets set, nothing private opens", async () => {
  const e = env({ code: "" });
  assert.equal((await handleAuth(get("/private/", "session=1.x"), e)).status, 303);
  const res = await handleAuth(post("/unlock", { code: "", next: "/private/" }), e);
  assert.equal(res.headers.get("Location"), "/unlock?next=%2Fprivate%2F&error=setup");
});

test("the unlock page is served, or skipped when already unlocked", async () => {
  const e = env();
  const page = await handleAuth(get("/unlock?next=/private/notes.html"), e);
  assert.equal(await page.text(), "file /unlock");
  const cookie = await logIn(e);
  const skip = await handleAuth(get("/unlock?next=/private/notes.html", cookie), e);
  assert.equal(skip.status, 303);
  assert.equal(skip.headers.get("Location"), "/private/notes.html");
});

test("locking clears the session and hides the Private tab (the old /logout too)", async () => {
  for (const path of ["/lock", "/logout"]) {
    const res = await handleAuth(post(path, {}), env());
    assert.equal(res.headers.get("Location"), "/");
    const [s, h] = cookies(res);
    assert.match(s, /^session=; Path=\/; Max-Age=0/);
    assert.match(h, /^signed_in=; Path=\/; Max-Age=0/);
  }
});

test("the old login address sends you to the unlock page", async () => {
  const res = await handleAuth(get("/login?next=/private/notes.html"), env());
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/unlock?next=%2Fprivate%2Fnotes.html");
});

test("the Private tab hint alone opens nothing, and an expired session clears it", async () => {
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

test("opening a private page renews the session and the Private tab, so it stays unlocked", async () => {
  const e = env();
  const cookie = await logIn(e);
  const res = await handleAuth(get("/private/fitness-tracking.html", cookie), e);
  assert.equal(res.status, 200);
  const [renewed, tab] = cookies(res);
  assert.match(renewed, /^session=\d+\.[\w-]+; Path=\/; Max-Age=31536000; HttpOnly/);
  assert.equal(tab, "signed_in=1; Path=/; Max-Age=31536000; Secure; SameSite=Lax");
  // the renewed session works on its own
  assert.equal((await handleAuth(get("/private/", renewed.split(";")[0]), e)).status, 200);
});

test("unlocked without the tab hint (e.g. from before it existed), the unlock page restores it", async () => {
  const e = env();
  const cookie = await logIn(e);   // session only, no signed_in cookie sent back
  const res = await handleAuth(get("/unlock", cookie), e);
  assert.equal(res.status, 303);
  assert.ok(cookies(res).includes("signed_in=1; Path=/; Max-Age=31536000; Secure; SameSite=Lax"));
});

