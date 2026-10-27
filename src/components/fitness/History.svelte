<!-- Previous workouts, newest first, 15 at a time -->
<script>
  import { DAY_COLOR, fmtDate, nameOf, dayName, liftsOf, cardioOf, setsText } from "./fit.js";
  import LiftLink from "./LiftLink.svelte";

  let { D, E, A } = $props();

  let limit = $state(15);
  const list = $derived(E.sessions(D.workouts).reverse());
  // "date|lift" for every session that set a new best (the first session of a lift doesn't count)
  const prs = $derived(new Set(Object.entries(A.strength).flatMap(([id, pts]) => pts.filter((p, i) => p.pr && i > 0).map((p) => `${p.date}|${id}`))));

  const label = (s) => ({ completed: dayName(D, s.day), skipped: `Skipped ${dayName(D, s.day)}`, rest: "Rest", in_progress: `${dayName(D, s.day)} (in progress)` })[s.status] || s.status;
  function totals(s) {
    const minutes = s.started && s.finished ? Math.round((Date.parse(s.finished) - Date.parse(s.started)) / 60000) : null;
    return [liftsOf(s).length ? `${liftsOf(s).length} lifts` : "", cardioOf(s).length ? `${cardioOf(s).reduce((t, c) => t + c.minutes, 0)} min cardio` : "", minutes ? `${minutes} min total` : ""].filter(Boolean).join(" · ");
  }
</script>

<div id="fit-history">
  {#each list.slice(0, limit) as s}
    <details class="fit-session">
      <summary>
        <span>{fmtDate(s.date, { weekday: "short", month: "short", day: "numeric" })}</span>
        <span>{#if s.day && s.status !== "rest"}<span class="fit-day" style="--c:{DAY_COLOR[s.day]}"></span>{/if}{label(s)}</span>
        <span class="muted">{totals(s)}</span>
      </summary>
      <ul>
        {#each liftsOf(s) as l}
          <li><LiftLink name={nameOf(D, l.exercise)} />: {setsText(l.sets)}{#if prs.has(`${s.date}|${l.exercise}`)}<span class="pr">{"  new best"}</span>{/if}</li>
        {/each}
        {#each cardioOf(s) as c}<li>{c.machine}: {c.minutes} min{c.notes ? ` (${c.notes})` : ""}</li>{/each}
        {#if s.notes}<li>Notes: {s.notes}</li>{/if}
        {#if !liftsOf(s).length && !cardioOf(s).length && !s.notes}<li>Nothing logged.</li>{/if}
      </ul>
    </details>
  {:else}
    <p class="empty">No workouts yet. Your daily session logs them here.</p>
  {/each}
  {#if list.length > limit}
    <button class="btn small fit-more" type="button" onclick={() => (limit += 30)}>Show {Math.min(30, list.length - limit)} more</button>
  {/if}
</div>
