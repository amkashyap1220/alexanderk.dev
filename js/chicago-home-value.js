/* ==========================================================================
   Chicago home value: the charts and tables for the post.
   Reads /writing/chicago-home-value.json (made by src/site_data.py in the
   Home-Value-Score repo) and draws it with Observable Plot.

   One dot per zip. Across: quality score. Up and down: how far the price per
   sq ft is above or below what the model predicts (the residual). Value picks
   sit in the shaded corner: above-median quality and more than one standard
   deviation below the prediction.

   Two charts: the published ranking, and "Try your own weights", which
   refits the model with js/chicago-home-value-model.js every time a control
   changes and marks the Niche-list zips. Colors come from the site's CSS
   variables, so both redraw when the theme or the width changes.
   ========================================================================== */

(function () {
  const main = { chart: document.getElementById("hv-chart"), table: document.getElementById("hv-table") };
  const mine = { chart: document.getElementById("hv-x-chart"), table: document.getElementById("hv-x-table") };
  const form = document.getElementById("hv-form");
  if (!main.chart || !window.Plot) return;

  let data = null;
  let published = null;   // the ranking in the post, as model results
  let yours = null;       // the reader's own run

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const money = (x) => "$" + Math.round(x).toLocaleString();
  const name = (z) => (z.place || "Zip") + " " + z.zip + ", " + z.state;

  function draw(el, result, showList) {
    const sd = result.residual_sd;
    const median = result.quality_median;
    const all = result.zips;
    const pick = css("--pick");
    const width = el.clientWidth;
    if (width < 200) return;   // not laid out yet; the ResizeObserver draws it once it is
    const small = width < 520;
    const bottom = d3.min(all, (d) => d.residual) - 10;   // the shaded corner runs to the bottom of the chart
    const list = (d) => showList && d.on_list;

    const plot = Plot.plot({
      width,
      height: small ? 380 : 460,
      marginLeft: 52,
      marginBottom: 40,
      style: { background: "transparent", color: css("--muted"), fontFamily: css("--font"), fontSize: "11px" },
      x: { domain: [0, 100], label: "Quality score →", labelAnchor: "right", labelOffset: 34 },
      y: { label: "↑ $/sq ft above the model's price", labelAnchor: "top", tickFormat: (d) => (d > 0 ? "+" : "") + d, grid: true },
      symbol: { domain: [false, true], range: ["circle", "diamond"] },
      marks: [
        // The value-pick corner
        Plot.rect([0], { x1: median, x2: 100, y1: -sd, y2: bottom, fill: pick, fillOpacity: 0.1 }),
        Plot.text([0], { x: 99, y: bottom, text: () => "Value picks", textAnchor: "end", dy: -8, fill: pick, fontWeight: 600 }),
        Plot.ruleY([0], { stroke: css("--text"), strokeOpacity: 0.6 }),
        Plot.ruleY([-sd], { stroke: pick, strokeDasharray: "4,3" }),
        Plot.ruleX([median], { stroke: css("--muted"), strokeDasharray: "4,3" }),
        Plot.text([0], { x: median, frameAnchor: "top", text: () => "median quality", textAnchor: "start", dx: 4, dy: 4, fill: css("--muted") }),
        // Every other zip first, so the picks draw on top
        Plot.dot(all.filter((d) => !d.pick), {
          x: "quality", y: "residual", symbol: list, r: (d) => (list(d) ? 4.5 : 3),
          fill: (d) => (list(d) ? "none" : css("--other")), stroke: (d) => (list(d) ? css("--text") : "none"),
          fillOpacity: 0.65, strokeWidth: 1.25,
        }),
        Plot.dot(all.filter((d) => d.pick), {
          x: "quality", y: "residual", symbol: list, r: 5.5,
          fill: pick, stroke: (d) => (list(d) ? css("--text") : css("--bg")), strokeWidth: 1.5,
        }),
        Plot.tip(all, Plot.pointer({
          x: "quality", y: "residual",
          fill: css("--bg"), stroke: css("--border"),
          title: (d) => [
            name(d),
            "Quality " + Math.round(d.quality) + " of 100",
            money(d.price) + "/sq ft, model says " + money(d.predicted),
            (d.residual < 0 ? money(-d.residual) + " below" : money(d.residual) + " above") + " the model",
            d.pick ? "Value pick" : null,
            list(d) ? "On the Niche list (" + d.list_entry + ")" : null,
          ].filter(Boolean).join("\n"),
        })),
      ],
    });
    plot.setAttribute("aria-label",
      "Scatter plot of " + all.length + " Chicago-area zip codes: quality score across, price above or below the model's prediction up and down. " +
      result.picks + " value picks sit in the lower right corner. The table below lists them.");
    el.replaceChildren(plot);
  }

  function fillTable(el, result, showList) {
    const picks = result.zips.filter((d) => d.pick).sort((a, b) => a.residual - b.residual);
    const extra = showList ? "<th>Niche list</th><th>In my ranking</th>" : "";
    const head = "<thead><tr><th>#</th><th>Zip</th><th>Place</th><th>Quality</th><th>$/sq ft</th><th>Model</th><th>Below by</th>" + extra + "</tr></thead>";
    const mineSet = new Set(published.zips.filter((d) => d.pick).map((d) => d.zip));
    const body = picks.map((d, i) => "<tr><td>" + (i + 1) + "</td><td>" + d.zip + "</td><td>" + d.place + ", " + d.state + "</td><td>" +
      Math.round(d.quality) + "</td><td>" + money(d.price) + "</td><td>" + money(d.predicted) + "</td><td>" + money(-d.residual) + "</td>" +
      (showList ? "<td>" + (d.on_list ? "Yes" : "No") + "</td><td>" + (mineSet.has(d.zip) ? "Yes" : "No") + "</td>" : "") + "</tr>").join("");
    el.innerHTML = head + "<tbody>" + body + "</tbody>";
  }

  // The published ranking, from the numbers model.py saved
  function publishedResult() {
    return {
      zips: data.zips.map((z) => ({ ...z, price: z.ppsf })),
      n: data.n, r2: data.r2, residual_sd: data.residual_sd, quality_median: data.quality_median,
      picks: data.picks, not_on_list: data.not_on_list,
    };
  }

  function readForm() {
    const f = form.elements;
    const weights = [0, 1, 2, 3].map((i) => Number(f["w" + i].value));
    const costs = Object.fromEntries(window.HVModel.COSTS.map((c) => [c, f[c].checked]));
    [0, 1, 2, 3].forEach((i) => { f["w" + i].nextElementSibling.textContent = f["w" + i].value; });
    return { weights, costs };
  }

  function rerun() {
    const { weights, costs } = readForm();
    const summary = document.getElementById("hv-x-summary");
    if (weights.every((w) => w === 0)) {
      summary.textContent = "Give at least one quality indicator a weight above 0.";
      return;
    }
    yours = window.HVModel.run(data.zips, weights, costs);
    const both = yours.zips.filter((d) => d.pick && published.zips.find((p) => p.zip === d.zip && p.pick)).length;
    summary.innerHTML = "<b>" + yours.picks + " value picks</b>, and <b>" + yours.not_on_list + " of them are not on the Niche list</b>. " +
      both + " are also in my ranking. The model explains " + Math.round(yours.r2 * 100) + "% of prices, and a pick is at least " +
      money(yours.residual_sd) + "/sq ft below its predicted price.";
    draw(mine.chart, yours, true);
    fillTable(mine.table, yours, true);
  }

  function drawAll() {
    draw(main.chart, published, false);
    if (yours) draw(mine.chart, yours, true);
  }

  // Redraw when the theme changes (js/theme.js swaps .light/.dark on <html>) or the width does
  new MutationObserver(() => data && drawAll()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  let lastWidth = 0;
  new ResizeObserver(() => {
    if (!data || main.chart.clientWidth === lastWidth) return;
    lastWidth = main.chart.clientWidth;
    drawAll();
  }).observe(main.chart);
  if (mine.chart) new ResizeObserver(() => yours && mine.chart.clientWidth >= 200 && !mine.chart.firstElementChild?.matches("svg") && draw(mine.chart, yours, true)).observe(mine.chart);

  fetch("/writing/chicago-home-value.json")
    .then((r) => r.json())
    .then((json) => {
      data = json;
      published = publishedResult();
      draw(main.chart, published, false);
      fillTable(main.table, published, false);
      document.getElementById("hv-summary").textContent =
        data.picks + " value picks out of " + data.n + " zips. R² = " + data.r2.toFixed(2) +
        ", one standard deviation = " + money(data.residual_sd) + "/sq ft.";
      if (form && window.HVModel) {
        form.addEventListener("input", rerun);
        form.addEventListener("reset", () => setTimeout(rerun));   // after the browser resets the values
        rerun();
      }
    })
    .catch(() => { main.chart.innerHTML = '<p class="muted">The chart could not load. The data is in the GitHub repo linked above.</p>'; });
})();
