/* ==========================================================================
   The code that unlocks the private section (/private/...).

   One shared code, no usernames and no sign-up. It lives as a Worker secret
   (Settings > Variables and Secrets), never in the repo:
     UNLOCK_CODE

   - GET  /unlock   the unlock page (unlock.html); the lock icon in the
                    header opens the same box in place
   - POST /unlock   checks the code; on success sets a signed "session"
                    cookie for a year, renewed each time you open a
                    private page
   - POST /lock     clears the cookie
   - /login         old address: sends you to /unlock
   - /private/...   only served with a valid session; otherwise redirects
                    to /unlock, which sends you back once it's unlocked

   The cookie is "<expiry>.<signature>": an HMAC of the expiry, keyed by the
   code. It can't be forged without the code, and changing the code locks
   every device out. HttpOnly, so page scripts can't read it. A second
   cookie, signed_in=1, is readable by the pages only so they can show the
   Private tab (js/signed-in.js); it unlocks nothing by itself.

   A short code is easy to guess by trying them all, so wrong guesses are
   slowed twice over, without KV (so they can't use up the KV writes the
   GitHub data needs):
     UNLOCK_LIMITER   5 tries a minute per connection
     UNLOCK_GLOBAL    10 tries a minute for everyone together (counted per
                      Cloudflare location), so switching connections
                      doesn't help much either
   ========================================================================== */

const COOKIE = "session";
const SESSION_DAYS = 365;   // and renewed every time a private page opens, so it stays unlocked
const enc = new TextEncoder();

const configured = (env) => Boolean(env.UNLOCK_CODE);

// Equal without leaking how much matched through timing: compare hashes, byte by byte, all the way through
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest("SHA-256", enc.encode(String(s)))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

async function signature(env, expires) {
  const key = await crypto.subtle.importKey("raw", enc.encode("session|" + env.UNLOCK_CODE),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(String(expires))));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function unlocked(request, env) {
  if (!configured(env)) return false;
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)session=(\d+)\.([\w-]+)/);
  if (!m || Number(m[1]) < Date.now()) return false;
  return safeEqual(m[2], await signature(env, m[1]));
}

// Only ever send people on into the private section (never to another site)
function nextPath(value) {
  return typeof value === "string" && /^\/private(\/[\w\-./]*)?$/.test(value) && !value.includes("..") ? value : "/private/";
}

// A redirect, optionally setting cookies (each Set-Cookie must be its own header)
function redirect(to, cookies = []) {
  const headers = new Headers({ Location: to, "Cache-Control": "no-store" });
  cookies.forEach((c) => headers.append("Set-Cookie", c));
  return new Response(null, { status: 303, headers });
}

// "signed_in=1" is only a display hint: it tells the pages' scripts to show the Private tab.
// It grants nothing; the HttpOnly session cookie is what the Worker checks.
const MAX_AGE = SESSION_DAYS * 86400;
const hint = (on) => `signed_in=${on ? 1 : ""}; Path=/; Max-Age=${on ? MAX_AGE : 0}; Secure; SameSite=Lax`;
const session = (value) => `${COOKIE}=${value}; Path=/; Max-Age=${value ? MAX_AGE : 0}; HttpOnly; Secure; SameSite=Lax`;

// A new session (and the Private tab hint), good for another SESSION_DAYS from now
async function freshCookies(env) {
  const expires = Date.now() + SESSION_DAYS * 86400000;
  return [session(`${expires}.${await signature(env, expires)}`), hint(true)];
}

const unlockUrl = (next, error) => "/unlock?" + new URLSearchParams({ next, ...(error ? { error } : {}) });

// Private pages are never cached by browsers or shared caches, and never indexed
export function privateResponse(res) {
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "private, no-store");
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  return out;
}

// Handles /unlock, /lock, /login and /private/...; returns null for anything else
export async function handleAuth(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/private" || path.startsWith("/private/")) {
    if (!(await unlocked(request, env))) return redirect(unlockUrl(nextPath(path)), [hint(false)]);   // expired: hide the tab too
    // Unlocked: renew the session and the tab hint, so it stays unlocked as long as you keep visiting
    const res = privateResponse(await env.ASSETS.fetch(request));
    (await freshCookies(env)).forEach((c) => res.headers.append("Set-Cookie", c));
    return res;
  }

  // The old login page's address, for bookmarks
  if (path === "/login" || path === "/login.html") {
    return redirect(unlockUrl(nextPath(url.searchParams.get("next"))));
  }

  if (path === "/unlock" || path === "/unlock.html") {
    const next = nextPath(url.searchParams.get("next"));
    if (request.method === "GET" || request.method === "HEAD") {
      if (await unlocked(request, env)) return redirect(next, await freshCookies(env));   // also restores a missing tab hint
      return privateResponse(await env.ASSETS.fetch(new Request(new URL("/unlock", url), request)));
    }
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });

    const form = await request.formData().catch(() => null);
    const sentNext = nextPath(form && form.get("next"));
    if (!configured(env)) return redirect(unlockUrl(sentNext, "setup"));

    // Per connection first, then everyone together; both before the code is checked
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    for (const [limiter, key] of [[env.UNLOCK_LIMITER, "unlock:" + ip], [env.UNLOCK_GLOBAL, "unlock"]]) {
      if (limiter && !(await limiter.limit({ key })).success) return redirect(unlockUrl(sentNext, "slow"));
    }

    const code = String((form && form.get("code")) || "").trim();
    if (!(await safeEqual(code, env.UNLOCK_CODE))) return redirect(unlockUrl(sentNext, "wrong"));

    return redirect(sentNext, await freshCookies(env));
  }

  if (path === "/lock" || path === "/logout") {
    if (request.method !== "POST") return redirect("/");
    return redirect("/", [session(""), hint(false)]);
  }

  return null;
}
