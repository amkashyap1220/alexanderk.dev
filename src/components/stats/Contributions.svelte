<!--
  Stats page: a year of GitHub contributions as a heat map, like the one on
  my GitHub profile. One square per day, a column per week (Sunday on top),
  darker green for busier days.

  The data is GitHub's own contribution calendar (commits, pull requests,
  issues and reviews), saved into /data/github.json by worker/index.js and
  read through js/gh.js like the rest of the page: { total, commits, from,
  to, days: { "2026-03-04": 5 } }, with only the busy days listed.
-->
<script>
  import { onMount } from "svelte";

  const USER = "amkashyap1220";
  const cell = 11, gap = 3, L = 30, T = 16;
  const LEVELS = [0.3, 0.55, 0.8, 1];   // fill-opacity of --mark for the four busy levels

  let data = $state(null);
  let failed = $state(false);
  let scroller = $state();

  onMount(() => {
    window.GH.get("contributions", USER).then((d) => { data = d; }, () => { failed = true; });
  });

  // Dates stay "YYYY-MM-DD" strings, done in UTC so time zones never shift a day
  const toDate = (s) => new Date(s + "T00:00:00Z");
  const addDays = (s, n) => new Date(toDate(s).getTime() + n * 86400000).toISOString().slice(0, 10);
  const fmt = (s, opts) => toDate(s).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

  const all = $derived.by(() => {
    if (!data) return [];
    const list = [];
    for (let d = data.from; d <= data.to; d = addDays(d, 1)) list.push({ date: d, count: data.days[d] || 0 });
    return list;
  });

  // Busy days split into four levels at the quartiles, as GitHub does
  const cuts = $derived.by(() => {
    const counts = all.map((d) => d.count).filter(Boolean).sort((a, b) => a - b);
    return [0.25, 0.5, 0.75].map((q) => counts[Math.floor(q * (counts.length - 1))] || 0);
  });
  const level = (count) => (count <= cuts[0] ? 0 : count <= cuts[1] ? 1 : count <= cuts[2] ? 2 : 3);

  // Each week: its x, its month label (when the month changes), and its days
  const columns = $derived.by(() => {
    if (!all.length) return [];
    const offset = toDate(data.from).getUTCDay();   // the first week can start mid-week
    const cols = [];
    all.forEach((d, i) => {
      const w = Math.floor((i + offset) / 7);
      if (!cols[w]) cols[w] = { x: L + w * (cell + gap), month: null, days: [] };
      cols[w].days.push({ ...d, y: T + ((i + offset) % 7) * (cell + gap) });
      if (d.date.slice(8) === "01" || i === 0) cols[w].month = fmt(d.date, { month: "short" });
    });
    // No label on a first partial week whose month is relabelled right after
    if (cols.length > 1 && cols[0].days.length < 7 && cols[1].month) cols[0].month = null;
    return cols;
  });
  const W = $derived(L + columns.length * (cell + gap));
  const H = T + 7 * (cell + gap);

  // The numbers under the map
  const summary = $derived.by(() => {
    if (!all.length) return null;
    let longest = 0, run = 0;
    all.forEach((d) => { run = d.count ? run + 1 : 0; longest = Math.max(longest, run); });
    // Current streak: today may not have anything yet, so it can end yesterday
    let current = 0;
    for (let i = all.length - 1 - (all[all.length - 1].count ? 0 : 1); i >= 0 && all[i].count; i--) current++;
    const busiest = all.reduce((a, b) => (b.count > a.count ? b : a));
    return { active: all.filter((d) => d.count).length, longest, current, busiest };
  });

  const plural = (n, word) => n.toLocaleString() + " " + word + (n === 1 ? "" : "s");
  const tip = (d) => (d.count ? plural(d.count, "contribution") : "No contributions") + " on " + fmt(d.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  // Start scrolled to the latest weeks when the map is wider than the screen
  $effect(() => { if (scroller && columns.length) scroller.scrollLeft = scroller.scrollWidth; });
</script>

{#if failed}
  <p class="muted">Couldn't load contributions from GitHub right now.</p>
{:else if !data}
  <p class="muted">Loading…</p>
{:else}
  <div class="heatmap card" bind:this={scroller}>
    <svg viewBox="0 0 {W} {H}" role="img"
      aria-label="{plural(data.total, 'contribution')} on GitHub from {fmt(data.from, { month: 'long', day: 'numeric', year: 'numeric' })} to {fmt(data.to, { month: 'long', day: 'numeric', year: 'numeric' })}, one square per day">
      {#each ["Mon", "Wed", "Fri"] as d, i}
        <text x="0" y={T + (i * 2 + 1) * (cell + gap) + cell - 2} font-size="9" fill="var(--muted)">{d}</text>
      {/each}
      {#each columns as { x, month, days }}
        {#if month}<text {x} y="10" font-size="9" fill="var(--muted)">{month}</text>{/if}
        {#each days as d}
          {#if d.count}
            <rect {x} y={d.y} width={cell} height={cell} rx="2" fill="var(--mark)" fill-opacity={LEVELS[level(d.count)]}><title>{tip(d)}</title></rect>
          {:else}
            <rect {x} y={d.y} width={cell} height={cell} rx="2" fill="var(--soft)" stroke="var(--border)" stroke-width="0.5"><title>{tip(d)}</title></rect>
          {/if}
        {/each}
      {/each}
    </svg>
  </div>
  <div class="heatmap-foot">
    <p class="muted">{plural(data.total, "contribution")} in the last year, {plural(data.commits, "commit")} of them.</p>
    <p class="heatmap-legend muted" aria-hidden="true">
      Less
      <span class="heatmap-swatch none"></span>
      {#each LEVELS as o}<span class="heatmap-swatch" style="opacity:{o}"></span>{/each}
      More
    </p>
  </div>
  {#if summary}
    <p class="muted">
      Active on {plural(summary.active, "day")}. Longest streak: {plural(summary.longest, "day")}{summary.current ? `, current: ${plural(summary.current, "day")}` : ""}.
      Busiest day: {fmt(summary.busiest.date, { month: "short", day: "numeric", year: "numeric" })}, with {summary.busiest.count}.
    </p>
  {/if}
{/if}
