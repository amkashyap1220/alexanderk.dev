<!-- Strength: estimated 1-rep max over time, one lift at a time -->
<script>
  import { fmtDate, nameOf } from "./fit.js";
  import TimeChart from "./TimeChart.svelte";
  import TableView from "./TableView.svelte";

  let { D, A } = $props();

  // Lifts with the most sessions first
  const ids = $derived(Object.keys(A.strength).sort((a, b) => A.strength[b].length - A.strength[a].length));
  let picked = $state(null);
  const id = $derived(ids.includes(picked) ? picked : ids[0]);
  const pts = $derived(A.strength[id]);
  let width = $state(0);
</script>

{#if ids.length}
  <label class="fit-label" for="fit-lift">Lift</label>
  <select id="fit-lift" class="fit-input" value={id} onchange={(e) => (picked = e.currentTarget.value)}>
    {#each ids as i}<option value={i}>{nameOf(D, i)} ({A.strength[i].length})</option>{/each}
  </select>
{/if}
<div id="fit-strength" class="fit-chart" bind:clientWidth={width}>
  {#if !ids.length}
    <p class="empty">Log a few sessions to see your strength over time.</p>
  {:else}
    {@const vals = pts.map((p) => p.e1rm)}
    <TimeChart {width} height={260} points={pts} label="{nameOf(D, id)}: estimated 1-rep max over time"
      domain={[Math.min(...vals) * 0.95, Math.max(...vals) * 1.03]} last={{ date: pts.at(-1).date, value: pts.at(-1).e1rm }}
      tip={(p) => [fmtDate(p.date, { month: "short", day: "numeric", year: "numeric" }), [`Est. 1RM ${p.e1rm} lb${p.pr ? " (new best)" : ""}`, `Best set ${p.weight} × ${p.reps}`]]}>
      {#snippet marks(X, Y)}
        <polyline points={pts.map((p) => `${X(p.date)},${Y(p.e1rm)}`).join(" ")} fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" />
        {#each pts as p}<circle cx={X(p.date)} cy={Y(p.e1rm)} r={p.pr ? 5 : 3} fill={p.pr ? "var(--s1)" : "var(--bg)"} stroke="var(--s1)" stroke-width="2" />{/each}
      {/snippet}
    </TimeChart>
    <TableView head={["Date", "Best set", "Est. 1RM (lb)"]} rows={[...pts].reverse().map((p) => [p.date, `${p.weight} × ${p.reps}${p.pr ? " (best)" : ""}`, String(p.e1rm)])} />
  {/if}
</div>
