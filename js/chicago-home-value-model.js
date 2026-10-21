/* ==========================================================================
   Chicago home value: the target score, in the browser.
   The same steps as src/value.py in the Home-Value-Score repo:

   1. The reader sets a target and a weight for six factors: schools,
      safety, commute, walkability, home age, and price (median sale price
      for buyers, median rent for renters).
   2. Closeness is measured in percentile points, so minutes, dollars and
      crime rates are comparable. pct(x) is the share of the sample's zips
      below x (ties count half), and
        closeness = 100 - |pct(zip's value) - pct(target)|
      It's 100 exactly on target and lower the further away, in either
      direction. A missing value counts as 50.
   3. Score = weighted average of the six closeness values.
   4. Top areas = the 20 highest scores. For two people, "best for both"
      ranks by the lower of the two scores.
   ========================================================================== */

window.HVModel = (function () {
  // Share of the known values below x, ties counting half, as 0 to 100 (values sorted ascending)
  function pct(sorted, x) {
    let below = 0, equal = 0;
    for (const v of sorted) {
      if (v < x) below++;
      else if (v === x) equal++;
      else break;
    }
    return ((below + equal / 2) / sorted.length) * 100;
  }

  // person: { targets: [6 numbers], weights: [6 numbers] }
  function score(rows, mode, person, sorted) {
    const wSum = person.weights.reduce((s, w) => s + w, 0);
    const tPct = person.targets.map((t, i) => pct(sorted[i], t));
    return rows.map((z) => {
      const close = z[mode].map((x, i) => (x == null ? 50 : 100 - Math.abs(pct(sorted[i], x) - tPct[i])));
      return { close, score: close.reduce((s, c, i) => s + c * person.weights[i], 0) / wSum };
    });
  }

  // people: one or two person objects. Returns per-zip results and each top n (Sets of zip codes)
  function run(zips, mode, people, n) {
    const rows = zips.filter((z) => z[mode]);
    const sorted = [0, 1, 2, 3, 4, 5].map((i) => rows.map((z) => z[mode][i]).filter((x) => x != null).sort((a, b) => a - b));
    const runs = people.map((p) => score(rows, mode, p, sorted));
    const out = rows.map((z, i) => {
      const scores = runs.map((r) => r[i].score);
      return { ...z, scores, close: runs.map((r) => r[i].close), both: Math.min(...scores) };
    });
    const top = (key) => new Set([...out].sort((a, b) => key(b) - key(a)).slice(0, n).map((r) => r.zip));
    return {
      rows: out,
      picks: runs.map((_, k) => top((r) => r.scores[k])),
      both: runs.length > 1 ? top((r) => r.both) : null,
    };
  }

  return { run };
})();
