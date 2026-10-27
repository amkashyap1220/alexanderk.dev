<!-- Up next: today's plan from the engine, or what's logged so far if today is in progress -->
<script>
  import { DAY_COLOR, liftsOf, setsText } from "./fit.js";
  import LiftLink from "./LiftLink.svelte";

  let { D, E, today } = $props();

  const plan = $derived(E.computePlan({ ...D, date: today }));
  const entry = $derived(D.workouts[today]);
  const inProgress = $derived(entry && entry.status === "in_progress");
  const logged = (id) => inProgress && liftsOf(entry).find((l) => l.exercise === id);
  const weight = (l) => (l.weight === null ? "pick a weight" : l.weight === 0 ? "bodyweight" : `${l.weight} lb`);
</script>

<div id="fit-next" class="card fit-next">
  <div class="fit-next-head">
    <span class="fit-next-title"><span class="fit-day" style="--c:{DAY_COLOR[plan.day]}"></span>{plan.dayName} day #{plan.number}</span>
    <span class="muted">{inProgress ? "In progress today" : entry && entry.status === "completed" ? "Next session" : "Today"}</span>
  </div>
  <ol>
    <li class="cardio">
      <div class="fit-lift"><span><b>{plan.cardio.minutes} min cardio</b> on the {plan.cardio.machine}</span></div>
      <div class="fit-why">Or any of treadmill, bike, elliptical. Suggested: {plan.cardio.why}.</div>
    </li>
    {#each plan.lifts as l}
      {@const done = logged(l.exercise)}
      <li>
        <div class="fit-lift"><b><LiftLink name={l.name} /></b><span>{l.sets} × {l.reps[0]}–{l.reps[1]} @ {weight(l)}</span></div>
        <div class="fit-why">{done ? `Logged today: ${setsText(done.sets)}` : `${l.note}. ${l.flex ? "Fifth lift" : l.slotName}: ${l.why}.`}</div>
      </li>
    {/each}
  </ol>
  {#each plan.notes as n}<p class="fit-notes">{n}</p>{/each}
</div>
