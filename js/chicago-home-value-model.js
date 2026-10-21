/* ==========================================================================
   Chicago home value: the target score, in the browser.
   The same steps as src/value.py in the Home-Value-Score repo:

   1. The reader sets a target and a weight for six factors: schools,
      safety, commute, walkability, home age, and price (median sale price
      for buyers, median rent for renters). If they name a workplace zip,
      commute is the drive time from each zip to it (no traffic) instead of
      the Census average commute.
   2. Closeness is measured in percentile points, so minutes, dollars and
      crime rates are comparable. pct(x) is the share of the sample's zips
      below x (ties count half), and
        closeness = 100 - |pct(zip's value) - pct(target)|
      It's 100 exactly on target and lower the further away. For schools,
      safety and price, doing better than the target also counts as 100.
      A missing value counts as 50.
   3. Score = weighted average of the six closeness values.
   4. Top areas = the 20 highest scores. For two people, "best for both"
      ranks by the lower of the two scores.
   ========================================================================== */

window.HVModel = (function () {
  // Which way is "better than the target": +1 higher is better, -1 lower is better, 0 no better side
  // (schools, safety, commute, walkability, home age, price), the same as DIRECTION in src/value.py
  const DIRECTION = [1, -1, 0, 0, 0, -1];

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

  // One person's six values for a zip. With a workplace, commute is the drive time to it instead of the Census average.
  function values(z, mode, person, drive) {
    const v = z[mode].slice();
    if (person.workplace && drive) v[2] = drive(z.zip, person.workplace);
    return v;
  }

  // person: { targets: [6 numbers], weights: [6 numbers], workplace: zip or null }
  function score(rows, mode, person, drive) {
    const vals = rows.map((z) => values(z, mode, person, drive));
    const sorted = [0, 1, 2, 3, 4, 5].map((i) => vals.map((v) => v[i]).filter((x) => x != null).sort((a, b) => a - b));
    const wSum = person.weights.reduce((s, w) => s + w, 0);
    const tPct = person.targets.map((t, i) => pct(sorted[i], t));
    return vals.map((v) => {
      const close = v.map((x, i) => {
        if (x == null) return 50;
        const gap = pct(sorted[i], x) - tPct[i];
        return gap * DIRECTION[i] > 0 ? 100 : 100 - Math.abs(gap);   // better than the target counts as on target
      });
      return { close, commute: v[2], score: close.reduce((s, c, i) => s + c * person.weights[i], 0) / wSum };
    });
  }

  // people: one or two person objects; drive(fromZip, toZip) gives drive minutes.
  // Returns per-zip results and each top n (Sets of zip codes)
  function run(zips, mode, people, n, drive) {
    const rows = zips.filter((z) => z[mode]);
    const runs = people.map((p) => score(rows, mode, p, drive));
    const out = rows.map((z, i) => {
      const scores = runs.map((r) => r[i].score);
      return { ...z, scores, close: runs.map((r) => r[i].close), commutes: runs.map((r) => r[i].commute), both: Math.min(...scores) };
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
