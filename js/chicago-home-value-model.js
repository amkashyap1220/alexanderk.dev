/* ==========================================================================
   Chicago home value: the value score, in the browser.
   The same steps as src/value.py in the Home-Value-Score repo, plus the
   reader's targets and a second person:

   1. Six factors, each a percentile rank from 0 to 100 within the sample
      (higher is better): schools, safety, commute, walkability, newer homes,
      low price (price per sq ft for buyers, rent for renters).
   2. A target, if set, changes a factor's score: a zip that meets it scores
      100; one that misses it scores 100 x its percentile / the target's
      percentile, so it falls off the further it misses.
   3. Quality = weighted average of the first five factors. A missing value
      counts as 50, the middle.
   4. Value = (1 - price share) x quality + price share x the price factor.
   5. Value areas = the 20 highest value scores among zips with above-median
      quality. For two people, "best for both" ranks by the lower of the two
      value scores, among zips above both people's quality medians.

   With no targets, every weight at 1 and price at 50%, this reproduces the
   published results.
   ========================================================================== */

window.HVModel = (function () {
  // Raw value index in z[mode].v for each factor's target, and whether a target is a floor (min) or a ceiling (max)
  // v = [school percentile in state, crimes per 1,000, commute min, walk index, home age, $/sq ft or rent, median sale price]
  const TARGETS = [
    { v: 0, kind: "min" },   // schools: at least
    { v: 1, kind: "max" },   // safety: crimes at most
    { v: 2, kind: "max" },   // commute: at most
    { v: 3, kind: "min" },   // walkability: at least
    { v: 4, kind: "max" },   // home age: at most
  ];
  const PRICE_TARGET = { buy: 6, rent: 5 };   // a buyer's budget is compared with the median sale price

  function median(values) {
    const v = [...values].sort((a, b) => a - b);
    const m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  // Percentile (0 to 100) a target would have among the sample's values: the share of zips it beats
  function targetPercentile(values, target, kind) {
    const known = values.filter((x) => x != null);
    const worse = known.filter((x) => (kind === "min" ? x < target : x > target)).length;
    const ties = known.filter((x) => x === target).length;
    return Math.max(0, Math.min(100, ((worse + ties / 2) / (known.length - 1)) * 100));
  }

  // How well one zip does on a factor, given its percentile and an optional target
  function factor(p, raw, target, t) {
    if (p == null) return 50;
    if (target == null) return p;
    const meets = target.kind === "min" ? raw >= target.value : raw <= target.value;
    if (meets || t <= 0) return 100;
    return Math.min(100, (100 * p) / t);
  }

  // person: { weights: [5 numbers], priceShare: 0..1, targets: [5 numbers or null], budget: number or null }
  // Returns one row per zip in the sample, plus the quality median
  function score(zips, mode, person) {
    const rows = zips.filter((z) => z[mode]);
    const wSum = person.weights.reduce((s, w) => s + w, 0);
    const targets = TARGETS.map((spec, i) => person.targets[i] == null ? null : { kind: spec.kind, value: person.targets[i] });
    const tPct = targets.map((t, i) => t && targetPercentile(rows.map((z) => z[mode].v[TARGETS[i].v]), t.value, t.kind));
    const pv = PRICE_TARGET[mode];
    const budget = person.budget == null ? null : { kind: "max", value: person.budget };
    // The budget is compared with the median sale price (buyers) or the rent, so both percentiles come from those
    const priceVals = rows.map((z) => z[mode].v[pv]);
    const bPct = budget && targetPercentile(priceVals, budget.value, "max");

    const out = rows.map((z) => {
      const { v, p } = z[mode];
      const f = p.slice(0, 5).map((pi, i) => factor(pi, v[TARGETS[i].v], targets[i], tPct[i]));
      const quality = wSum > 0 ? f.reduce((s, x, i) => s + x * person.weights[i], 0) / wSum : 50;
      let price = p[5];
      if (budget) price = factor(pricePercentile(priceVals, v[pv]), v[pv], budget, bPct);
      return { z, quality, price, value: (1 - person.priceShare) * quality + person.priceShare * price };
    });
    return { rows: out, qMedian: median(out.map((r) => r.quality)) };
  }

  // A zip's own percentile among the sample's prices (cheaper = higher), for the budget; same ranks as src/value.py
  function pricePercentile(values, x) {
    return targetPercentile(values, x, "max") - 50 / (values.filter((y) => y != null).length - 1);
  }

  // The top n zips (by key) among those above the quality median(s); returns a Set of zip codes
  function top(rows, key, eligible, n) {
    return new Set(rows.filter(eligible).sort((a, b) => b[key] - a[key]).slice(0, n).map((r) => r.zip));
  }

  // people: one or two person objects. Returns per-zip results and each person's top n
  function run(zips, mode, people, n) {
    const runs = people.map((p) => score(zips, mode, p));
    const rows = runs[0].rows.map((r, i) => {
      const row = { ...r.z, scores: runs.map((x) => x.rows[i].value), quality: runs.map((x) => x.rows[i].quality) };
      row.both = Math.min(...row.scores);
      return row;
    });
    const picks = runs.map((x, k) => top(rows.map((r) => ({ zip: r.zip, s: r.scores[k], q: r.quality[k] })), "s", (r) => r.q > x.qMedian, n));
    const both = runs.length > 1
      ? top(rows.map((r) => ({ zip: r.zip, s: r.both, q: r.quality })), "s", (r) => r.q.every((q, k) => q > runs[k].qMedian), n)
      : null;
    return { rows, picks, both, qMedians: runs.map((x) => x.qMedian) };
  }

  return { run };
})();
