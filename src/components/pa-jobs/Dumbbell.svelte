<!-- Two values per row joined by a line, e.g. where new PAs took jobs vs
     where the ones still looking want to work. Rows are { label, a, b };
     names are the two series' names for the legend. -->
<script>
  import * as Plot from "@observablehq/plot";
  import { onMount } from "svelte";
  import { css, draw, fmt, halo, onTheme, rowLayout, tick } from "./pa.js";

  let { rows, names, format: formatName, label, xLabel = null } = $props();

  const format = $derived(fmt(formatName)), ticks = $derived(tick(formatName));
  let el, width = $state(0), theme = $state(0);
  onMount(() => onTheme(() => theme++));

  $effect(() => {
    theme;
    if (width < 200) return;
    const data = [...rows].sort((p, q) => Math.max(q.a, q.b) - Math.max(p.a, p.b));
    const L = rowLayout(data, width), dy = L.dy;
    const [ca, cb] = [css("--pa-1"), css("--pa-2")];
    // The smaller value is labelled only when its dot has room on its left
    const top = Math.max(...data.map((r) => Math.max(r.a, r.b)));
    draw(el, label, {
      width, height: L.height,
      marginLeft: L.marginLeft, marginRight: 48, marginTop: L.stacked ? 14 : 4, marginBottom: 30,
      x: { label: xLabel, tickFormat: ticks, ticks: L.stacked ? 3 : 5, grid: true, nice: true },
      y: L.y,
      marks: [
        L.names,
        Plot.link(data, { x1: "a", x2: "b", y: "label", dy, stroke: css("--border"), strokeWidth: 3 }),
        Plot.dot(data, { x: "b", y: "label", dy, r: 5, fill: cb }),
        Plot.dot(data, { x: "a", y: "label", dy, r: 5, fill: ca }),
        // Each value next to its own dot: the larger one to the right, the smaller to the left
        Plot.text(data, { x: (r) => Math.max(r.a, r.b), y: "label", dy, text: (r) => format(Math.max(r.a, r.b)), textAnchor: "start", dx: 9, fill: (r) => (r.a >= r.b ? ca : cb), ...halo() }),
        Plot.text(data, { x: (r) => Math.min(r.a, r.b), y: "label", dy, text: (r) => format(Math.min(r.a, r.b)), textAnchor: "end", dx: -9, fill: (r) => (r.a >= r.b ? cb : ca), filter: (r) => Math.abs(r.a - r.b) > 0.15 * Math.max(r.a, r.b) && Math.min(r.a, r.b) > 0.12 * top, ...halo() }),
        Plot.tip(data, Plot.pointerY({ x: (r) => Math.max(r.a, r.b), y: "label", fill: css("--bg"), stroke: css("--border"),
          title: (r) => r.label + "\n" + names[0] + ": " + format(r.a) + "\n" + names[1] + ": " + format(r.b) })),
      ],
    });
  });
</script>

<ul class="pa-legend">
  <li><span class="pa-key" style="background: var(--pa-1)"></span>{names[0]}</li>
  <li><span class="pa-key" style="background: var(--pa-2)"></span>{names[1]}</li>
</ul>
<div class="pa-chart" bind:this={el} bind:clientWidth={width}></div>
