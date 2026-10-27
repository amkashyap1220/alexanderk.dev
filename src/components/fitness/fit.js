// Helpers shared by the fitness dashboard's panels (Dashboard.svelte and the
// files next to it). Nothing here touches the page: it's formatting, axis
// math and the calls to the Worker's fitness API (worker/fitness.js).

export const API = "/private/api/fitness/";
export const DAY_COLOR = { push: "var(--s1)", pull: "var(--s2)", legs: "var(--s3)" };
export const MACHINE_COLOR = { treadmill: "var(--s1)", bike: "var(--s2)", elliptical: "var(--s3)" };

export const fmtDate = (d, opts = { month: "short", day: "numeric" }) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
export const nameOf = (D, id) => (D.exercises.exercises.find((e) => e.id === id) || { name: id }).name;
export const dayName = (D, d) => (D.program.days[d] ? D.program.days[d].name : d || "Workout");
export const liftsOf = (s) => (s.lifts || []).filter((l) => (l.sets || []).length);
export const cardioOf = (s) => (Array.isArray(s.cardio) ? s.cardio : s.cardio ? [s.cardio] : []);
export const setsText = (sets) => {
  const groups = [];
  sets.forEach((s) => { const g = groups.at(-1); if (g && g.w === s.weight) g.r.push(s.reps); else groups.push({ w: s.weight, r: [s.reps] }); });
  return groups.map((g) => `${g.w || "BW"} × ${g.r.join(", ")}`).join(" · ");
};

// Round axis steps: 1, 2, 5 × 10^n
export function ticks(lo, hi, count = 4) {
  const span = hi - lo || 1;
  const raw = span / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.floor(lo / step) * step; ; v += step) {
    out.push(Math.round(v * 100) / 100);
    if (v >= hi - 1e-9) return out;
  }
}

// The first of each month between two dates, as YYYY-MM-DD
export function monthStarts(x0, x1) {
  const months = [];
  for (let d = new Date(x0); d.getTime() <= x1; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDate() === 1) months.push(d.toISOString().slice(0, 10));
  return months;
}

export async function post(path, body) {
  const res = await fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `Error ${res.status}`);
  return out;
}
