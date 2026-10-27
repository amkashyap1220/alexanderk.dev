<!-- Fit vs price chart (buyers): your fit score across, price vs expected up and down -->
<script>
  import * as Plot from "@observablehq/plot";
  import { min } from "d3";
  import { CONF, css, gapText, name } from "./hv.js";
  import { frame, valueColor } from "./plot.js";

  let { data, result, cur, rank, mode, selected, theme, onselect } = $props();

  let chartEl, width = $state(0);
  const shown = $derived(!!result && mode === "buy");

  $effect(() => {
    theme;   // the colors come from the page's CSS, so redraw when the theme changes
    if (!shown || width < 200) return;
    const { picks, score, ranked } = cur;
    const rows = result.rows.filter((r) => r.value && ranked(r) && score(r) != null);
    const cut = Math.min(...rows.filter((r) => picks.has(r.zip)).map(score));
    const color = valueColor();
    const y = (r) => Math.max(-60, Math.min(60, r.value.gap * 100));
    const x0 = min(rows, score);
    const bg = css("--bg");
    const narrow = width < 560;   // phones: a taller chart and shorter labels, so nothing collides
    // Labels get a halo in the page color so they stay readable over the dots
    const halo = { stroke: bg, strokeWidth: 4, paintOrder: "stroke" };
    frame(chartEl, width, Math.min(420, Math.round(width * (narrow ? 0.95 : 0.7))), [
      Plot.ruleY([0], { stroke: css("--border") }),
      Plot.rectY([0], { x1: x0, x2: 100, y1: -100 * data.value_model.in_line_band, y2: 100 * data.value_model.in_line_band, fill: css("--border"), fillOpacity: 0.35 }),
      Plot.ruleX([cut], { stroke: css("--hv-top"), strokeDasharray: "4,3" }),
      Plot.dot(rows, { x: score, y, r: (r) => (picks.has(r.zip) ? 5 : 3.5), fill: (r) => color(r.value.gap), fillOpacity: (r) => (r.value.conf === "low" ? 0.35 : 0.9),
        stroke: (r) => (r.zip === selected ? css("--text") : picks.has(r.zip) ? css("--hv-top") : css("--muted")), strokeWidth: (r) => (r.zip === selected || picks.has(r.zip) ? 2 : 0.5) }),
      // Left of the dashed line, pointing at it, so it never runs past the right edge
      Plot.text([[(narrow ? "Top " : "Your top ") + data.top + " →"]], { x: cut, frameAnchor: "top", dx: -6, dy: 4, textAnchor: "end", text: (d) => d[0], fill: css("--hv-top"), ...halo }),
      Plot.text([narrow ? "Cheaper than predicted" : "Cheaper than its features predict"], { frameAnchor: "bottom-left", dx: 6, dy: -4, fill: css("--muted"), ...halo }),
      Plot.text([narrow ? "Pricier than predicted" : "Pricier than its features predict"], { frameAnchor: "top-left", dx: 6, dy: 4, fill: css("--muted"), ...halo }),
      Plot.tip(rows, Plot.pointer({ x: score, y, fill: bg, stroke: css("--border"),
        title: (r) => name(r) + " " + r.zip + "\nFit " + Math.round(score(r)) + (rank.has(r.zip) ? " (#" + rank.get(r.zip) + ")" : "") +
          "\n$" + Math.round(r.value.ppsf) + "/sq ft vs $" + Math.round(r.value.expected) + " expected: " + gapText(r.value.gap) +
          "\n" + CONF[r.value.conf] + " confidence\nClick for details" })),
    ], "Scatter chart of " + rows.length + " ranked zips: fit score across, price per square foot compared with the expected price up and down.", (zip) => onselect(zip, false), {
      marginLeft: 44, marginBottom: 36, marginTop: 20, marginRight: 12,
      x: { label: "Fit to your targets →", domain: [x0, 100], nice: false },
      y: { label: "↑ Price vs expected (%)", domain: [-60, 60], tickFormat: (d) => (d > 0 ? "+" : "") + d + "%" },
    });
  });
</script>

<figure class="hv-chart-box" id="hv-chart-box" hidden={!shown}>
  <h2 class="hv-h">Fit vs price</h2>
  <p class="hv-hint">Two different questions: how well a zip matches what you want (across), and whether it sells for less or more than zips with the same measured features (up and down). Your best leads sit on the right; lower right is a good fit that also sells below its expected price.</p>
  <div id="hv-chart" class="hv-chart" bind:this={chartEl} bind:clientWidth={width}></div>
  <figcaption id="hv-chart-note">{#if shown}Each dot is a ranked zip. Right of the dashed line are your top {data.top}. The shaded band is ±{Math.round(data.value_model.in_line_band * 100)}%, where a price counts as in line. Faded dots: low confidence. Gaps beyond ±60% are drawn at the edge.{/if}</figcaption>
</figure>
