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
