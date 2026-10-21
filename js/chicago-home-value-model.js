/* ==========================================================================
   Chicago home value: the model, in the browser.
   The same steps as src/model.py in the Home-Value-Score repo, so readers
   can change the weights and see their own value picks:

   1. Quality score = weighted average of the four indicator percentiles
      (schools, safety, commute, walkability). A missing indicator is
      skipped, like the Python version.
   2. Ordinary least squares: price per sq ft on quality plus the cost
      factors that are switched on (tax rate, home age, energy bill,
      commuting fuel).
   3. Residual = actual minus predicted. A value pick has above-median
      quality and a residual more than one standard deviation below zero.

   With every weight at 1 and every cost factor on, this reproduces the
   published ranking.
   ========================================================================== */

window.HVModel = (function () {
  const COSTS = ["tax", "age", "energy", "fuel"];

  // Solve A x = b by Gaussian elimination with partial pivoting (A is small and square)
  function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n];
      for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
      x[r] = s / M[r][r];
    }
    return x;
  }

  function median(values) {
    const v = [...values].sort((a, b) => a - b);
    const m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  // weights: four numbers (schools, safety, commute, walkability), at least one above 0
  // costs: which cost factors to include, e.g. { tax: true, age: true, energy: true, fuel: true }
  function run(zips, weights, costs) {
    const used = COSTS.filter((c) => costs[c]);
    const rows = zips.map((z) => {
      let sum = 0, w = 0;
      z.p.forEach((p, i) => { if (p != null && weights[i] > 0) { sum += weights[i] * p; w += weights[i]; } });
      return { ...z, quality: w > 0 ? sum / w : null };
    }).filter((z) => z.quality != null);

    // Normal equations: (X'X) b = X'y
    const X = rows.map((z) => [1, z.quality, ...used.map((c) => z[c])]);
    const k = X[0].length;
    const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
    const Xty = new Array(k).fill(0);
    X.forEach((x, i) => {
      for (let a = 0; a < k; a++) {
        Xty[a] += x[a] * rows[i].price;
        for (let b = 0; b < k; b++) XtX[a][b] += x[a] * x[b];
      }
    });
    const beta = solve(XtX, Xty);

    const meanY = rows.reduce((s, z) => s + z.price, 0) / rows.length;
    let ssRes = 0, ssTot = 0;
    rows.forEach((z, i) => {
      z.predicted = X[i].reduce((s, v, j) => s + v * beta[j], 0);
      z.residual = z.price - z.predicted;
      ssRes += z.residual ** 2;
      ssTot += (z.price - meanY) ** 2;
    });
    const sd = Math.sqrt(rows.reduce((s, z) => s + z.residual ** 2, 0) / (rows.length - 1));   // residuals average 0
    const qMedian = median(rows.map((z) => z.quality));
    rows.forEach((z) => { z.pick = z.quality > qMedian && z.residual < -sd; });

    const picks = rows.filter((z) => z.pick);
    return {
      zips: rows,
      n: rows.length,
      r2: 1 - ssRes / ssTot,
      residual_sd: sd,
      quality_median: qMedian,
      picks: picks.length,
      not_on_list: picks.filter((z) => !z.on_list).length,
      quality_per_point: beta[1],
    };
  }

  return { run, COSTS };
})();
