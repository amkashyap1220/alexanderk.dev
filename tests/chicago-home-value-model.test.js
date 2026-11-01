// Tests for js/chicago-home-value-model.js (run with: node --test tests/)
// The last test checks that the page ranks the sample values exactly as src/value.py does,
// using the same data file the page loads.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const M = require("../public/js/chicago-home-value-model.js");

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// n zips whose seven factors are 0..n-1
function zips(n = 10, patch = {}) {
  return Array.from({ length: n }, (_, i) => ({ zip: String(60000 + i), buy: (patch[i] || Array(7).fill(i)).slice() }));
}
const person = (targets, weights) => ({ targets, weights, workplace: null });
const only = (i) => [0, 1, 2, 3, 4, 5, 6].map((k) => (k === i ? 1 : 0));

test("pct counts ties as half and ignores nothing it is given", () => {
  near(M.pct([1, 2, 2, 3], 2), 50);
  near(M.pct([1, 2, 3], 0), 0);
  near(M.pct([1, 2, 3], 9), 100);
  assert.ok(Number.isNaN(M.pct([], 1)));
});

test("closeness is 100 on target and falls by the percentile gap; commute is two-sided", () => {
  const r = M.run(zips(), "buy", [person([0, 0, 4, 0, 0, 0, 0], only(2))], 3);
  near(r.rows[4].close[0][2], 100);
  near(r.rows[2].close[0][2], 80);
  near(r.rows[6].close[0][2], 80);
});

test("beating a one-sided target counts as on target, in the right direction", () => {
  // schools: higher is better; safety, price, train: lower is better
  for (const [i, better, worse] of [[0, 8, 2], [1, 2, 8], [5, 2, 8], [6, 2, 8]]) {
    const r = M.run(zips(), "buy", [person(Array(7).fill(5), only(i))], 3);
    near(r.rows[better].close[0][i], 100);
    assert.ok(r.rows[worse].close[0][i] < 100);
  }
  assert.deepEqual(M.DIRECTION, [1, -1, 0, 0, 0, -1, -1]);
});

test("a missing value is left out of the score and lowers coverage instead of counting as 50", () => {
  const z = zips();
  z[3].buy[1] = null;                          // no crime data
  const weights = [1, 3, 0, 0, 0, 0, 0];       // schools Normal, safety Top
  const r = M.run(z, "buy", [person([9, 0, 0, 0, 0, 0, 0], weights)], 20);
  const row = r.rows[3];
  assert.equal(row.close[0][1], null);
  near(row.coverage[0], 0.25);
  near(row.scores[0], row.close[0][0]);
  assert.equal(row.ranked[0], false);
  assert.ok(!r.picks[0].has(row.zip), "an unranked zip is never in the top list");
});

test("explain: points lost add up to 100 minus the score, and shares to 1", () => {
  const close = [100, 80, null, 50, 100, 90, 70];
  const weights = [3, 3, 0.5, 1, 0.5, 1, 0.5];
  const { score } = M.combine(close, weights);
  const parts = M.explain(close, weights);
  near(parts.reduce((s, p) => s + (p.lost || 0), 0), 100 - score);
  near(parts.reduce((s, p) => s + p.share, 0), 1);
  assert.equal(parts[2].missing, true);
});

test("best for both ranks by the lower score and needs both to be ranked", () => {
  const z = zips(5);
  const a = person([4, 0, 0, 0, 0, 0, 0], only(0));   // wants the best schools
  const b = person([0, 0, 0, 0, 0, 0, 0], only(5));   // wants the lowest price (same column here)
  const r = M.run(z, "buy", [a, b], 1);
  r.rows.forEach((row) => near(row.both, Math.min(...row.scores)));
  const best = [...r.both][0];
  const bestRow = r.rows.find((x) => x.zip === best);
  assert.ok(r.rows.every((x) => x.both <= bestRow.both));
});

test("changes lists what came in and dropped out", () => {
  assert.deepEqual(M.changes(new Set(["a", "b"]), new Set(["b", "c"])), { added: ["c"], removed: ["a"] });
});

test("the page's model reproduces src/value.py's sample top 20 for buyers and renters", () => {
  const dir = path.join(__dirname, "..", "public", "research");
  const data = JSON.parse(fs.readFileSync(path.join(dir, "chicago-home-value.json")));
  const times = JSON.parse(fs.readFileSync(path.join(dir, "chicago-home-value-drive.json")));
  const index = new Map(times.zips.map((z, i) => [z, i]));
  const grid = Buffer.from(times.minutes, "base64");
  const drive = (from, to) => grid[index.get(from) * times.zips.length + index.get(to)];
  for (const mode of ["buy", "rent"]) {
    const s = data.sample[mode];
    const r = M.run(data.zips, mode, [{ targets: s.targets, weights: s.weights, workplace: s.workplace }], data.top, drive);
    const ours = [...r.rows].filter((x) => r.picks[0].has(x.zip)).sort((a, b) => b.scores[0] - a.scores[0]);
    assert.deepEqual(new Set(ours.map((x) => x.zip)), new Set(data.sample_check[mode].top), mode + " top 20");
    const byZip = new Map(ours.map((x) => [x.zip, x.scores[0]]));
    data.sample_check[mode].top.forEach((z, i) => near(byZip.get(z), data.sample_check[mode].scores[i], 0.0051));
  }
});
