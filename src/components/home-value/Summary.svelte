<!-- The line above the map, and what drives the score: each factor's share of the weight,
     factors that move together, and what the last change did -->
<script>
  import { listJoin, relatedPairs, summarize, weightParts, who } from "./hv.js";

  // first: the sample's results, worked out when the site is built, shown until the data
  // loads so the page doesn't jump when it does
  let { data, failed, mode, view, ps, scored, factors, first } = $props();

  const result = $derived(scored?.result);
  const early = $derived(!scored && !failed ? first : null);
  const summary = $derived(result ? summarize(data, result, scored.cur, mode, view, ps) : early?.summary);

  // Whose weights to show: everyone for "best for both", otherwise the person in view
  const shown = $derived(result
    ? ps.map((p, k) => ({ parts: weightParts(p), k })).filter(({ k }) => view === 2 || k === Math.min(view, ps.length - 1))
    : early ? [{ parts: early.parts, k: 0 }] : []);
  const pairs = $derived(result ? relatedPairs(data, ps[Math.min(view === 2 ? 0 : view, ps.length - 1)], factors) : early?.pairs ?? []);
  const multi = $derived(result ? ps.length > 1 : false);
</script>

<p class="hv-summary" id="hv-summary" aria-live="polite">
  {#if failed === "blocked"}
    <b>The map could not load</b> (its scripts were blocked or failed to download). The data is in the GitHub repo linked above.
  {:else if failed}
    <b>The map could not load.</b> Check your connection and <a href="">reload the page</a>. The data is also in the GitHub repo linked above.
  {:else if !scored && !early}
    Loading the map…
  {:else if scored?.wait}
    {scored.wait}
  {:else if scored?.gaps.length}
    <b>Not scored yet.</b>{" " + scored.gaps.join(" ") + " Set a weight to Ignore to skip it."}
  {:else if !summary.rows}
    <b>No zip has enough data to rank.</b> Lower the weight of a factor with gaps (usually safety) and try again.
  {:else}
    <b>{summary.head}.</b>{summary.text}
  {/if}
</p>
<div class="hv-drivers" id="hv-drivers">
  {#if result || early}
    {#each shown as { parts, k }}
      <p><b>{multi ? who(k) + ": w" : "W"}hat your score is made of</b> (share of your weights):{#each parts as part}{" "}<span class="hv-share"><span class="hv-share-bar" style="width:{part.bar}px"></span>{factors[part.i].name} {part.share}%</span>{/each}</p>
    {/each}
    {#if pairs.length}
      <p class="hv-note hv-related">Related factors: {listJoin(pairs)} go together across zips, so weighting both counts much the same thing twice. Consider weighting just one.</p>
    {/if}
    {#if scored?.note}<p class="hv-note"><b>Your last change</b>{scored.note}</p>{/if}
  {/if}
</div>
