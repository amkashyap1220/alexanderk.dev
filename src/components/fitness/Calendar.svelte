<!-- Consistency: one square per day, last 16 weeks -->
<script>
  import { DAY_COLOR, fmtDate, dayName } from "./fit.js";

  let { D, E, A, today } = $props();

  const weeks = 16, cell = 14, gap = 3, L = 30, T = 18;
  const W = L + weeks * (cell + gap), H = T + 7 * (cell + gap);
  const start = $derived(E.addDays(E.weekStart(today), -7 * (weeks - 1)));
  const byDate = $derived(Object.fromEntries(A.days.map((d) => [d.date, d])));

  // Each week: its Monday, its month label (on the first week and when the month changes), and its days so far
  const columns = $derived(Array.from({ length: weeks }, (_, w) => {
    const monday = E.addDays(start, 7 * w);
    const month = w === 0 || monday.slice(5, 7) !== E.addDays(monday, -7).slice(5, 7) ? fmtDate(monday, { month: "short" }) : null;
    const days = Array.from({ length: 7 }, (_, i) => E.addDays(monday, i)).map((date, i) => ({ date, i, s: byDate[date] })).filter((d) => d.date <= today);
    return { x: L + w * (cell + gap), month, days };
  }));

  const tipText = (date, s) => `${fmtDate(date, { weekday: "short", month: "short", day: "numeric" })}\n${s ? (s.status === "completed" ? `${dayName(D, s.day)} done` : s.status === "skipped" ? `Skipped ${dayName(D, s.day)}` : s.status === "rest" ? "Rest day" : `${dayName(D, s.day)} in progress`) : "Nothing logged"}`;
</script>

<div id="fit-calendar" class="fit-chart">
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Workouts, skips and rest days over the last 16 weeks" style="max-width:{Math.round(W * 1.6)}px">
    {#each ["Mon", "Wed", "Fri"] as d, i}
      <text x="0" y={T + i * 2 * (cell + gap) + cell - 3} font-size="9" fill="var(--muted)">{d}</text>
    {/each}
    {#each columns as { x, month, days }}
      {#if month}<text {x} y="10" font-size="9" fill="var(--muted)">{month}</text>{/if}
      {#each days as { date, i, s }}
        {@const y = T + i * (cell + gap)}
        {@const tip = tipText(date, s)}
        {#if s && (s.status === "completed" || s.status === "in_progress")}
          <rect {x} {y} width={cell} height={cell} rx="3" data-tip={tip} fill={DAY_COLOR[s.day] || "var(--muted)"} fill-opacity={s.status === "in_progress" ? 0.5 : 1} />
        {:else if s && s.status === "skipped"}
          <g data-tip={tip}>
            <rect {x} {y} width={cell} height={cell} rx="3" data-tip={tip} fill="none" stroke="var(--muted)" />
            <path d="M{x + 4} {y + 4}L{x + cell - 4} {y + cell - 4}" stroke="var(--muted)" />
          </g>
        {:else if s && s.status === "rest"}
          <rect {x} {y} width={cell} height={cell} rx="3" data-tip={tip} fill="var(--border)" />
        {:else}
          <rect {x} {y} width={cell} height={cell} rx="3" data-tip={tip} fill="var(--soft)" stroke="var(--border)" stroke-width="0.5" />
        {/if}
      {/each}
    {/each}
  </svg>
  <ul class="fit-legend">
    {#each Object.keys(DAY_COLOR) as d}<li><span class="fit-swatch" style="--c:{DAY_COLOR[d]}"></span>{dayName(D, d)}</li>{/each}
    <li><span class="fit-swatch skip"></span>Skipped</li>
    <li><span class="fit-swatch rest"></span>Rest</li>
  </ul>
</div>
