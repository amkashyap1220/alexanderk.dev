<!-- Weak areas: low-volume muscles, stalled lifts and push vs pull balance -->
<script>
  import { liftsOf } from "./fit.js";

  let { D, E, A } = $props();

  const logged = $derived(E.sessions(D.workouts).some((s) => liftsOf(s).length));
  const KIND = { volume: "Low volume", stall: "Stalled", imbalance: "Imbalance" };
  const level = (w) => (w.kind === "volume" && A.volume.find((v) => v.muscle === w.muscle).status === "low" ? "bad" : "warn");
</script>

<div id="fit-weak" class="grid two">
  {#if !logged}
    <p class="empty">Shows up after a couple of weeks of logged workouts.</p>
  {:else}
    {#each A.weakAreas.slice(0, 8) as w}
      <article class="card fit-weak">
        <p class="card-label {level(w)}">{KIND[w.kind]}</p>
        <h3 class="card-title">{w.label}</h3>
        <p class="card-text">{w.detail}</p>
      </article>
    {:else}
      <p class="empty">No weak spots right now: every muscle is in its target and every lift is still moving.</p>
    {/each}
  {/if}
</div>
