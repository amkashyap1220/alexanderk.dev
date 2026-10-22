/* ==========================================================================
   Chicago home value: the fit score, in the browser.
   The same steps as src/value.py in the Home-Value-Score repo:

   1. The reader sets a target and a weight for seven factors: schools,
      safety, commute, walkability, home age, price (median sale price
      for buyers, rent per person for renters) and miles to the nearest
      train station. If they name a workplace zip,
      commute is the drive time from each zip to it (no traffic) instead of
      the Census average commute.
   2. Closeness is measured in percentile points, so minutes, dollars and
      crime rates are comparable. pct(x) is the share of the sample's zips
      below x (ties count half), and
        closeness = 100 - |pct(zip's value) - pct(target)|
      It's 100 exactly on target and lower the further away. For schools,
      safety, price and train, doing better than the target also counts as 100.
   3. Score = weighted average of the closeness of the factors the zip has
      data for. Coverage = the share of the reader's weight those factors
      carry. A missing value is left out rather than guessed, and a zip whose
      coverage is under MIN_COVERAGE (80%) is shown but not ranked.
   4. Top areas = the 20 highest scores among ranked zips. For two people,
      "best for both" ranks by the lower of the two scores (and the lower coverage).

   Also loads in Node (module.exports) so tests/ can check it against src/value.py.
   ========================================================================== */

(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  else root.HVModel = model;
})(typeof self !== "undefined" ? self : this, function () {
  // Which way is "better than the target": +1 higher is better, -1 lower is better, 0 no better side
  // (schools, safety, commute, walkability, home age, price, train), the same as DIRECTION in src/value.py
  const DIRECTION = [1, -1, 0, 0, 0, -1, -1];
  const MIN_COVERAGE = 0.8;

  // Share of the known values below x, ties counting half, as 0 to 100 (values sorted ascending)
  function pct(sorted, x) {
    if (!sorted.length) return NaN;
    let below = 0, equal = 0;
    for (const v of sorted) {
      if (v < x) below++;
      else if (v === x) equal++;
      else break;
    }
    return ((below + equal / 2) / sorted.length) * 100;
  }

  // One person's seven values for a zip. With a workplace, commute is the drive time to it instead of the Census average.
  function values(z, mode, person, drive) {
    const v = z[mode].slice();
    if (person.workplace && drive) v[2] = drive(z.zip, person.workplace);
    return v;
  }

  // How close one value is to the target, 0 to 100, or null when the value is missing
  function closeness(sorted, x, targetPct, direction) {
    if (x == null) return null;
    const gap = pct(sorted, x) - targetPct;
    return gap * direction > 0 ? 100 : 100 - Math.abs(gap);   // better than the target counts as on target
  }

  // Weighted average over the measured factors, and the share of the weight they carry
  function combine(close, weights) {
    let sum = 0, measured = 0, total = 0;
    close.forEach((c, i) => {
      total += weights[i];
      if (c == null) return;
      sum += c * weights[i];
      measured += weights[i];
    });
    return { score: measured > 0 ? sum / measured : null, coverage: total > 0 ? measured / total : 0 };
  }

  // person: { targets: [7 numbers], weights: [7 numbers], workplace: zip or null }
  function score(rows, mode, person, drive) {
    const vals = rows.map((z) => values(z, mode, person, drive));
    const sorted = DIRECTION.map((_, i) => vals.map((v) => v[i]).filter((x) => x != null).sort((a, b) => a - b));
    const tPct = person.targets.map((t, i) => pct(sorted[i], t));
    return vals.map((v) => {
      const close = v.map((x, i) => closeness(sorted[i], x, tPct[i], DIRECTION[i]));
      return { close, commute: v[2], ...combine(close, person.weights) };
    });
  }

  // Why a zip scores what it does: for each factor its share of the weight, its closeness,
  // and the points it costs the score (share x (100 - closeness)). Shares and points use the
  // measured factors only, so the points lost add up to 100 - score.
  function explain(close, weights) {
    const measured = close.reduce((s, c, i) => s + (c == null ? 0 : weights[i]), 0);
    const total = weights.reduce((s, w) => s + w, 0);
    return close.map((c, i) => ({
      weight: weights[i],
      share: total ? weights[i] / total : 0,
      closeness: c,
      lost: c == null || !measured ? null : (weights[i] / measured) * (100 - c),
      missing: c == null && weights[i] > 0,
    }));
  }

  // The n best of rows by key among those that pass ok, as a Set of zips. Ties keep the input order (by zip), as in Python.
  function topSet(rows, key, ok, n) {
    return new Set(rows.filter(ok).sort((a, b) => key(b) - key(a)).slice(0, n).map((r) => r.zip));
  }

  // people: one or two person objects; drive(fromZip, toZip) gives drive minutes.
  // Returns per-zip results and each top n (Sets of zip codes)
  function run(zips, mode, people, n, drive) {
    const rows = zips.filter((z) => z[mode]);
    const runs = people.map((p) => score(rows, mode, p, drive));
    const out = rows.map((z, i) => {
      const r = runs.map((x) => x[i]);
      const scores = r.map((x) => x.score);
      const coverage = r.map((x) => x.coverage);
      return {
        ...z, scores, coverage,
        close: r.map((x) => x.close), commutes: r.map((x) => x.commute),
        ranked: coverage.map((c) => c >= MIN_COVERAGE - 1e-9),
        both: scores.some((s) => s == null) ? null : Math.min(...scores),
        bothRanked: coverage.every((c) => c >= MIN_COVERAGE - 1e-9),
      };
    });
    return {
      rows: out,
      picks: runs.map((_, k) => topSet(out, (r) => r.scores[k], (r) => r.ranked[k] && r.scores[k] != null, n)),
      both: runs.length > 1 ? topSet(out, (r) => r.both, (r) => r.bothRanked && r.both != null, n) : null,
    };
  }

  // Which zips came into and dropped out of a top list after a change
  function changes(before, after) {
    if (!before || !after) return { added: [], removed: [] };
    return { added: [...after].filter((z) => !before.has(z)), removed: [...before].filter((z) => !after.has(z)) };
  }

  return { run, explain, changes, pct, closeness, combine, DIRECTION, MIN_COVERAGE };
});
