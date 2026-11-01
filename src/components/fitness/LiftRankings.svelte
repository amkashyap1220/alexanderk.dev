<!--
  My lifts: rank the lifts in each slot, or mark one "never". The draft is
  only saved (through the Worker into fitness-data) when you press Save.
-->
<script>
  import { untrack } from "svelte";
  import { dayName, nameOf, post } from "./fit.js";
  import LiftLink from "./LiftLink.svelte";

  let { D, onsave } = $props();

  // Slots nobody has ranked count as empty, so viewing a day doesn't look like an edit
  const saved = () => ({ rankings: D.preferences.rankings || {}, never: D.preferences.never || [] });
  const tidy = ({ rankings, never }) => JSON.stringify({ rankings: Object.fromEntries(Object.entries(rankings).filter(([, ids]) => ids.length)), never });
  let draft = $state(untrack(() => structuredClone(saved())));
  const dirty = $derived(tidy(draft) !== tidy(saved()));

  let day = $state("push");
  let status = $state(""), saving = $state(false);

  const p = $derived(D.program.days[day]);
  const slots = $derived([...new Set([...p.core, ...p.flex])]);
  const never = $derived(new Set(draft.never));

  function edit(fn) {
    fn();
    status = dirty ? "Unsaved changes" : "";
  }
  const ranked = (slot) => draft.rankings[slot] || [];
  const rank = (slot, id) => edit(() => { draft.rankings[slot] = [...ranked(slot), id]; });
  const unrank = (slot, i) => edit(() => { draft.rankings[slot].splice(i, 1); });
  const move = (slot, i, by) => edit(() => { const r = draft.rankings[slot]; const [x] = r.splice(i, 1); r.splice(i + by, 0, x); });

  async function save() {
    saving = true;
    status = "Saving…";
    try {
      const out = await post("preferences", JSON.parse(tidy(draft)));
      onsave(out.preferences);
      draft = structuredClone(saved());
      status = "Saved. Up next is updated.";
    } catch (err) {
      status = "Not saved: " + err.message;
    }
    saving = false;
  }
</script>

<svelte:window onbeforeunload={(e) => { if (dirty) e.preventDefault(); }} />

<div class="toggle" id="fit-days" role="group" aria-label="Day">
  {#each D.program.rotation as d}
    <button class="btn small" type="button" aria-pressed={String(d === day)} onclick={() => (day = d)}>{dayName(D, d)}</button>
  {/each}
</div>
<div id="fit-slots" class="grid two">
  {#each slots as slot}
    {@const lifts = D.exercises.exercises.filter((e) => e.slot === slot)}
    <article class="card fit-slot">
      <h3>{D.program.slots[slot].name + (p.flex.includes(slot) && !p.core.includes(slot) ? " (fifth lift)" : "")}</h3>
      <p class="sub">Your ranking</p>
      {#if ranked(slot).length}
        <ol>
          {#each ranked(slot) as id, i (id)}
            <li>
              <span class="rank">#{i + 1}</span><span class="name"><LiftLink name={nameOf(D, id)} /></span>
              {#if i > 0}<button class="btn small" type="button" aria-label="Move {nameOf(D, id)} up" onclick={() => move(slot, i, -1)}>↑</button>{/if}
              {#if i < ranked(slot).length - 1}<button class="btn small" type="button" aria-label="Move {nameOf(D, id)} down" onclick={() => move(slot, i, 1)}>↓</button>{/if}
              <button class="btn small" type="button" aria-label="Unrank {nameOf(D, id)}" onclick={() => unrank(slot, i)}>✕</button>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="fit-why">Nothing ranked: picks follow what you log.</p>
      {/if}
      <p class="sub">Other lifts</p>
      <ul>
        {#each lifts.filter((e) => !ranked(slot).includes(e.id)) as e (e.id)}
          <li class={never.has(e.id) ? "never" : ""}>
            <span class="name"><LiftLink name={e.name} /></span>
            {#if never.has(e.id)}
              <button class="btn small" type="button" aria-label="Allow {e.name} again" onclick={() => edit(() => { draft.never = draft.never.filter((x) => x !== e.id); })}>Allow</button>
            {:else}
              <button class="btn small" type="button" aria-label="Rank {e.name}" onclick={() => rank(slot, e.id)}>Rank</button>
              <button class="btn small" type="button" aria-label="Never suggest {e.name}" onclick={() => edit(() => { draft.never.push(e.id); })}>Never</button>
            {/if}
          </li>
        {/each}
      </ul>
    </article>
  {/each}
</div>
<div class="fit-save">
  <button class="btn primary" type="button" id="fit-save" disabled={saving || !dirty} onclick={save}>Save rankings</button>
  <span class="muted" id="fit-save-status" role="status">{status}</span>
</div>
