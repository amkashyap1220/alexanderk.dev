/* ==========================================================================
   Login for the private section (/private/...).

   One username and password, no registration. They live as Worker secrets
   (Settings > Variables and Secrets), never in the repo:
     LOGIN_USERNAME, LOGIN_PASSWORD

   - GET  /login    the login page (login.html)
   - POST /login    checks the username and password; on success sets a
                    signed "session" cookie for 7 days
   - POST /logout   clears the cookie
   - /private/...   only served with a valid session; otherwise redirects
                    to /login, which sends you back after you log in

   The cookie is "<expiry>.<signature>": an HMAC of the expiry, keyed by the
   username and password. It can't be forged without the password, and
   changing the password logs out every device. HttpOnly, so page scripts
   can't read it.

   Wrong guesses are slowed by the LOGIN_LIMITER rate limiter (5 tries a
   minute per connection). It doesn't use KV, so it can't use up the KV
   writes the GitHub data needs.
   ========================================================================== */

const COOKIE = "session";
const SESSION_DAYS = 7;
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

const redirect = (to, headers = {}) => new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store", ...headers } });

const loginUrl = (next, error) => "/login?" + new URLSearchParams({ next, ...(error ? { error } : {}) });

// Private pages are never cached by browsers or shared caches, and never indexed
function privateResponse(res) {
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
    if (!(await loggedIn(request, env))) return redirect(loginUrl(nextPath(path)));
    return privateResponse(await env.ASSETS.fetch(request));
  }

  if (path === "/login" || path === "/login.html") {
    const next = nextPath(url.searchParams.get("next"));
    if (request.method === "GET" || request.method === "HEAD") {
      if (await loggedIn(request, env)) return redirect(next);
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

    const expires = Date.now() + SESSION_DAYS * 86400000;
    const cookie = `${COOKIE}=${expires}.${await signature(env, expires)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
    return redirect(sentNext, { "Set-Cookie": cookie });
  }

  if (path === "/logout") {
    if (request.method !== "POST") return redirect("/");
    return redirect("/", { "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
  }

  return null;
}
