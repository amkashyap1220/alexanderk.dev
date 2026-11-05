// The factors, words and number formats shared by the Chicago home value
// components (HomeValue.svelte and the files next to it). No page code here.

// Each factor: what it measures and the units around its target box. Price depends on buying or renting.
const FACTORS = [
  { name: "Schools", hint: "State test percentile: 80 beats 80% of districts.", before: "", after: "percentile", digits: 0 },
  { name: "Safety", hint: "Crimes per 1,000 residents a year.", before: "", after: "crimes per 1,000", digits: 1 },
  { name: "Commute", hint: "One-way minutes. Add where you work to use the drive time there.", before: "", after: "minutes", digits: 0 },
  { name: "Walkability", hint: "1 (car for everything) to 20 (very walkable).", before: "", after: "out of 20", digits: 1 },
  { name: "Home age", hint: "Age of the typical home.", before: "", after: "years old", digits: 0 },
];
const PRICE = {
  buy: { name: "Price", hint: "Median sale price, past year.", before: "$", after: "", digits: -3, example: "600k" },
  rent: { name: "Rent per person", hint: "Median rent split by bedroom, so one roommate's share.", before: "$", after: "a month", digits: 0, example: "1,200" },
};
const TRAIN = { name: "Train station", hint: "Miles to the nearest Metra, CTA 'L' or South Shore Line station.", before: "", after: "miles", digits: 1 };
export const factorsFor = (mode) => [...FACTORS, PRICE[mode], TRAIN];
export const ALL = [0, 1, 2, 3, 4, 5, 6];
// The form shows the train station right after commute
export const ORDER = [0, 1, 2, 6, 3, 4, 5];
// The weight slider runs 0 to 4; these are the weights and words for each step
export const WEIGHTS = [
  { weight: 0, word: "Ignore" }, { weight: 0.5, word: "Low" }, { weight: 1, word: "Normal" },
  { weight: 2, word: "High" }, { weight: 3, word: "Top" },
];
// Housing value classes and the reasons a zip's estimate is less certain (src/value_gap.py)
export const CLASS = { below: "Below expected", in_line: "In line", above: "Above expected" };
export const CONF = { high: "High", medium: "Medium", low: "Low" };
export const ISSUES = {
  few_sales: (v) => "Only " + v.sales + " sales in the past year, so its median price is noisy.",
  missing_indicator: () => "Missing a measured factor (usually crime), so its expected price uses fewer factors.",
  chicago_schools: () => "Chicago is one school district, so the model can't see school differences between city neighborhoods.",
  spec_sensitive: (v) => "Only " + Math.round(v.agree * 100) + "% of the 12 other model versions put it in the same class.",
  changed_since_2025: () => "It was in a different class with last year's prices.",
  noisy_price: () => "Price noise alone could put it back in line.",
};

export const money = (x) => "$" + Math.round(x).toLocaleString();
export const name = (z) => (z.place || "Zip " + z.zip) + ", " + z.state;
export const who = (k) => (k === 0 ? "You" : "Person 2");
// digits < 0 rounds to tens, hundreds, thousands...
export const fmt = (x, digits) => (digits < 0 ? Math.round(x / 10 ** -digits) * 10 ** -digits : x)
  .toLocaleString(undefined, { maximumFractionDigits: Math.max(digits, 0) });
export const listJoin = (a) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
export const pctText = (g) => Math.round(Math.abs(g) * 100) + "%";
export const signed = (g) => (g > 0 ? "+" : g < 0 ? "−" : "") + pctText(g);
export const gapText = (g) => g == null ? "no estimate" : Math.abs(g) < 0.005 ? "at expected" : pctText(g) + (g < 0 ? " below" : " above") + " expected";
const suffix = (n) => (n % 100 >= 11 && n % 100 <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th";

// A factor's value in words, for the detail panel
export function factorText(mode, i, x) {
  if (x == null) return "no data";
  const f = factorsFor(mode)[i];
  if (i === 0) return Math.round(x) + suffix(Math.round(x)) + " percentile";
  if (i === 5) return mode === "buy" ? money(Math.round(x / 1000) * 1000) : money(x) + "/mo";
  return f.before + fmt(x, Math.max(f.digits, i === 2 ? 0 : 1)) + " " + ({ 1: "per 1,000", 2: "min", 3: "of 20", 4: "years", 6: "mi" })[i];
}

// "350k", "$1,500" and "30" all work
export function parse(text) {
  const s = text.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!s) return null;
  const x = parseFloat(s) * (s.endsWith("k") ? 1000 : 1);
  return Number.isFinite(x) ? x : null;
}

// "60606", "Naperville" or "Naperville, IL 60540" (from the list) all work; returns a zip, null (empty) or undefined (no match)
export function findPlace(places, text) {
  const s = text.trim().toLowerCase();
  if (!s) return null;
  const zip = s.match(/\b\d{5}\b/);
  if (zip) return places.some((p) => p.zip === zip[0]) ? zip[0] : undefined;
  const hit = places.find((p) => p.label.toLowerCase().startsWith(s));
  return hit ? hit.zip : undefined;
}

// A Zillow search for homes for sale (buying) or rentals (renting) in the zip
export const zillow = (mode, zip) => "https://www.zillow.com/homes/for_" + (mode === "buy" ? "sale" : "rent") + "/" + zip + "_rb/";

export const css = (prop) => getComputedStyle(document.documentElement).getPropertyValue(prop).trim();

// The results for the person in view (0 = you, 1 = person 2, 2 = best for both)
export function currentOf(result, view) {
  if (view === 2 && result.both) return { picks: result.both, score: (r) => r.both, ranked: (r) => r.bothRanked, label: "best for both", k: null };
  const k = Math.min(view, result.picks.length - 1);
  return { picks: result.picks[k], score: (r) => r.scores[k], ranked: (r) => r.ranked[k], label: k === 0 ? "your" : "person 2's", k };
}

// The line above the map: the top list's heading and what it holds
export function summarize(data, result, cur, mode, view, ps) {
  const { picks, score, ranked } = cur;
  const rows = result.rows.filter((r) => picks.has(r.zip)).sort((a, b) => score(b) - score(a));
  if (!rows.length) return { rows: 0 };
  const what = mode === "buy" ? "to buy" : "to rent";
  const unranked = result.rows.filter((r) => !ranked(r)).length;
  const head = view === 2 && ps.length > 1 ? "Best " + picks.size + " " + what + " for both of you" : (view === 1 ? "Person 2's" : "Your") + " top " + picks.size + " " + what;
  const best = rows[0];
  let text = " Best fit: " + name(best) + " (" + Math.round(score(best)) + " of 100). " + result.rows.length + " zips scored";
  text += unranked ? "; " + unranked + " not ranked because data is missing for a factor carrying over " + Math.round((1 - data.min_coverage) * 100) + "% of the weight." : ".";
  if (mode === "buy") {
    const vs = rows.map((r) => r.value).filter(Boolean);
    const below = vs.filter((v) => v.cls === "below").length, above = vs.filter((v) => v.cls === "above").length;
    text += " Of the top " + rows.length + ", " + below + " sell below the price their measured features predict and " + above + " above it.";
  }
  return { rows: rows.length, head, text };
}

// Each weighted factor's share of one person's weights, largest first
export function weightParts(p) {
  const total = p.weights.reduce((s, w) => s + w, 0);
  return ORDER.filter((i) => p.weights[i] > 0).sort((a, b) => p.weights[b] - p.weights[a])
    .map((i) => ({ i, bar: Math.round((p.weights[i] / total) * 60), share: Math.round((p.weights[i] / total) * 100) }));
}

// Strongly related pairs among the factors one person weights (Spearman correlation across zips, |rho| >= 0.6)
export function relatedPairs(data, p, factors) {
  const corr = data.factor_correlation;
  const out = [];
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) {
    // Price is left out: it's a cost, not a feature, and it's meant to go with quality
    if (a === 5 || b === 5 || (p.workplace && (a === 2 || b === 2))) continue;
    if (p.weights[a] > 0 && p.weights[b] > 0 && Math.abs(corr.spearman[a][b]) >= 0.6)
      out.push(factors[a].name.toLowerCase() + " and " + factors[b].name.toLowerCase() + " (ρ = " + corr.spearman[a][b].toFixed(2).replace("-", "−") + ")");
  }
  return out;
}

// The sample person (SAMPLE in src/value.py) as the scoring model takes them
export const samplePerson = (data, mode) => ({ weights: [...data.sample[mode].weights], targets: [...data.sample[mode].targets], workplace: data.sample[mode].workplace });

// Drive times to a few workplaces, made at build time so the page doesn't need the
// whole grid (chicago-home-value-drive.json) until someone names another workplace.
// cols: { zips: "46301,46302,...", to: { "60606": "12,15,..." } }, in the grid's zip order
export function driveColumns(cols) {
  const zips = cols.zips.split(",");
  const to = new Map(Object.entries(cols.to).map(([w, m]) => [w, new Map(m.split(",").map((x, i) => [zips[i], +x]))]));
  return { zips, to };
}
