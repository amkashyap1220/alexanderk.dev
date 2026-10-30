<!--
  The US map: each state colored by the measure the reader picks (pay, how
  many PAs there are for the population, growth, or how many new grads each
  state adds), with all of a state's numbers and ranks when it's clicked or
  picked from the list.
  states: the per-state rows from /research/pa-job-market.json (src/site_data.py
  in the PhysiciansAssistantJobExploration repo); the shapes are
  /research/pa-states.json (US Census via us-atlas).
-->
<script>
  import * as Plot from "@observablehq/plot";
  import { onMount } from "svelte";
  import { css, draw, k, num, onTheme } from "./pa.js";

  let { states } = $props();

  const plus = (x) => (x > 0 ? "+" : "") + Math.round(x) + "%";
  const MEASURES = [
    { key: "per_100k", name: "PAs for the population", long: "PAs per 100,000 residents (2025)", fmt: (x) => Math.round(x),
      hint: "Where PAs are already common, employers know how to use them. Where they're rare, there may be room to grow, or fewer jobs." },
    { key: "growth", name: "Growth", long: "Growth in PAs, 2021 to 2025", fmt: plus,
      hint: "How much the number of PAs living in the state grew in four years. Nationally it was +27%." },
    { key: "new_per_100", name: "New-grad competition", long: "New PAs (2024) per 100 PAs already there", fmt: (x) => x.toFixed(1),
      hint: "How many PAs were newly certified in 2024 for every 100 already living in the state. Higher means more new grads in the same pool, since many take jobs near where they grew up or trained." },
    { key: "pay", name: "Pay", long: "Average yearly income (2023)", fmt: k,
      hint: "What PAs living in each state earned in 2023 from all their PA jobs, on average. Not adjusted for local prices." },
  ];

  let geo = $state.raw(null), failed = $state(false);
  let measure = $state("per_100k"), selected = $state(null);
  let el, width = $state(0), theme = $state(0);
  const m = $derived(MEASURES.find((x) => x.key === measure));
  const byFips = $derived(new Map(states.map((s) => [s.fips, s])));
  const sel = $derived(states.find((s) => s.abbr === selected));

  onMount(() => {
    fetch("/research/pa-states.json").then((r) => r.json()).then((g) => (geo = g)).catch(() => (failed = true));
    return onTheme(() => theme++);
  });

  // Rank 1 = the highest value
  const rank = (s, key) => [...states].sort((a, b) => b[key] - a[key]).findIndex((x) => x.abbr === s.abbr) + 1;

  // Five color steps with about the same number of states in each
  const breaks = $derived.by(() => {
    const vals = states.map((s) => s[measure]).sort((a, b) => a - b);
    return [0.2, 0.4, 0.6, 0.8].map((p) => vals[Math.floor(p * vals.length)]);
  });
  const step = (v) => breaks.filter((b) => v >= b).length;

  $effect(() => {
    theme;
    if (!geo || width < 200) return;
    const ramp = [0, 1, 2, 3, 4].map((i) => css(`--pa-r${i}`));
    const shapes = geo.features.filter((f) => byFips.has(f.id));
    const plot = draw(el, `Map of US states colored by ${m.long.toLowerCase()}.`, {
      width, height: Math.round(width * 0.62), margin: 0,
      projection: { type: "albers-usa", domain: { type: "FeatureCollection", features: shapes } },
      marks: [
        Plot.geo(shapes, { fill: (f) => ramp[step(byFips.get(f.id)[measure])], stroke: css("--bg"), strokeWidth: 0.75 }),
        Plot.geo(shapes.filter((f) => byFips.get(f.id).abbr === selected), { stroke: css("--text"), strokeWidth: 2.5 }),
        Plot.tip(shapes, Plot.pointer(Plot.geoCentroid({ fill: css("--bg"), stroke: css("--border"),
          title: (f) => { const s = byFips.get(f.id); return s.name + "\n" + m.long + ": " + m.fmt(s[measure]) + " (#" + rank(s, measure) + ")\nClick for details"; } }))),
      ],
    });
    plot.style.cursor = "pointer";
    plot.addEventListener("click", () => { if (plot.value) selected = byFips.get(plot.value.id).abbr; });
  });

  const legend = $derived([null, ...breaks].map((b, i) => ({ text: i === 0 ? "below " + m.fmt(breaks[0]) : m.fmt(b) + "+", color: `--pa-r${i}` })));
</script>

<div class="pa-toggle" role="group" aria-label="Color the map by">
  {#each MEASURES as x}
    <button class="btn" class:primary={measure === x.key} aria-pressed={measure === x.key} onclick={() => (measure = x.key)}>{x.name}</button>
  {/each}
</div>
<p class="pa-hint">{m.hint}</p>
<ul class="pa-legend">
  {#each legend as l}<li><span class="pa-key" style="background: var({l.color})"></span>{l.text}</li>{/each}
</ul>
<div class="pa-map" bind:this={el} bind:clientWidth={width}>
  {#if failed}<p class="pa-hint">The map didn't load. Pick a state below to see its numbers.</p>{:else if !geo}<p class="pa-hint">Loading the map…</p>{/if}
</div>
<div class="pa-bar">
  <label class="pa-find">State <select bind:value={selected}>
    <option value={null}>Pick a state</option>
    {#each [...states].sort((a, b) => a.name.localeCompare(b.name)) as s}<option value={s.abbr}>{s.name}</option>{/each}
  </select></label>
</div>

{#if sel}
  <div class="pa-detail" aria-live="polite">
    <h3>{sel.name}</h3>
    <dl class="pa-dl">
      <dt>Certified PAs living there (2025)</dt><dd>{num(sel.pas)} (#{rank(sel, "pas")} of {states.length})</dd>
      {#each MEASURES as x}
        <dt>{x.long}</dt><dd>{x.fmt(sel[x.key])} (#{rank(sel, x.key)})</dd>
      {/each}
      <dt>Newly certified in 2024</dt><dd>{num(sel.new_pas)}</dd>
    </dl>
  </div>
{/if}
