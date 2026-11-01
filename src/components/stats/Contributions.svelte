<!--
  Stats page: a year of GitHub contributions as a heat map. My own take on
  the one on my GitHub profile: a row per month and a column per day of the
  month, read like a page of a log book. Each day is a dot that grows and
  darkens with how much I did; the busiest day is marked in orange, and each
  row ends with that month's total. Built from HTML, not SVG, so the labels
  stay full size on a phone.

  The data is GitHub's own contribution calendar (commits, pull requests,
  issues and reviews), saved into /data/github.json by worker/index.js and
  read through js/gh.js like the rest of the page: { total, commits, from,
  to, days: { "2026-03-04": 5 } }, with only the busy days listed.
-->
<script>
  import { onMount } from "svelte";

  const USER = "amkashyap1220";
  const SIZES = [0.45, 0.65, 0.85, 1];      // dot size (share of the cell) for the four busy levels
  const SHADES = [0.45, 0.65, 0.85, 1];     // and its opacity of --mark
  const DAY_LABELS = [1, 5, 10, 15, 20, 25, 30];

  let data = $state(null);
  let failed = $state(false);

  onMount(() => {
    window.GH.get("contributions", USER).then((d) => { data = d; }, () => { failed = true; });
  });

  // Dates stay "YYYY-MM-DD" strings, done in UTC so time zones never shift a day
  const toDate = (s) => new Date(s + "T00:00:00Z");
  const fmt = (s, opts) => toDate(s).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
  const pad = (n) => String(n).padStart(2, "0");

  // The last 12 months, this one included: [{ key: "2026-10", name, days: [{ date, count, future }], total }]
  const months = $derived.by(() => {
    if (!data) return [];
    const [y, m] = data.to.split("-").map(Number);
    return Array.from({ length: 12 }, (_, i) => {
      const at = new Date(Date.UTC(y, m - 12 + i, 1));
      const key = at.getUTCFullYear() + "-" + pad(at.getUTCMonth() + 1);
      const length = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0)).getUTCDate();
      const days = Array.from({ length }, (_, d) => {
        const date = key + "-" + pad(d + 1);
        return { date, count: data.days[date] || 0, future: date > data.to };
      });
      const name = fmt(key + "-01", { month: "short" }) + (i === 0 || key.endsWith("-01") ? " ’" + key.slice(2, 4) : "");
      return { key, name, days, total: days.reduce((t, d) => t + d.count, 0) };
    });
  });
  const all = $derived(months.flatMap((mo) => mo.days).filter((d) => !d.future));

  // Busy days split into four levels at the quartiles
  const cuts = $derived.by(() => {
    const counts = all.map((d) => d.count).filter(Boolean).sort((a, b) => a - b);
    return [0.25, 0.5, 0.75].map((q) => counts[Math.floor(q * (counts.length - 1))] || 0);
  });
  const level = (count) => (count <= cuts[0] ? 0 : count <= cuts[1] ? 1 : count <= cuts[2] ? 2 : 3);

  // The numbers under the map
  const summary = $derived.by(() => {
    if (!all.length) return null;
    let longest = 0, run = 0;
    all.forEach((d) => { run = d.count ? run + 1 : 0; longest = Math.max(longest, run); });
    // Current streak: today may not have anything yet, so it can end yesterday
    let current = 0;
    for (let i = all.length - 1 - (all[all.length - 1].count ? 0 : 1); i >= 0 && all[i].count; i--) current++;
    const busiest = all.reduce((a, b) => (b.count > a.count ? b : a));
    return { total: all.reduce((t, d) => t + d.count, 0), active: all.filter((d) => d.count).length, longest, current, busiest };
  });
  const busiestMonth = $derived(months.reduce((a, b) => (b.total > a.total ? b : a), months[0] || { total: 0 }));

  const plural = (n, word) => n.toLocaleString() + " " + word + (n === 1 ? "" : "s");
  const tip = (d) => (d.count ? plural(d.count, "contribution") : "Nothing") + " on " + fmt(d.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
</script>

{#if failed}
  <p class="muted">Couldn't load contributions from GitHub right now.</p>
{:else if !data}
  <p class="muted">Loading…</p>
{:else if summary}
  <p class="heatmap-headline">
    <b>{summary.total.toLocaleString()}</b> contributions in the last 12 months
    <span class="muted">· {plural(data.commits, "commit")} in the last year</span>
  </p>
  <div class="heatmap card" role="img"
    aria-label="{plural(summary.total, 'contribution')} over the last 12 months, by month. Busiest month: {fmt(busiestMonth.key + '-01', { month: 'long', year: 'numeric' })}, with {busiestMonth.total}.">
    <div class="heatmap-row heatmap-head" aria-hidden="true">
      <span></span>
      {#each { length: 31 } as _, i}<span class="heatmap-day">{DAY_LABELS.includes(i + 1) ? i + 1 : ""}</span>{/each}
      <span class="heatmap-total">sum</span>
    </div>
    {#each months as mo (mo.key)}
      <div class="heatmap-row" class:top={mo === busiestMonth && mo.total > 0} aria-hidden="true">
        <span class="heatmap-month">{mo.name}</span>
        {#each mo.days as d (d.date)}
          {#if d.future}
            <span class="heatmap-cell"></span>
          {:else if d.count}
            {@const l = level(d.count)}
            <span class="heatmap-cell" class:peak={d === summary.busiest} title={tip(d)}
              style="--size:{SIZES[l]};--shade:{SHADES[l]}"><i></i></span>
          {:else}
            <span class="heatmap-cell none" title={tip(d)}><i></i></span>
          {/if}
        {/each}
        {#each { length: 31 - mo.days.length } as _}<span></span>{/each}
        <span class="heatmap-total">{mo.total || "–"}</span>
      </div>
    {/each}
  </div>
  <div class="heatmap-foot">
    <p class="muted">
      Active on {plural(summary.active, "day")}. Longest streak: {plural(summary.longest, "day")}{summary.current ? `, current: ${plural(summary.current, "day")}` : ""}.
      Busiest day: {fmt(summary.busiest.date, { month: "short", day: "numeric", year: "numeric" })}, with {summary.busiest.count} <span class="heatmap-peak-key" aria-hidden="true"></span>.
      Busiest month (shaded): {fmt(busiestMonth.key + "-01", { month: "long" })}, with {busiestMonth.total}.
    </p>
    <p class="heatmap-legend muted" aria-hidden="true">
      less
      <span class="heatmap-cell none"><i></i></span>
      {#each SIZES as s, i}<span class="heatmap-cell" style="--size:{s};--shade:{SHADES[i]}"><i></i></span>{/each}
      more
    </p>
  </div>
{/if}
