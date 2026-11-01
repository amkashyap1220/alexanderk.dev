<!-- One person's targets and weights. Both people get the same form. -->
<script>
  import { ORDER, WEIGHTS, fmt } from "./hv.js";

  // workplace: the zip person.work names, null when empty, undefined when the map doesn't know it
  let { person = $bindable(), k, mode, data, factors, sample, workplace, placeName, hold, steady, fillSample, onremove } = $props();

  // "Typical zip" values, which change with buying or renting
  const typical = $derived.by(() => {
    const rows = data ? data.zips.filter((z) => z[mode]) : [];
    if (!rows.length) return [];
    return factors.map((f, i) => {
      const v = rows.map((z) => z[mode][i]).filter((x) => x != null).sort((a, b) => a - b);
      return "Typical zip: " + f.before + fmt(v[v.length >> 1], f.digits) + (f.after ? " " + f.after : "") + ".";
    });
  });

  // The note says "sample values" while every field still holds its sample value. Both
  // wordings sit in one grid cell, so the form doesn't jump when the note changes.
  const isSample = $derived(!!sample && person.work === sample.work &&
    sample.targets.every((t, i) => person.targets[i] === t) && sample.sliders.every((v, i) => person.sliders[i] === v));

  const workNote = $derived(!data ? "" : workplace ? "Drive time to " + placeName(workplace) + ", no traffic." : workplace === undefined ? "No match. Try a zip code." : "");

  let settle = null;

  function clear() {
    person.sliders = person.sliders.map(() => 2);
    person.targets = person.targets.map(() => "");
    person.work = "";
  }
</script>

<!-- Typing redraws what's above the form: note where the field was before the change
     (capture runs first) and scroll it back once the page has redrawn -->
<fieldset class="hv-person" oninputcapture={(e) => (settle = hold(e.target))} oninput={() => { settle?.(); settle = null; }}>
  <legend>{k === 0 ? "You" : "Person 2"}</legend>
  <p class="hv-intro">Type the value you want, then slide how much it matters. These are your preferences: they change the fit score, not the price estimate.</p>
  <p class="hv-sample" class:on={isSample} data-sample><span><b>Sample values.</b> Change them to yours.</span><span><b>Your values.</b> Edited from the sample.</span></p>
  {#each ORDER as i}
    {@const f = factors[i]}
    <div class="hv-factor">
      <label class="hv-line"><span class="hv-name" data-name={i}>{f.name}</span>
        <input type="range" name="w{i}" min="0" max="4" step="1" bind:value={person.sliders[i]} aria-label="How much {f.name.toLowerCase()} matters">
        <output>{WEIGHTS[person.sliders[i]].word}</output></label>
      <p class="hv-hint"><span data-hint={i}>{f.hint}</span> <span data-typical={i}>{typical[i] ?? ""}</span></p>
      <label class="hv-target"><span>Target: <span data-before={i}>{f.before}</span></span>
        <input type="text" inputmode="decimal" name="t{i}" bind:value={person.targets[i]} aria-label={f.name + " target" + (f.after ? ", " + f.after : ", dollars")} placeholder={i === 5 ? "e.g. " + f.example : ""}>
        <span data-after={i}>{f.after}</span></label>
      {#if i === 2}
        <label class="hv-target"><span>Where you work:</span>
          <input class="hv-work" type="text" name="work" list="hv-places" placeholder="town or zip" aria-label="Where you work, a town or zip code" bind:value={person.work}>
        </label><p class="hv-hint" data-work>{workNote}</p>
      {/if}
    </div>
  {/each}
  <div class="hv-buttons">
    <button class="btn small" type="button" data-fill onclick={(e) => steady(e.currentTarget, () => fillSample(person))}>Use sample values</button>
    <button class="btn small" type="button" data-clear onclick={(e) => steady(e.currentTarget, clear)}>Clear</button>
    {#if k === 1}<button class="btn small" type="button" data-remove onclick={onremove}>Remove person 2</button>{/if}
  </div>
</fieldset>
