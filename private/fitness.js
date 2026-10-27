/* ==========================================================================
   Fitness dashboard (private/fitness-tracking.html).

   The data comes from /private/api/fitness/data (worker/fitness.js reads the
   fitness-data repo), and the plan engine itself from
   /private/api/fitness/engine.js: the same code the daily Claude session
   runs, so "Up next" here always matches what the session will suggest,
   including ranking changes you haven't saved into a session yet.

     1. LOAD     fetch the data and the engine
     2. DRAW     up next, stats, body weight, weak areas, strength,
                 calendar, volume, cardio, history (charts are plain SVG)
     3. EDIT     rank lifts, mark "never", ask for a new lift (plain
                 text the next daily session turns into a catalog entry);
                 saved through the Worker into fitness-data
   ========================================================================== */

const API = "/private/api/fitness/";
const DAY_COLOR = { push: "var(--s1)", pull: "var(--s2)", legs: "var(--s3)" };
const MACHINE_COLOR = { treadmill: "var(--s1)", bike: "var(--s2)", elliptical: "var(--s3)" };
const SVG = "http://www.w3.org/2000/svg";

let D, E, A, today;      // data, engine, analysis, today's date
const $ = (id) => document.getElementById(id);

// <tag attrs>children</tag>, with text always set as text (lift names are typed by hand)
function el(tag, attrs = {}, ...children) {
  const node = tag.startsWith("svg:") ? document.createElementNS(SVG, tag.slice(4)) : document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === null || v === undefined || v === false) return;
    if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  });
  children.flat().forEach((c) => c !== null && c !== undefined && node.append(c));
  return node;
}

const fmtDate = (d, opts = { month: "short", day: "numeric" }) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
const nameOf = (id) => (D.exercises.exercises.find((e) => e.id === id) || { name: id }).name;
const dayName = (d) => (D.program.days[d] ? D.program.days[d].name : d || "Workout");
const liftsOf = (s) => (s.lifts || []).filter((l) => (l.sets || []).length);
const cardioOf = (s) => (Array.isArray(s.cardio) ? s.cardio : s.cardio ? [s.cardio] : []);
const setsText = (sets) => {
  const groups = [];
  sets.forEach((s) => { const g = groups.at(-1); if (g && g.w === s.weight) g.r.push(s.reps); else groups.push({ w: s.weight, r: [s.reps] }); });
  return groups.map((g) => `${g.w || "BW"} × ${g.r.join(", ")}`).join(" · ");
};

/* ---------- tooltip: any element with data-tip, or a chart's own handler ---------- */
const tip = $("fit-tip");
function showTip(x, y, title, lines) {
  tip.replaceChildren(el("b", { text: title }), ...lines.map((l) => el("div", { text: l })));
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.max(8, Math.min(window.innerWidth - r.width - 8, x + 12)) + "px";
  tip.style.top = Math.max(8, y - r.height - 12) + "px";
}
const hideTip = () => { tip.hidden = true; };
document.addEventListener("pointermove", (e) => {
  const t = e.target.closest && e.target.closest("[data-tip]");
  if (t) { const [title, ...lines] = t.dataset.tip.split("\n"); showTip(e.clientX, e.clientY, title, lines); }
  else if (!e.target.closest || !e.target.closest("[data-chart]")) hideTip();
});
document.addEventListener("scroll", hideTip, { passive: true });

function tableView(head, rows) {
  return el("details", { class: "fit-table" }, el("summary", { text: "Show as a table" }),
    el("table", {}, el("thead", {}, el("tr", {}, head.map((h) => el("th", { text: h })))),
      el("tbody", {}, rows.map((r) => el("tr", {}, r.map((c) => el("td", { text: c })))))));
}

// Round axis steps: 1, 2, 5 × 10^n
function ticks(lo, hi, count = 4) {
  const span = hi - lo || 1;
  const raw = span / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.floor(lo / step) * step; ; v += step) {
    out.push(Math.round(v * 100) / 100);
    if (v >= hi - 1e-9) return out;
  }
}


/* ================================================================ 1. load */
async function load() {
  const status = $("fit-status");
  try {
    const [res, engine] = await Promise.all([fetch(API + "data", { cache: "no-store" }), import(API + "engine.js")]);
    if (res.status === 401) { location.href = "/login?next=" + encodeURIComponent(location.pathname); return; }
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.status);
    D = body; E = engine;
    today = E.localDate(D.preferences.timezone || "America/Chicago");
    A = E.analyze({ ...D, date: today, weeks: 16 });
    status.hidden = true;
    $("fit-app").hidden = false;
    drawAll();
    onWidthChange(drawCardio);
    onWidthChange(drawWeight);
    setUpEditor();
  } catch (err) {
    status.textContent = "Couldn't load your workouts: " + err.message;
    status.classList.add("error");
  }
}


/* ================================================================ 2. draw */
// The wide charts are drawn at the page's real width, so their text stays readable on a phone
let width = window.innerWidth, timer;
const redraws = [];
const onWidthChange = (fn) => redraws.push(fn);
window.addEventListener("resize", () => {
  if (window.innerWidth === width) return;   // phones fire resize when the address bar hides
  width = window.innerWidth;
  clearTimeout(timer);
  timer = setTimeout(() => redraws.forEach((fn) => fn()), 150);
});

function drawAll() {
  drawNext();
  drawStats();
  drawWeight();
  drawWeak();
  drawLiftPicker();
  drawCalendar();
  drawVolume();
  drawCardio();
  drawHistory();
}

function drawNext() {
  const box = $("fit-next");
  const plan = E.computePlan({ ...D, date: today });
  const entry = D.workouts[today];
  const inProgress = entry && entry.status === "in_progress";
  const head = el("div", { class: "fit-next-head" },
    el("span", { class: "fit-next-title" }, el("span", { class: "fit-day", style: `--c:${DAY_COLOR[plan.day]}` }), `${plan.dayName} day #${plan.number}`),
    el("span", { class: "muted", text: inProgress ? "In progress today" : entry && entry.status === "completed" ? "Next session" : "Today" }));

  const done = (id) => inProgress && liftsOf(entry).find((l) => l.exercise === id);
  const items = [el("li", { class: "cardio" },
    el("div", { class: "fit-lift" }, el("span", {}, el("b", { text: `${plan.cardio.minutes} min cardio` }), ` on the ${plan.cardio.machine}`)),
    el("div", { class: "fit-why", text: `Or any of treadmill, bike, elliptical. Suggested: ${plan.cardio.why}.` }))];
  plan.lifts.forEach((l) => {
    const w = l.weight === null ? "pick a weight" : l.weight === 0 ? "bodyweight" : `${l.weight} lb`;
    const logged = done(l.exercise);
    items.push(el("li", {},
      el("div", { class: "fit-lift" }, el("b", { text: l.name }), el("span", { text: `${l.sets} × ${l.reps[0]}–${l.reps[1]} @ ${w}` })),
      el("div", { class: "fit-why", text: logged ? `Logged today: ${setsText(logged.sets)}` : `${l.note}. ${l.flex ? "Fifth lift" : l.slotName}: ${l.why}.` })));
  });
  box.replaceChildren(head, el("ol", {}, items), ...plan.notes.map((n) => el("p", { class: "fit-notes", text: n })));
}

function drawStats() {
  const list = E.sessions(D.workouts);
  const done = list.filter((s) => s.status === "completed");
  const week = E.weekStart(today);
  const thisWeek = done.filter((s) => s.date >= week);
  const last30 = done.filter((s) => E.daysBetween(s.date, today) < 30);
  const cardio = list.filter((s) => s.date >= week).flatMap(cardioOf).reduce((t, c) => t + (c.minutes || 0), 0);
  const tile = (value, label) => el("div", { class: "card stat" }, el("dt", { class: "stat-label", text: label }), el("dd", { class: "stat-value", text: value }));
  $("fit-stats").replaceChildren(
    tile(String(last30.length), "workouts, last 30 days"),
    tile(String(thisWeek.length), "workouts this week"),
    tile(`${cardio}`, "cardio minutes this week"),
    tile(A.adherence === null ? "–" : `${A.adherence}%`, "of planned lifts done"));
}

function drawWeak() {
  const box = $("fit-weak");
  if (!E.sessions(D.workouts).some((s) => liftsOf(s).length)) {
    box.replaceChildren(el("p", { class: "empty", text: "Shows up after a couple of weeks of logged workouts." }));
    return;
  }
  const cards = A.weakAreas.slice(0, 8).map((w) => {
    const level = w.kind === "volume" ? (A.volume.find((v) => v.muscle === w.muscle).status === "low" ? "bad" : "warn") : "warn";
    const label = { volume: "Low volume", stall: "Stalled", imbalance: "Imbalance" }[w.kind];
    return el("article", { class: "card fit-weak" }, el("p", { class: `card-label ${level}`, text: label }),
      el("h3", { class: "card-title", text: w.label }), el("p", { class: "card-text", text: w.detail }));
  });
  box.replaceChildren(...(cards.length ? cards : [el("p", { class: "empty", text: "No weak spots right now: every muscle is in its target and every lift is still moving." })]));
}

/* ---------- body weight: weigh-ins and their 7-day average ---------- */
function drawWeight() {
  const box = $("fit-weight-chart");
  const { points, latest, change7, change30 } = E.weightTrend(D.bodyweight || {}, today);
  if (!latest) { box.replaceChildren(el("p", { class: "empty", text: "Tell your daily session your weight to start the graph." })); return; }
  const signed = (v) => (v === null ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)} lb`);
  const stats = el("div", { class: "fit-weight-stats" },
    el("span", {}, el("b", { text: `${latest.weight} lb` }), el("span", { class: "muted", text: ` on ${fmtDate(latest.date)}` })),
    el("span", {}, el("b", { text: signed(change7) }), el("span", { class: "muted", text: " past 7 days" })),
    el("span", {}, el("b", { text: signed(change30) }), el("span", { class: "muted", text: " past 30 days" })));
  const table = tableView(["Date", "Weigh-in (lb)", "7-day average (lb)"], [...points].reverse().map((p) => [p.date, String(p.weight), String(p.trend)]));
  if (points.length < 2) { box.replaceChildren(stats, el("p", { class: "empty", text: "The graph starts with your second weigh-in." }), table); return; }

  const W = Math.max(300, box.clientWidth || 760), H = 240, L = 44, R = 72, T = 16, B = 32;
  const t = (d) => Date.parse(d);
  const x0 = t(points[0].date), x1 = Math.max(t(latest.date), x0 + 7 * 864e5);
  const vals = points.flatMap((p) => [p.weight, p.trend]);
  const yt = ticks(Math.min(...vals) - 1, Math.max(...vals) + 1);
  const X = (d) => L + ((t(d) - x0) / (x1 - x0)) * (W - L - R);
  const Y = (v) => T + (1 - (v - yt[0]) / (yt.at(-1) - yt[0])) * (H - T - B);
  const svg = el("svg:svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Body weight over time: weigh-ins and 7-day average", "data-chart": "" });
  yt.forEach((v) => svg.append(
    el("svg:line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: "var(--border)" }),
    el("svg:text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "var(--muted)", text: v })));
  const months = [];
  for (let d = new Date(x0); d.getTime() <= x1; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDate() === 1) months.push(d.toISOString().slice(0, 10));
  const labels = months.length ? months : [points[0].date, latest.date];
  labels.forEach((d) => svg.append(el("svg:text", { x: X(d), y: H - 10, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)", text: fmtDate(d, months.length ? { month: "short" } : undefined) })));
  points.forEach((p) => svg.append(el("svg:circle", { cx: X(p.date), cy: Y(p.weight), r: 3, fill: "var(--bg)", stroke: "var(--muted)", "stroke-width": 1.5 })));
  svg.append(el("svg:polyline", { points: points.map((p) => `${X(p.date)},${Y(p.trend)}`).join(" "), fill: "none", stroke: "var(--s1)", "stroke-width": 2.5, "stroke-linejoin": "round" }));
  svg.append(el("svg:text", { x: X(latest.date) + 10, y: Y(latest.trend) + 4, "font-size": 12, fill: "var(--text)", text: `${latest.trend} lb` }));
  const cross = el("svg:line", { y1: T, y2: H - B, stroke: "var(--muted)", "stroke-dasharray": "3 3", visibility: "hidden" });
  const hit = el("svg:rect", { x: L, y: T, width: W - L - R, height: H - T - B, fill: "transparent" });
  svg.append(cross, hit);
  hit.addEventListener("pointermove", (e) => {
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const p = points.reduce((a, b) => (Math.abs(X(b.date) - sx) < Math.abs(X(a.date) - sx) ? b : a));
    cross.setAttribute("x1", X(p.date)); cross.setAttribute("x2", X(p.date)); cross.setAttribute("visibility", "visible");
    showTip(e.clientX, e.clientY, fmtDate(p.date, { month: "short", day: "numeric", year: "numeric" }), [`Weigh-in ${p.weight} lb`, `7-day average ${p.trend} lb`]);
  });
  hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); hideTip(); });
  const legend = el("ul", { class: "fit-legend" },
    el("li", {}, el("span", { class: "fit-swatch", style: "--c:var(--s1)" }), "7-day average"),
    el("li", {}, el("span", { class: "fit-swatch skip" }), "Weigh-in"));
  box.replaceChildren(stats, svg, legend, table);
}

/* ---------- strength: one lift at a time ---------- */
function drawLiftPicker() {
  const select = $("fit-lift");
  const ids = Object.keys(A.strength).sort((a, b) => A.strength[b].length - A.strength[a].length);
  if (!ids.length) {
    select.hidden = true;
    $("fit-lift").previousElementSibling.hidden = true;
    $("fit-strength").replaceChildren(el("p", { class: "empty", text: "Log a few sessions to see your strength over time." }));
    return;
  }
  select.replaceChildren(...ids.map((id) => el("option", { value: id, text: `${nameOf(id)} (${A.strength[id].length})` })));
  select.onchange = () => drawStrength(select.value);
  drawStrength(ids[0]);
  onWidthChange(() => drawStrength(select.value));
}

function drawStrength(id) {
  const pts = A.strength[id];
  const W = Math.max(300, $("fit-strength").clientWidth || 760), H = 260, L = 44, R = 72, T = 16, B = 32;
  const t = (d) => Date.parse(d);
  const x0 = t(pts[0].date), x1 = Math.max(t(pts.at(-1).date), x0 + 7 * 864e5);
  const vals = pts.map((p) => p.e1rm);
  const yt = ticks(Math.min(...vals) * 0.95, Math.max(...vals) * 1.03);
  const X = (d) => L + ((t(d) - x0) / (x1 - x0)) * (W - L - R);
  const Y = (v) => T + (1 - (v - yt[0]) / (yt.at(-1) - yt[0])) * (H - T - B);
  const svg = el("svg:svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${nameOf(id)}: estimated 1-rep max over time`, "data-chart": "" });
  yt.forEach((v) => svg.append(
    el("svg:line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: "var(--border)" }),
    el("svg:text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "var(--muted)", text: v })));
  const months = [];
  for (let d = new Date(x0); d.getTime() <= x1; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDate() === 1) months.push(d.toISOString().slice(0, 10));
  const labels = months.length ? months : [pts[0].date, pts.at(-1).date];
  labels.forEach((d) => svg.append(el("svg:text", { x: X(d), y: H - 10, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)", text: fmtDate(d, months.length ? { month: "short" } : undefined) })));
  svg.append(el("svg:polyline", { points: pts.map((p) => `${X(p.date)},${Y(p.e1rm)}`).join(" "), fill: "none", stroke: "var(--s1)", "stroke-width": 2, "stroke-linejoin": "round" }));
  pts.forEach((p) => svg.append(el("svg:circle", { cx: X(p.date), cy: Y(p.e1rm), r: p.pr ? 5 : 3, fill: p.pr ? "var(--s1)" : "var(--bg)", stroke: "var(--s1)", "stroke-width": 2 })));
  // Label the latest value directly
  const lastPt = pts.at(-1);
  svg.append(el("svg:text", { x: X(lastPt.date) + 10, y: Y(lastPt.e1rm) + 4, "font-size": 12, fill: "var(--text)", text: `${lastPt.e1rm} lb` }));
  // Crosshair + tooltip on the nearest session
  const cross = el("svg:line", { y1: T, y2: H - B, stroke: "var(--muted)", "stroke-dasharray": "3 3", visibility: "hidden" });
  const hit = el("svg:rect", { x: L, y: T, width: W - L - R, height: H - T - B, fill: "transparent" });
  svg.append(cross, hit);
  hit.addEventListener("pointermove", (e) => {
    const box = svg.getBoundingClientRect();
    const sx = ((e.clientX - box.left) / box.width) * W;
    const p = pts.reduce((a, b) => (Math.abs(X(b.date) - sx) < Math.abs(X(a.date) - sx) ? b : a));
    cross.setAttribute("x1", X(p.date)); cross.setAttribute("x2", X(p.date)); cross.setAttribute("visibility", "visible");
    showTip(e.clientX, e.clientY, fmtDate(p.date, { month: "short", day: "numeric", year: "numeric" }), [`Est. 1RM ${p.e1rm} lb${p.pr ? " (new best)" : ""}`, `Best set ${p.weight} × ${p.reps}`]);
  });
  hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); hideTip(); });
  $("fit-strength").replaceChildren(svg, tableView(["Date", "Best set", "Est. 1RM (lb)"], [...pts].reverse().map((p) => [p.date, `${p.weight} × ${p.reps}${p.pr ? " (best)" : ""}`, String(p.e1rm)])));
}

/* ---------- consistency: one square per day, last 16 weeks ---------- */
function drawCalendar() {
  const weeks = 16, cell = 14, gap = 3, L = 30, T = 18;
  const start = E.addDays(E.weekStart(today), -7 * (weeks - 1));
  const byDate = Object.fromEntries(A.days.map((d) => [d.date, d]));
  const W = L + weeks * (cell + gap), H = T + 7 * (cell + gap);
  const svg = el("svg:svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Workouts, skips and rest days over the last 16 weeks", style: `max-width:${Math.round(W * 1.6)}px` });
  ["Mon", "Wed", "Fri"].forEach((d, i) => svg.append(el("svg:text", { x: 0, y: T + i * 2 * (cell + gap) + cell - 3, "font-size": 9, fill: "var(--muted)", text: d })));
  for (let w = 0; w < weeks; w++) {
    const monday = E.addDays(start, 7 * w);
    if (w === 0 || monday.slice(5, 7) !== E.addDays(monday, -7).slice(5, 7)) svg.append(el("svg:text", { x: L + w * (cell + gap), y: 10, "font-size": 9, fill: "var(--muted)", text: fmtDate(monday, { month: "short" }) }));
    for (let i = 0; i < 7; i++) {
      const date = E.addDays(monday, i);
      if (date > today) continue;
      const s = byDate[date];
      const x = L + w * (cell + gap), y = T + i * (cell + gap);
      const tipText = `${fmtDate(date, { weekday: "short", month: "short", day: "numeric" })}\n${s ? (s.status === "completed" ? `${dayName(s.day)} done` : s.status === "skipped" ? `Skipped ${dayName(s.day)}` : s.status === "rest" ? "Rest day" : `${dayName(s.day)} in progress`) : "Nothing logged"}`;
      const attrs = { x, y, width: cell, height: cell, rx: 3, "data-tip": tipText };
      if (s && (s.status === "completed" || s.status === "in_progress")) svg.append(el("svg:rect", { ...attrs, fill: DAY_COLOR[s.day] || "var(--muted)", "fill-opacity": s.status === "in_progress" ? 0.5 : 1 }));
      else if (s && s.status === "skipped") svg.append(el("svg:g", { "data-tip": tipText }, el("svg:rect", { ...attrs, fill: "none", stroke: "var(--muted)" }), el("svg:path", { d: `M${x + 4} ${y + 4}L${x + cell - 4} ${y + cell - 4}`, stroke: "var(--muted)" })));
      else if (s && s.status === "rest") svg.append(el("svg:rect", { ...attrs, fill: "var(--border)" }));
      else svg.append(el("svg:rect", { ...attrs, fill: "var(--soft)", stroke: "var(--border)", "stroke-width": 0.5 }));
    }
  }
  const legend = el("ul", { class: "fit-legend" },
    ...Object.keys(DAY_COLOR).map((d) => el("li", {}, el("span", { class: "fit-swatch", style: `--c:${DAY_COLOR[d]}` }), dayName(d))),
    el("li", {}, el("span", { class: "fit-swatch skip" }), "Skipped"), el("li", {}, el("span", { class: "fit-swatch rest" }), "Rest"));
  $("fit-calendar").replaceChildren(svg, legend);
}

/* ---------- weekly sets per muscle vs the target band ---------- */
function drawVolume() {
  const ws = D.program.weekly_sets;
  const max = Math.max(ws.high * 1.2, ...A.volume.map((v) => v.avgWeekly));
  const pct = (v) => `${(v / max) * 100}%`;
  const label = { low: ["bad", "low"], under: ["warn", "under"], ok: ["", ""], high: ["warn", "high"] };
  $("fit-volume").replaceChildren(...[...A.volume].sort((a, b) => a.avgWeekly - b.avgWeekly).map((v) => {
    const [cls, word] = label[v.status];
    return el("div", { class: "fit-bar-row", "data-tip": `${v.name}\n${v.avgWeekly} sets a week (target ${ws.target}–${ws.high})` },
      el("span", { text: v.name }),
      el("div", { class: "fit-track" }, el("div", { class: "band", style: `left:${pct(ws.target)};width:calc(${pct(ws.high)} - ${pct(ws.target)})` }), el("div", { class: "fill", style: `width:${pct(v.avgWeekly)}` })),
      el("span", { class: "fit-bar-value" }, `${v.avgWeekly} sets `, word ? el("span", { class: cls, text: word }) : null));
  }));
}

/* ---------- cardio minutes per week, stacked by machine ---------- */
function drawCardio() {
  const weeks = A.weekly.slice(-12);
  const machines = (D.preferences.cardio && D.preferences.cardio.machines) || Object.keys(MACHINE_COLOR);
  const goal = (D.preferences.cardio && D.preferences.cardio.minutes) || 25;
  const totals = weeks.map((w) => machines.reduce((t, m) => t + (w.cardio[m] || 0), 0));
  const targets = weeks.map((w) => w.sessions * goal);
  if (!totals.some(Boolean)) { $("fit-cardio").replaceChildren(el("p", { class: "empty", text: "No cardio logged yet." })); return; }
  const W = Math.max(300, $("fit-cardio").clientWidth || 760), H = 220, L = 40, R = 8, T = 12, B = 28;
  const yt = ticks(0, Math.max(...totals, ...targets, goal));
  const Y = (v) => T + (1 - v / yt.at(-1)) * (H - T - B);
  const slot = (W - L - R) / weeks.length, bw = Math.min(36, slot * 0.6);
  const every = Math.ceil(56 / slot);   // week labels far enough apart not to touch
  const svg = el("svg:svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Cardio minutes per week by machine" });
  yt.forEach((v) => svg.append(el("svg:line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: "var(--border)" }), el("svg:text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "var(--muted)", text: v })));
  weeks.forEach((w, i) => {
    const cx = L + slot * (i + 0.5);
    let base = 0;
    const tipText = [`Week of ${fmtDate(w.week)}`, ...machines.filter((m) => w.cardio[m]).map((m) => `${m}: ${w.cardio[m]} min`), `Target: ${targets[i]} min (${w.sessions} workouts)`].join("\n");
    const g = el("svg:g", { "data-tip": tipText });
    g.append(el("svg:rect", { x: cx - slot / 2, y: T, width: slot, height: H - T - B, fill: "transparent" }));
    machines.forEach((m) => {
      const v = w.cardio[m] || 0;
      if (!v) return;
      const y1 = Y(base + v), y0 = Y(base);
      g.append(el("svg:rect", { x: cx - bw / 2, y: y1, width: bw, height: Math.max(0, y0 - y1 - 2), fill: MACHINE_COLOR[m] || "var(--muted)", rx: base + v === totals[i] ? 3 : 0 }));
      base += v;
    });
    if (targets[i]) g.append(el("svg:line", { x1: cx - bw / 2 - 4, x2: cx + bw / 2 + 4, y1: Y(targets[i]), y2: Y(targets[i]), stroke: "var(--text)", "stroke-width": 2 }));
    if ((weeks.length - 1 - i) % every === 0) svg.append(el("svg:text", { x: cx, y: H - 10, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)", text: fmtDate(w.week) }));
    svg.append(g);
  });
  const legend = el("ul", { class: "fit-legend" }, ...machines.map((m) => el("li", {}, el("span", { class: "fit-swatch", style: `--c:${MACHINE_COLOR[m]}` }), m)),
    el("li", {}, el("span", { class: "fit-swatch", style: "--c:var(--text);height:2px;vertical-align:3px" }), "target"));
  $("fit-cardio").replaceChildren(svg, legend, tableView(["Week of", ...machines, "Target"], [...weeks].reverse().map((w, i) => [w.week, ...machines.map((m) => String(w.cardio[m] || 0)), String(targets[weeks.length - 1 - i])])));
}

/* ---------- previous workouts, newest first ---------- */
function drawHistory(limit = 15) {
  const list = E.sessions(D.workouts).reverse();
  if (!list.length) { $("fit-history").replaceChildren(el("p", { class: "empty", text: "No workouts yet. Your daily session logs them here." })); return; }
  const prs = new Set(Object.entries(A.strength).flatMap(([id, pts]) => pts.filter((p, i) => p.pr && i > 0).map((p) => `${p.date}|${id}`)));
  const rows = list.slice(0, limit).map((s) => {
    const label = { completed: dayName(s.day), skipped: `Skipped ${dayName(s.day)}`, rest: "Rest", in_progress: `${dayName(s.day)} (in progress)` }[s.status] || s.status;
    const minutes = s.started && s.finished ? Math.round((Date.parse(s.finished) - Date.parse(s.started)) / 60000) : null;
    const summary = el("summary", {},
      el("span", { text: fmtDate(s.date, { weekday: "short", month: "short", day: "numeric" }) }),
      el("span", {}, s.day && s.status !== "rest" ? el("span", { class: "fit-day", style: `--c:${DAY_COLOR[s.day]}` }) : null, label),
      el("span", { class: "muted", text: [liftsOf(s).length ? `${liftsOf(s).length} lifts` : "", cardioOf(s).length ? `${cardioOf(s).reduce((t, c) => t + c.minutes, 0)} min cardio` : "", minutes ? `${minutes} min total` : ""].filter(Boolean).join(" · ") }));
    const items = [
      ...liftsOf(s).map((l) => el("li", {}, `${nameOf(l.exercise)}: ${setsText(l.sets)}`, prs.has(`${s.date}|${l.exercise}`) ? el("span", { class: "pr", text: "  new best" }) : null)),
      ...cardioOf(s).map((c) => el("li", { text: `${c.machine}: ${c.minutes} min${c.notes ? ` (${c.notes})` : ""}` })),
      ...(s.notes ? [el("li", { text: `Notes: ${s.notes}` })] : []),
    ];
    return el("details", { class: "fit-session" }, summary, items.length ? el("ul", {}, items) : el("ul", {}, el("li", { text: "Nothing logged." })));
  });
  const more = list.length > limit ? el("button", { class: "btn small fit-more", type: "button", text: `Show ${Math.min(30, list.length - limit)} more`, onclick: () => drawHistory(limit + 30) }) : null;
  $("fit-history").replaceChildren(...rows, more);
}


/* ================================================================ 3. edit */
let draft;        // { rankings, never } being edited
let day = "push";

const clone = (x) => JSON.parse(JSON.stringify(x));
const dirty = () => JSON.stringify(draft) !== JSON.stringify({ rankings: D.preferences.rankings || {}, never: D.preferences.never || [] });

function setUpEditor() {
  draft = clone({ rankings: D.preferences.rankings || {}, never: D.preferences.never || [] });
  $("fit-days").replaceChildren(...D.program.rotation.map((d) => el("button", {
    class: "btn small", type: "button", "aria-pressed": String(d === day), text: dayName(d),
    onclick: () => { day = d; $("fit-days").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === dayName(d)))); drawSlots(); },
  })));
  $("fit-save").onclick = save;
  window.addEventListener("beforeunload", (e) => { if (dirty()) e.preventDefault(); });
  drawSlots();
  setUpRequests();
}

function drawSlots() {
  const p = D.program.days[day];
  const slots = [...new Set([...p.core, ...p.flex])];
  const never = new Set(draft.never);
  const btn = (text, label, onclick) => el("button", { class: "btn small", type: "button", text, "aria-label": label, onclick });
  const change = () => { drawSlots(); $("fit-save").disabled = !dirty(); $("fit-save-status").textContent = dirty() ? "Unsaved changes" : ""; };

  $("fit-slots").replaceChildren(...slots.map((slot) => {
    const ranked = (draft.rankings[slot] = draft.rankings[slot] || []);
    const lifts = D.exercises.exercises.filter((e) => e.slot === slot);
    const others = lifts.filter((e) => !ranked.includes(e.id));
    const move = (i, by) => { const [x] = ranked.splice(i, 1); ranked.splice(i + by, 0, x); change(); };
    return el("article", { class: "card fit-slot" },
      el("h3", { text: D.program.slots[slot].name + (p.flex.includes(slot) && !p.core.includes(slot) ? " (fifth lift)" : "") }),
      el("p", { class: "sub", text: "Your ranking" }),
      ranked.length ? el("ol", {}, ranked.map((id, i) => el("li", {},
        el("span", { class: "rank", text: `#${i + 1}` }), el("span", { class: "name", text: nameOf(id) }),
        i > 0 ? btn("↑", `Move ${nameOf(id)} up`, () => move(i, -1)) : null,
        i < ranked.length - 1 ? btn("↓", `Move ${nameOf(id)} down`, () => move(i, 1)) : null,
        btn("✕", `Unrank ${nameOf(id)}`, () => { ranked.splice(i, 1); change(); })))) : el("p", { class: "fit-why", text: "Nothing ranked: picks follow what you log." }),
      el("p", { class: "sub", text: "Other lifts" }),
      el("ul", {}, others.map((e) => el("li", { class: never.has(e.id) ? "never" : "" },
        el("span", { class: "name", text: e.name }),
        never.has(e.id)
          ? btn("Allow", `Allow ${e.name} again`, () => { draft.never = draft.never.filter((x) => x !== e.id); change(); })
          : [btn("Rank", `Rank ${e.name}`, () => { ranked.push(e.id); change(); }), btn("Never", `Never suggest ${e.name}`, () => { draft.never.push(e.id); change(); })]))));
  }));
}

async function post(path, body) {
  const res = await fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `Error ${res.status}`);
  return out;
}

async function save() {
  const status = $("fit-save-status");
  $("fit-save").disabled = true;
  status.textContent = "Saving…";
  try {
    const rankings = Object.fromEntries(Object.entries(draft.rankings).filter(([, ids]) => ids.length));
    const out = await post("preferences", { rankings, never: draft.never });
    D.preferences = out.preferences;
    draft = clone({ rankings: D.preferences.rankings || {}, never: D.preferences.never || [] });
    status.textContent = "Saved. Up next is updated.";
    drawNext();
  } catch (err) {
    status.textContent = "Not saved: " + err.message;
    $("fit-save").disabled = false;
  }
}

/* ---------- ask for a new lift ---------- */
function drawRequests() {
  const list = D.preferences.requests || [];
  $("fit-requests").replaceChildren(...list.map((r, i) => el("li", {},
    el("span", { class: "name", text: r.text }),
    el("span", { class: "muted", text: "next session" }),
    el("button", { class: "btn small", type: "button", text: "✕", "aria-label": `Cancel "${r.text}"`, onclick: () => sendRequest({ cancel: i }, "Cancelled.") }))));
}

async function sendRequest(body, done) {
  const status = $("fit-request-status");
  status.textContent = "Saving…";
  try {
    const out = await post("request", body);
    D.preferences = { ...D.preferences, requests: out.preferences.requests };
    status.textContent = done;
    drawRequests();
    return true;
  } catch (err) {
    status.textContent = "Not saved: " + err.message;
    return false;
  }
}

function setUpRequests() {
  const form = $("fit-request");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) return;
    if (await sendRequest({ text }, "Added. Your next daily session will put it in your plans.")) form.reset();
  });
  drawRequests();
}

load();
