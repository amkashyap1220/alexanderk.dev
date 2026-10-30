<!--
  The US map: each state colored by the measure the reader picks, with all of
  a state's numbers and ranks when it's clicked or picked from the list. With
  metros, a second view shows each metro area as a circle sized by its PA jobs
  and colored by the same measure.
  states: the per-state rows from /research/pa-job-market.json (src/site_data.py
  in the PhysiciansAssistantJobExploration repo); the shapes are
  /research/pa-states.json (US Census via us-atlas). measures: the keys of
  FIELDS the reader can color by; details: the keys shown for a picked state.
-->
<script>
  import * as Plot from "@observablehq/plot";
  import { onMount } from "svelte";
  import { css, draw, k, num, onTheme } from "./pa.js";

  let { states, measures, details, metros: withMetros = false } = $props();

  const plus = (x) => (x > 0 ? "+" : "") + Math.round(x) + "%";
  const FIELDS = {
    per_100k: { name: "PAs for the population", long: "PAs per 100,000 residents (2025)", fmt: (x) => Math.round(x),
      hint: "Where PAs are already common, employers know how to use them. Where they're rare, there may be room to grow, or fewer jobs." },
    growth: { name: "Growth", long: "Growth in PAs, 2021 to 2025", fmt: plus,
      hint: "How much the number of PAs living in the state grew in four years. Nationally it was +27%." },
    new_per_100: { name: "New-grad competition", long: "New PAs (2024) per 100 PAs already there", fmt: (x) => x.toFixed(1),
      hint: "How many PAs were newly certified in 2024 for every 100 already living in the state. Higher means more new grads in the same pool, since many take jobs near where they grew up or trained." },
    pay: { name: "Pay", long: "Median yearly pay (May 2025)", fmt: k,
      hint: "Half of PAs working there earn more than this and half earn less. Not adjusted for local prices." },
    pay_adj: { name: "Pay after cost of living", long: "Median pay at US-average prices", fmt: k,
      hint: "Median pay divided by how expensive the area is, so places can be compared. $130k where prices are 10% below average goes as far as about $144k at average prices." },
    pas: { long: "Certified PAs living there (2025)", fmt: num },
    new_pas: { long: "Newly certified in 2024", fmt: num, norank: true },
    jobs: { long: "PA jobs (May 2025)", fmt: num },
    rpp: { long: "Prices (100 = US average, 2024)", fmt: (x) => x.toFixed(1) },
  };

  let geo = $state.raw(null), metros = $state.raw(null), failed = $state(false);
  let measure = $state(measures[0]), selected = $state(null), view = $state("states");
  let el, width = $state(0), theme = $state(0);
  const m = $derived(FIELDS[measure]);
  const byFips = $derived(new Map(states.map((s) => [s.fips, s])));
  const sel = $derived(states.find((s) => s.abbr === selected));
  const showMetros = $derived(view === "metros" && metros != null);

  onMount(() => {
    fetch("/research/pa-states.json").then((r) => r.json()).then((g) => (geo = g)).catch(() => (failed = true));
    // The metro rows are only in the data file, so the page doesn't carry all of them
    if (withMetros) fetch("/research/pa-job-market.json").then((r) => r.json()).then((d) => (metros = d.metros)).catch(() => (view = "states"));
    return onTheme(() => theme++);
  });

  // Rank 1 = the highest value
  const rank = (s, key) => [...states].sort((a, b) => b[key] - a[key]).findIndex((x) => x.abbr === s.abbr) + 1;

  // Five color steps with about the same number of states (or metro areas) in each
  const breaks = $derived.by(() => {
    const vals = (showMetros ? metros : states).map((s) => s[measure]).sort((a, b) => a - b);
    return [0.2, 0.4, 0.6, 0.8].map((p) => vals[Math.floor(p * vals.length)]);
  });
  const step = (v) => breaks.filter((b) => v >= b).length;

  $effect(() => {
    theme;
    if (!geo || width < 200) return;
    const ramp = [0, 1, 2, 3, 4].map((i) => css(`--pa-r${i}`));
    const shapes = geo.features.filter((f) => byFips.has(f.id));
    const tipStyle = { fill: css("--bg"), stroke: css("--border") };
    const outline = Plot.geo(shapes.filter((f) => byFips.get(f.id).abbr === selected), { stroke: css("--text"), strokeWidth: 2.5 });
    const marks = showMetros
      ? [
          Plot.geo(shapes, { fill: css("--soft"), stroke: css("--border"), strokeWidth: 0.75 }),
          outline,
          // Biggest first, so the small circles stay on top where they overlap
          Plot.dot(metros, { x: "lon", y: "lat", r: "jobs", fill: (d) => ramp[step(d[measure])], stroke: css("--muted"), strokeWidth: 0.5, fillOpacity: 0.9 }),
          Plot.tip(metros, Plot.pointer({ x: "lon", y: "lat", ...tipStyle,
            title: (d) => d.name.replaceAll("--", "–") + "\n" + num(d.jobs) + " PA jobs\nMedian pay " + k(d.pay) + "\nAfter cost of living " + k(d.pay_adj) })),
        ]
      : [
          Plot.geo(shapes, { fill: (f) => ramp[step(byFips.get(f.id)[measure])], stroke: css("--bg"), strokeWidth: 0.75 }),
          outline,
          Plot.tip(shapes, Plot.pointer(Plot.geoCentroid({ ...tipStyle,
            title: (f) => { const s = byFips.get(f.id); return s.name + "\n" + m.long + ": " + m.fmt(s[measure]) + " (#" + rank(s, measure) + ")\nClick for details"; } }))),
        ];
    const plot = draw(el, showMetros ? `Map of US metro areas sized by PA jobs and colored by ${m.long.toLowerCase()}.` : `Map of US states colored by ${m.long.toLowerCase()}.`, {
      width, height: Math.round(width * 0.62), margin: 0,
      projection: { type: "albers-usa", domain: { type: "FeatureCollection", features: shapes } },
      r: { range: [1.5, Math.max(8, width / 40)] },
      marks,
    });
    plot.style.cursor = showMetros ? "default" : "pointer";
    if (!showMetros) plot.addEventListener("click", () => { if (plot.value) selected = byFips.get(plot.value.id).abbr; });
  });

  const legend = $derived([null, ...breaks].map((b, i) => ({ text: i === 0 ? "below " + m.fmt(breaks[0]) : m.fmt(b) + "+", color: `--pa-r${i}` })));
</script>

{#if withMetros}
  <div class="pa-toggle" role="group" aria-label="Show">
    <button class="btn" class:primary={view === "states"} aria-pressed={view === "states"} onclick={() => (view = "states")}>States</button>
    <button class="btn" class:primary={view === "metros"} aria-pressed={view === "metros"} onclick={() => (view = "metros")}>Metro areas</button>
  </div>
{/if}
<div class="pa-toggle" role="group" aria-label="Color the map by">
  {#each measures as key}
    <button class="btn" class:primary={measure === key} aria-pressed={measure === key} onclick={() => (measure = key)}>{FIELDS[key].name}</button>
  {/each}
</div>
<p class="pa-hint">{m.hint + (showMetros ? " Bigger circles have more PA jobs." : "")}</p>
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
      {#each details as key}
        {@const x = FIELDS[key]}
        <dt>{x.long}</dt><dd>{x.fmt(sel[key]) + (x.norank ? "" : ` (#${rank(sel, key)} of ${states.length})`)}</dd>
      {/each}
    </dl>
  </div>
{/if}
