<!-- Horizontal bars, longest first (unless sort is false), each labelled with
     its value. Rows are { label, value }, plus median, hours, over200 and pas
     for the specialty pay chart's tips, or tip for any other extra line. With
     above set, bars over that value are the main color and the rest are
     lighter; with highlight set, only the row with that label is. With dots, each row is a dot
     on a line and the axis starts near the smallest value, so close values
     can be told apart. -->
<script>
  import * as Plot from "@observablehq/plot";
  import { onMount } from "svelte";
  import { css, draw, fmt, halo, onTheme, rowLayout, tick } from "./pa.js";

  let { rows, format: formatName, label, above = null, highlight = null, xLabel = null, sort = true, dots = false } = $props();

  const format = $derived(fmt(formatName)), ticks = $derived(tick(formatName));
  let el, width = $state(0), theme = $state(0);
  onMount(() => onTheme(() => theme++));

  // The tip: the value, plus the specialty pay chart's extra numbers when the rows have them
  const tipText = (r) => [r.label, format(r.value),
    r.median != null && "Median " + fmt("money")(r.median), r.hours != null && r.hours + " hours a week on average",
    r.over200 != null && r.over200 + "% earn over $200k", r.pas != null && r.pas.toLocaleString() + " PAs", r.tip].filter(Boolean).join("\n");

  $effect(() => {
    theme;
    if (width < 200) return;
    const data = sort ? [...rows].sort((a, b) => b.value - a.value) : rows;
    const L = rowLayout(data, width), dy = L.dy;
    const max = Math.max(...data.map((r) => r.value)), min = Math.min(...data.map((r) => r.value));
    const lo = dots ? Math.floor((min - (max - min) * 0.15) / 5000) * 5000 : 0;
    const main = (r) => (highlight != null ? r.label === highlight : above == null || r.value > above);
    const fill = (r) => css(main(r) ? "--pa-1" : "--pa-r2");
    draw(el, label, {
      width, height: L.height,
      marginLeft: L.marginLeft, marginRight: 64, marginTop: L.stacked ? 14 : 4, marginBottom: 30,
      x: { domain: [lo, max], label: xLabel, tickFormat: ticks, ticks: L.stacked ? 3 : 5, grid: true },
      y: L.y,
      marks: [
        L.names,
        dots
          ? [Plot.ruleY(data, { y: "label", x1: lo, x2: "value", dy, stroke: css("--border"), strokeWidth: 2 }), Plot.dot(data, { x: "value", y: "label", dy, r: 6, fill })]
          : Plot.barX(data, { x: "value", y: "label", fill, rx: 2, insetTop: L.stacked ? 20 : 3, insetBottom: L.stacked ? 4 : 3 }),
        above != null && dots ? Plot.ruleX([above], { stroke: css("--muted"), strokeDasharray: "3,3" }) : null,
        Plot.text(data, { x: "value", y: "label", dy, text: (r) => format(r.value), textAnchor: "start", dx: dots ? 10 : 5, fill: css("--text"), ...halo() }),
        Plot.tip(data, Plot.pointerY({ x: "value", y: "label", fill: css("--bg"), stroke: css("--border"), title: tipText })),
      ],
    });
  });
</script>

<div class="pa-chart" bind:this={el} bind:clientWidth={width}></div>
