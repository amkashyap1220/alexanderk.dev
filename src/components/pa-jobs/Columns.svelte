<!-- Side-by-side columns for a distribution, such as pay ranges. Rows are
     { label, a } or { label, a, b }; names label the one or two series. -->
<script>
  import * as Plot from "@observablehq/plot";
  import { onMount } from "svelte";
  import { css, draw, fmt, onTheme, tick } from "./pa.js";

  let { rows, names, format: formatName, label, yLabel = null } = $props();

  const format = $derived(fmt(formatName)), ticks = $derived(tick(formatName));
  let el, width = $state(0), theme = $state(0);
  onMount(() => onTheme(() => theme++));
  const two = $derived(rows.some((r) => r.b != null));

  $effect(() => {
    theme;
    if (width < 200) return;
    const narrow = width < 560;
    const long = rows.flatMap((r) => [{ label: r.label, s: names[0], v: r.a }, ...(two ? [{ label: r.label, s: names[1], v: r.b }] : [])]);
    const colors = [css("--pa-1"), css("--pa-2")];
    // Two series: each range is a group (fx) with one column per series (x)
    draw(el, label, {
      width, height: narrow ? 300 : 280,
      marginLeft: 40, marginBottom: narrow ? 70 : 50, marginTop: 12,
      fx: { domain: rows.map((r) => r.label), label: null, axis: "bottom", tickRotate: narrow ? -45 : 0, padding: 0.12 },
      x: { domain: names.slice(0, two ? 2 : 1), axis: null, padding: 0.05 },
      y: { label: yLabel, tickFormat: ticks, grid: true, nice: true },
      color: { domain: names.slice(0, two ? 2 : 1), range: colors },
      marks: [
        Plot.barY(long, { fx: "label", x: "s", y: "v", fill: "s", rx: 2 }),
        Plot.ruleY([0], { stroke: css("--border") }),
        Plot.tip(long, Plot.pointer({ fx: "label", x: "s", y: "v", fill: css("--bg"), stroke: css("--border"), title: (d) => d.label + "\n" + d.s + ": " + format(d.v) })),
      ],
    });
  });
</script>

{#if two}
  <ul class="pa-legend">
    <li><span class="pa-key" style="background: var(--pa-1)"></span>{names[0]}</li>
    <li><span class="pa-key" style="background: var(--pa-2)"></span>{names[1]}</li>
  </ul>
{/if}
<div class="pa-chart" bind:this={el} bind:clientWidth={width}></div>
