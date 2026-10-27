<!-- Body weight: weigh-ins and their 7-day average -->
<script>
  import { fmtDate } from "./fit.js";
  import TimeChart from "./TimeChart.svelte";
  import TableView from "./TableView.svelte";

  let { D, E, today } = $props();

  const trend = $derived(E.weightTrend(D.bodyweight || {}, today));
  const points = $derived(trend.points), latest = $derived(trend.latest);
  const signed = (v) => (v === null ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)} lb`);
  const vals = $derived(points.flatMap((p) => [p.weight, p.trend]));
  let width = $state(0);
</script>

<div id="fit-weight-chart" class="fit-chart" bind:clientWidth={width}>
  {#if !latest}
    <p class="empty">Tell your daily session your weight to start the graph.</p>
  {:else}
    <div class="fit-weight-stats">
      <span><b>{latest.weight} lb</b><span class="muted">{` on ${fmtDate(latest.date)}`}</span></span>
      <span><b>{signed(trend.change7)}</b><span class="muted">{" past 7 days"}</span></span>
      <span><b>{signed(trend.change30)}</b><span class="muted">{" past 30 days"}</span></span>
    </div>
    {#if points.length < 2}
      <p class="empty">The graph starts with your second weigh-in.</p>
    {:else}
      <TimeChart {width} height={240} {points} label="Body weight over time: weigh-ins and 7-day average"
        domain={[Math.min(...vals) - 1, Math.max(...vals) + 1]} last={{ date: latest.date, value: latest.trend }}
        tip={(p) => [fmtDate(p.date, { month: "short", day: "numeric", year: "numeric" }), [`Weigh-in ${p.weight} lb`, `7-day average ${p.trend} lb`]]}>
        {#snippet marks(X, Y)}
          {#each points as p}<circle cx={X(p.date)} cy={Y(p.weight)} r="3" fill="var(--bg)" stroke="var(--muted)" stroke-width="1.5" />{/each}
          <polyline points={points.map((p) => `${X(p.date)},${Y(p.trend)}`).join(" ")} fill="none" stroke="var(--s1)" stroke-width="2.5" stroke-linejoin="round" />
        {/snippet}
      </TimeChart>
      <ul class="fit-legend">
        <li><span class="fit-swatch" style="--c:var(--s1)"></span>7-day average</li>
        <li><span class="fit-swatch skip"></span>Weigh-in</li>
      </ul>
    {/if}
    <TableView head={["Date", "Weigh-in (lb)", "7-day average (lb)"]} rows={[...points].reverse().map((p) => [p.date, String(p.weight), String(p.trend)])} />
  {/if}
</div>
