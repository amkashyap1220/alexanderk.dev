<!-- One or two lines over the years, e.g. PA jobs and pay since 2015.
     Rows are { year, a } or { year, a, b }; names label the series. With two
     series, each gets its own scale: both are shown as % change since the first year. -->
<script>
  import * as Plot from "@observablehq/plot";
  import { onMount } from "svelte";
  import { css, draw, halo, onTheme } from "./pa.js";

  let { rows, names, format, label } = $props();

  let el, width = $state(0), theme = $state(0);
  onMount(() => onTheme(() => theme++));

  $effect(() => {
    theme;
    if (width < 200) return;
    const narrow = width < 560;
    const keys = rows.some((r) => r.b != null) ? ["a", "b"] : ["a"];
    const first = rows[0];
    const long = keys.flatMap((key, i) => rows.filter((r) => r[key] != null).map((r) => ({ year: r.year, s: names[i], raw: r[key], v: (r[key] / first[key] - 1) * 100 })));
    const colors = [css("--pa-1"), css("--pa-2")];
    const last = keys.map((key, i) => long.filter((d) => d.s === names[i]).at(-1));
    draw(el, label, {
      width, height: narrow ? 260 : 300,
      marginLeft: 44, marginRight: narrow ? 16 : 120, marginTop: 16, marginBottom: 30,
      x: { label: null, tickFormat: (d) => String(d), ticks: narrow ? 4 : 8 },
      y: { label: `Change since ${first.year}`, tickFormat: (d) => (d > 0 ? "+" : "") + d + "%", grid: true, nice: true },
      color: { domain: names.slice(0, keys.length), range: colors },
      marks: [
        Plot.ruleY([0], { stroke: css("--border") }),
        Plot.line(long, { x: "year", y: "v", stroke: "s", strokeWidth: 2.5, curve: "monotone-x" }),
        Plot.dot(long, { x: "year", y: "v", fill: "s", r: 3 }),
        narrow ? null : Plot.text(last, { x: "year", y: "v", text: (d) => d.s + " " + (d.v > 0 ? "+" : "") + Math.round(d.v) + "%", textAnchor: "start", dx: 8, fill: "s", ...halo() }),
        Plot.tip(long, Plot.pointer({ x: "year", y: "v", fill: css("--bg"), stroke: css("--border"), title: (d) => d.s + ", May " + d.year + "\n" + format[names.indexOf(d.s)](d.raw) })),
      ],
    });
  });
</script>

<ul class="pa-legend">
  {#each names.slice(0, rows.some((r) => r.b != null) ? 2 : 1) as n, i}<li><span class="pa-key" style="background: var(--pa-{i + 1})"></span>{n}</li>{/each}
</ul>
<div class="pa-chart" bind:this={el} bind:clientWidth={width}></div>
