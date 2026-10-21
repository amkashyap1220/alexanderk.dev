/* ==========================================================================
   Chicago home value: the chart and the value-picks table for the post.
   Reads /writing/chicago-home-value.json (made by src/site_data.py in the
   Home-Value-Score repo) and draws it with Observable Plot.

   One dot per zip. Across: quality score. Up and down: how far the price per
   sq ft is above or below what the model predicts (the residual). Value picks
   sit in the shaded corner: above-median quality and more than one standard
   deviation below the prediction. Colors come from the site's CSS variables,
   so the chart redraws when the theme or the width changes.
   ========================================================================== */

(function () {
  const chart = document.getElementById("hv-chart");
  const table = document.getElementById("hv-table");
  if (!chart || !window.Plot) return;

  let data = null;

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const money = (x) => "$" + Math.round(x).toLocaleString();
  const name = (z) => (z.place || "Zip") + " " + z.zip + ", " + z.state;

  function draw() {
    const sd = data.residual_sd;
    const median = data.quality_median;
    const all = data.zips;
    const pick = css("--pick");
    const width = chart.clientWidth;
    const small = width < 520;
    const bottom = d3.min(all, (d) => d.residual) - 10;   // the shaded corner runs to the bottom of the chart

    const plot = Plot.plot({
      width,
      height: small ? 380 : 460,
      marginLeft: 52,
      marginBottom: 40,
      style: { background: "transparent", color: css("--muted"), fontFamily: css("--font"), fontSize: "11px" },
      x: { domain: [0, 100], label: "Quality score →", labelAnchor: "right", labelOffset: 34 },
      y: { label: "↑ $/sq ft above the model's price", labelAnchor: "top", tickFormat: (d) => (d > 0 ? "+" : "") + d, grid: true },
      marks: [
        // The value-pick corner
        Plot.rect([0], { x1: median, x2: 100, y1: -sd, y2: bottom, fill: pick, fillOpacity: 0.1 }),
        Plot.text([0], { x: 99, y: bottom, text: () => "Value picks", textAnchor: "end", dy: -8, fill: pick, fontWeight: 600 }),
        Plot.ruleY([0], { stroke: css("--text"), strokeOpacity: 0.6 }),
        Plot.ruleY([-sd], { stroke: pick, strokeDasharray: "4,3" }),
        Plot.ruleX([median], { stroke: css("--muted"), strokeDasharray: "4,3" }),
        Plot.text([0], { x: median, frameAnchor: "top", text: () => "median quality", textAnchor: "start", dx: 4, dy: 4, fill: css("--muted") }),
        // Every other zip first, so the picks draw on top
        Plot.dot(all.filter((d) => !d.pick), { x: "quality", y: "residual", r: 3, fill: css("--other"), fillOpacity: 0.65 }),
        Plot.dot(all.filter((d) => d.pick), { x: "quality", y: "residual", r: 5.5, fill: pick, stroke: css("--bg"), strokeWidth: 1.5 }),
        Plot.tip(all, Plot.pointer({
          x: "quality", y: "residual",
          fill: css("--bg"), stroke: css("--border"),
          title: (d) => [
            name(d),
            "Quality " + Math.round(d.quality) + " of 100",
            money(d.ppsf) + "/sq ft, model says " + money(d.predicted),
            (d.residual < 0 ? money(-d.residual) + " below" : money(d.residual) + " above") + " the model",
            d.pick ? "Value pick" : null,
          ].filter(Boolean).join("\n"),
        })),
      ],
    });
    plot.setAttribute("aria-label",
      "Scatter plot of " + all.length + " Chicago-area zip codes: quality score across, price above or below the model's prediction up and down. " +
      data.picks + " value picks sit in the lower right corner. The table below lists them.");
    chart.replaceChildren(plot);
  }

  function fillTable() {
    const picks = data.zips.filter((d) => d.pick).sort((a, b) => a.residual - b.residual);
    const head = "<thead><tr><th>#</th><th>Zip</th><th>Place</th><th>Quality</th><th>$/sq ft</th><th>Model</th><th>Below by</th></tr></thead>";
    const body = picks.map((d, i) => "<tr><td>" + (i + 1) + "</td><td>" + d.zip + "</td><td>" + d.place + ", " + d.state + "</td><td>" +
      Math.round(d.quality) + "</td><td>" + money(d.ppsf) + "</td><td>" + money(d.predicted) + "</td><td>" + money(-d.residual) + "</td></tr>").join("");
    table.innerHTML = head + "<tbody>" + body + "</tbody>";
    document.getElementById("hv-summary").textContent =
      data.picks + " value picks out of " + data.n + " zips. R² = " + data.r2.toFixed(2) +
      ", one standard deviation = " + money(data.residual_sd) + "/sq ft.";
  }

  // Redraw when the theme changes (js/theme.js swaps .light/.dark on <html>) or the width does
  new MutationObserver(() => data && draw()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  let lastWidth = 0;
  new ResizeObserver(() => {
    if (!data || chart.clientWidth === lastWidth) return;
    lastWidth = chart.clientWidth;
    draw();
  }).observe(chart);

  fetch("/writing/chicago-home-value.json")
    .then((r) => r.json())
    .then((json) => { data = json; draw(); fillTable(); })
    .catch(() => { chart.innerHTML = '<p class="muted">The chart could not load. The data is in the GitHub repo linked below.</p>'; });
})();
