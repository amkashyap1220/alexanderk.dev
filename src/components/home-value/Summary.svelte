<!-- The line above the map, and what drives the score: each factor's share of the weight,
     factors that move together, and what the last change did -->
<script>
  import { ORDER, listJoin, name, who } from "./hv.js";

  let { data, failed, mode, view, ps, scored, factors } = $props();

  const result = $derived(scored?.result);
  const summary = $derived.by(() => {
    if (!result) return null;
    const { picks, score, ranked } = scored.cur;
    const rows = result.rows.filter((r) => picks.has(r.zip)).sort((a, b) => score(b) - score(a));
    if (!rows.length) return { rows };
    const what = mode === "buy" ? "to buy" : "to rent";
    const unranked = result.rows.filter((r) => !ranked(r)).length;
    const head = view === 2 && ps.length > 1 ? "Best " + picks.size + " " + what + " for both of you" : (view === 1 ? "Person 2's" : "Your") + " top " + picks.size + " " + what;
    const best = rows[0];
    let text = " Best fit: " + name(best) + " (" + Math.round(score(best)) + " of 100). " + result.rows.length + " zips scored";
    text += unranked ? "; " + unranked + " not ranked because data is missing for a factor carrying over " + Math.round((1 - data.min_coverage) * 100) + "% of the weight." : ".";
    if (mode === "buy") {
      const vs = rows.map((r) => r.value).filter(Boolean);
      const below = vs.filter((v) => v.cls === "below").length, above = vs.filter((v) => v.cls === "above").length;
      text += " Of the top " + rows.length + ", " + below + " sell below the price their measured features predict and " + above + " above it.";
    }
    return { rows, head, text };
  });

  // Whose weights to show: everyone for "best for both", otherwise the person in view
  const shown = $derived(ps.map((p, k) => ({ p, k })).filter(({ k }) => view === 2 || k === Math.min(view, ps.length - 1)));
  const parts = (p) => {
    const total = p.weights.reduce((s, w) => s + w, 0);
    return ORDER.filter((i) => p.weights[i] > 0).sort((a, b) => p.weights[b] - p.weights[a])
      .map((i) => ({ i, bar: Math.round((p.weights[i] / total) * 60), share: Math.round((p.weights[i] / total) * 100) }));
  };
  // Strongly related pairs among the factors one person weights (Spearman correlation across zips, |rho| >= 0.6)
  const pairs = $derived.by(() => {
    if (!result) return [];
    const corr = data.factor_correlation;
    const p = ps[Math.min(view === 2 ? 0 : view, ps.length - 1)];
    const out = [];
    for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) {
      // Price is left out: it's a cost, not a feature, and it's meant to go with quality
      if (a === 5 || b === 5 || (p.workplace && (a === 2 || b === 2))) continue;
      if (p.weights[a] > 0 && p.weights[b] > 0 && Math.abs(corr.spearman[a][b]) >= 0.6)
        out.push(factors[a].name.toLowerCase() + " and " + factors[b].name.toLowerCase() + " (ρ = " + corr.spearman[a][b].toFixed(2).replace("-", "−") + ")");
    }
    return out;
  });
</script>

<p class="hv-summary" id="hv-summary" aria-live="polite">
  {#if failed === "blocked"}
    <b>The map could not load</b> (its scripts were blocked or failed to download). The data is in the GitHub repo linked above.
  {:else if failed}
    <b>The map could not load.</b> Check your connection and <a href="">reload the page</a>. The data is also in the GitHub repo linked above.
  {:else if !scored}
    Loading the map…
  {:else if scored.gaps.length}
    <b>Not scored yet.</b>{" " + scored.gaps.join(" ") + " Set a weight to Ignore to skip it."}
  {:else if !summary.rows.length}
    <b>No zip has enough data to rank.</b> Lower the weight of a factor with gaps (usually safety) and try again.
  {:else}
    <b>{summary.head}.</b>{summary.text}
  {/if}
</p>
<div class="hv-drivers" id="hv-drivers">
  {#if result}
    {#each shown as { p, k }}
      <p><b>{ps.length > 1 ? who(k) + ": w" : "W"}hat your score is made of</b> (share of your weights):{#each parts(p) as part}{" "}<span class="hv-share"><span class="hv-share-bar" style="width:{part.bar}px"></span>{factors[part.i].name} {part.share}%</span>{/each}</p>
    {/each}
    {#if pairs.length}
      <p class="hv-note hv-related">Related factors: {listJoin(pairs)} go together across zips, so weighting both counts much the same thing twice. Consider weighting just one.</p>
    {/if}
    {#if scored.note}<p class="hv-note"><b>Your last change</b>{scored.note}</p>{/if}
  {/if}
</div>
