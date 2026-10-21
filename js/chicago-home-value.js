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
  const buttons = document.querySelectorAll("[data-hv-model]");
  if (!chart || !window.Plot) return;

  let data = null;
  let model = "primary";              // or "extended", the post-hoc follow-up

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const money = (x) => "$" + Math.round(x).toLocaleString();

  // One record per zip, for whichever model is selected
  function rows() {
    const ext = model === "extended";
    return data.zips
      .filter((z) => (ext ? z.ext_residual != null : true))
      .map((z) => {
        const residual = ext ? z.ext_residual : z.residual;
        return {
          ...z,
          residual,
          predicted: z.ppsf - residual,
          pick: ext ? z.ext_pick : z.pick,
          name: (z.place || "Zip") + " " + z.zip + ", " + z.state,
        };
      });
  }

  function draw() {
    const m = data[model];
    const sd = m.residual_sd;
    const median = data.quality_median;
    const all = rows();
    const pick = css("--pick");
    const width = chart.clientWidth;
    const small = width < 520;

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
        Plot.rect([0], { x1: median, x2: 100, y1: -sd, y2: Math.min(-sd - 1, d3.min(all, (d) => d.residual) - 10), fill: pick, fillOpacity: 0.1 }),
        Plot.text([0], { x: 99, y: -sd, text: () => "Value picks", textAnchor: "end", dy: 12, fill: pick, fontWeight: 600 }),
        Plot.ruleY([0], { stroke: css("--text"), strokeOpacity: 0.6 }),
        Plot.ruleY([-sd], { stroke: pick, strokeDasharray: "4,3" }),
        Plot.ruleX([median], { stroke: css("--muted"), strokeDasharray: "4,3" }),
        Plot.text([0], { x: median, frameAnchor: "top", text: () => "median quality", textAnchor: "start", dx: 4, dy: 4, fill: css("--muted") }),
        // Every other zip first, so the picks draw on top
        Plot.dot(all.filter((d) => !d.pick), {
          x: "quality", y: "residual", symbol: "on_list", r: (d) => (d.on_list ? 4.5 : 3),
          fill: (d) => (d.on_list ? "none" : css("--other")), stroke: (d) => (d.on_list ? css("--text") : "none"),
          fillOpacity: 0.65, strokeWidth: 1.25,
        }),
        Plot.dot(all.filter((d) => d.pick), {
          x: "quality", y: "residual", symbol: "on_list", r: 5.5,
          fill: pick, stroke: (d) => (d.on_list ? css("--text") : css("--bg")), strokeWidth: 1.5,
        }),
        Plot.tip(all, Plot.pointer({
          x: "quality", y: "residual",
          fill: css("--bg"), stroke: css("--border"),
          title: (d) => [
            d.name,
            "Quality " + Math.round(d.quality) + " of 100",
            money(d.ppsf) + "/sq ft, model says " + money(d.predicted),
            (d.residual < 0 ? money(-d.residual) + " below" : money(d.residual) + " above") + " the model",
            d.pick ? "Value pick" : null,
            d.on_list ? "On the Niche list (" + d.list_entry + ")" : null,
          ].filter(Boolean).join("\n"),
        })),
      ],
    });
    plot.setAttribute("aria-label",
      "Scatter plot of " + all.length + " Chicago-area zip codes: quality score across, price above or below the model's prediction up and down. " +
      m.picks + " value picks sit in the lower right corner. The table below lists them.");
    chart.replaceChildren(plot);
  }

  function fillTable() {
    const picks = rows().filter((d) => d.pick).sort((a, b) => a.residual - b.residual);
    const other = model === "primary" ? "ext_pick" : "pick";
    const head = "<thead><tr><th>Zip</th><th>Place</th><th>Quality</th><th>$/sq ft</th><th>Model</th><th>Below by</th><th>Niche list</th><th>Also a pick in the " +
      (model === "primary" ? "follow-up" : "main") + " model</th></tr></thead>";
    const body = picks.map((d) => "<tr><td>" + d.zip + "</td><td>" + d.place + ", " + d.state + "</td><td>" + Math.round(d.quality) +
      "</td><td>" + money(d.ppsf) + "</td><td>" + money(d.predicted) + "</td><td>" + money(-d.residual) + "</td><td>" +
      (d.on_list ? "Yes" : "No") + "</td><td>" + (d[other] ? "Yes" : "No") + "</td></tr>").join("");
    table.innerHTML = head + "<tbody>" + body + "</tbody>";
    const m = data[model];
    document.getElementById("hv-summary").textContent =
      m.picks + " value picks out of " + m.n + " zips; " + m.not_on_list + " of them are not on the Niche list. R² = " + m.r2.toFixed(2) +
      ", one standard deviation = " + money(m.residual_sd) + "/sq ft.";
  }

  function show(next) {
    model = next;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.hvModel === model)));
    draw();
    fillTable();
  }

  buttons.forEach((b) => b.addEventListener("click", () => show(b.dataset.hvModel)));

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
    .then((json) => { data = json; show(model); })
    .catch(() => { chart.innerHTML = '<p class="muted">The chart could not load. The data is in the GitHub repo linked below.</p>'; });
})();
