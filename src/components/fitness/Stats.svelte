<!-- The four numbers under Up next -->
<script>
  import { cardioOf } from "./fit.js";

  let { D, E, A, today } = $props();

  const tiles = $derived.by(() => {
    const list = E.sessions(D.workouts);
    const done = list.filter((s) => s.status === "completed");
    const week = E.weekStart(today);
    const cardio = list.filter((s) => s.date >= week).flatMap(cardioOf).reduce((t, c) => t + (c.minutes || 0), 0);
    return [
      [String(done.filter((s) => E.daysBetween(s.date, today) < 30).length), "workouts, last 30 days"],
      [String(done.filter((s) => s.date >= week).length), "workouts this week"],
      [`${cardio}`, "cardio minutes this week"],
      [A.adherence === null ? "–" : `${A.adherence}%`, "of planned lifts done"],
    ];
  });
</script>

<dl class="stat-grid fit-stats" id="fit-stats">
  {#each tiles as [value, label]}
    <div class="card stat"><dt class="stat-label">{label}</dt><dd class="stat-value">{value}</dd></div>
  {/each}
</dl>
