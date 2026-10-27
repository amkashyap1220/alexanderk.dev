/* ==========================================================================
   Login for the private section (/private/...).

   One username and password, no registration. They live as Worker secrets
   (Settings > Variables and Secrets), never in the repo:
     LOGIN_USERNAME, LOGIN_PASSWORD

   - GET  /login    the login page (login.html)
   - POST /login    checks the username and password; on success sets a
                    signed "session" cookie for a year, renewed each
                    time you open a private page
   - POST /logout   clears the cookie
   - /private/...   only served with a valid session; otherwise redirects
                    to /login, which sends you back after you log in

   The cookie is "<expiry>.<signature>": an HMAC of the expiry, keyed by the
   username and password. It can't be forged without the password, and
   changing the password logs out every device. HttpOnly, so page scripts
   can't read it. A second cookie, signed_in=1, is readable by the pages
   only so they can show the Private tab (js/signed-in.js); it unlocks
   nothing by itself.

   Wrong guesses are slowed by the LOGIN_LIMITER rate limiter (5 tries a
   minute per connection). It doesn't use KV, so it can't use up the KV
   writes the GitHub data needs.
   ========================================================================== */

const COOKIE = "session";
const SESSION_DAYS = 365;   // and renewed every time a private page opens, so you stay logged in
const enc = new TextEncoder();

const configured = (env) => Boolean(env.LOGIN_USERNAME && env.LOGIN_PASSWORD);

// Equal without leaking how much matched through timing: compare hashes, byte by byte, all the way through
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest("SHA-256", enc.encode(String(s)))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

async function signature(env, expires) {
  const key = await crypto.subtle.importKey("raw", enc.encode("session|" + env.LOGIN_USERNAME + "|" + env.LOGIN_PASSWORD),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(String(expires))));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function loggedIn(request, env) {
  if (!configured(env)) return false;
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)session=(\d+)\.([\w-]+)/);
  if (!m || Number(m[1]) < Date.now()) return false;
  return safeEqual(m[2], await signature(env, m[1]));
}

// Only ever send people back into the private section (never to another site)
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

const loginUrl = (next, error) => "/login?" + new URLSearchParams({ next, ...(error ? { error } : {}) });

// Private pages are never cached by browsers or shared caches, and never indexed
export function privateResponse(res) {
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "private, no-store");
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  return out;
}

// Handles /login, /logout and /private/...; returns null for anything else
export async function handleAuth(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/private" || path.startsWith("/private/")) {
    if (!(await loggedIn(request, env))) return redirect(loginUrl(nextPath(path)), [hint(false)]);   // expired: hide the tab too
    // Logged in: renew the session and the tab hint, so you stay logged in as long as you keep visiting
    const res = privateResponse(await env.ASSETS.fetch(request));
    (await freshCookies(env)).forEach((c) => res.headers.append("Set-Cookie", c));
    return res;
  }

  if (path === "/login" || path === "/login.html") {
    const next = nextPath(url.searchParams.get("next"));
    if (request.method === "GET" || request.method === "HEAD") {
      if (await loggedIn(request, env)) return redirect(next, await freshCookies(env));   // also restores a missing tab hint
      return privateResponse(await env.ASSETS.fetch(new Request(new URL("/login", url), request)));
    }
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });

    const form = await request.formData().catch(() => null);
    const sentNext = nextPath(form && form.get("next"));
    if (!configured(env)) return redirect(loginUrl(sentNext, "setup"));

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (env.LOGIN_LIMITER) {
      const { success } = await env.LOGIN_LIMITER.limit({ key: "login:" + ip });
      if (!success) return redirect(loginUrl(sentNext, "slow"));
    }

    const [userOk, passOk] = await Promise.all([
      safeEqual(form ? form.get("username") || "" : "", env.LOGIN_USERNAME),
      safeEqual(form ? form.get("password") || "" : "", env.LOGIN_PASSWORD),
    ]);
    if (!userOk || !passOk) return redirect(loginUrl(sentNext, "wrong"));

    return redirect(sentNext, await freshCookies(env));
  }

  if (path === "/logout") {
    if (request.method !== "POST") return redirect("/");
    return redirect("/", [session(""), hint(false)]);
  }

  return null;
}
