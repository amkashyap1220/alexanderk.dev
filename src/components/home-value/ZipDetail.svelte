<!-- Detail panel for one zip: its fit, prices, price vs expected, and notes on the data -->
<script>
  import { CLASS, CONF, ISSUES, ORDER, factorText, gapText, listJoin, money, name, signed, who, zillow } from "./hv.js";

  let { failed, data, byZip, result, cur, rank, mode, view, ps, factors, selected, onclose } = $props();

  const z = $derived(selected && data ? byZip.get(selected) : null);
  const r = $derived(z && result ? result.rows.find((x) => x.zip === selected) : null);
  const blocks = $derived(r ? ps.map((p, k) => ({ p, k })).filter(({ k }) => view === 2 || k === cur.k) : []);

  // One sentence on why: the factors that cost the most points and the ones right on target
  function why(parts) {
    const idx = ORDER.filter((i) => parts[i].weight > 0 && parts[i].closeness != null);
    const costly = idx.filter((i) => parts[i].lost >= 1).sort((a, b) => parts[b].lost - parts[a].lost);
    const hits = idx.filter((i) => parts[i].closeness >= 99.5);
    const missingNames = ORDER.filter((i) => parts[i].missing).map((i) => factors[i].name.toLowerCase());
    let s = hits.length ? "On target for " + listJoin(hits.map((i) => factors[i].name.toLowerCase())) + ". " : "";
    s += costly.length ? "Loses the most on " + listJoin(costly.slice(0, 2).map((i) => factors[i].name.toLowerCase() + " (−" + parts[i].lost.toFixed(1) + ")")) + "." : "Close to every target.";
    if (missingNames.length) s += " Left out for missing data: " + listJoin(missingNames) + ".";
    return s;
  }

  const notes = $derived.by(() => {
    if (!z) return [];
    const out = [];
    if (z.crime) out.push("Crime: " + z.crime[0] + (z.crime[1] === "city" ? ", this zip's share of Chicago's FBI total, placed by the city's incident data." : ", the police agency's rate (FBI)."));
    else out.push("Crime: no usable FBI data for its police agency.");
    if (z.place === "Chicago") out.push("Schools: Chicago Public Schools is one district, so every city zip has the same school value.");
    if (z.station) out.push("Nearest station for most residents: " + z.station + ".");
    return out;
  });
</script>

{#snippet listing(zip, zipName)}<a href={zillow(mode, zip)} target="_blank" rel="noopener" aria-label="{zipName}, {mode === 'buy' ? 'homes for sale' : 'rentals'} on Zillow (new tab)">Zillow ↗</a>{/snippet}

<div class="hv-detail" id="hv-detail" aria-live="polite">
  {#if failed === "blocked"}
    <!-- Without the model there is nothing to pick: the summary says why -->
  {:else if !z}
    <p class="hv-empty">Pick a zip on the map, the chart or the table (or search for one above) to see why it scores what it does.</p>
  {:else}
    <div class="hv-detail-head"><h3 tabindex="-1">{name(z)} {z.zip}</h3><button class="btn small" type="button" data-close aria-label="Close details" onclick={onclose}>×</button></div>

    {#if !z[mode]}
      <p>Not in the {mode === "buy" ? "buyers' sample: fewer than 20 sales in the past year, no median price, or two missing factors." : "renters' sample: fewer than 100 rented homes, no rent, or two missing factors."}</p>
    {:else if !r}
      <p>Set your targets to see how this zip scores.</p>
    {:else}
      {#each blocks as { p, k }}
        {@const s = r.scores[k]}
        {@const parts = window.HVModel.explain(r.close[k], p.weights)}
        {@const rk = view === 2 ? null : rank.get(r.zip)}
        <section class="hv-block">
          <h4>{ps.length > 1 ? who(k) + ": fit" : "Fit to your targets"} <span class="hv-big">{s == null ? "–" : Math.round(s)}</span><span class="muted">{" of 100"}</span></h4>
          <p class="hv-small">{#if r.ranked[k]}{rk ? "#" + rk + " of " + rank.size + " ranked zips. " : ""}{:else}<b>Not ranked:</b>{" "}{/if}Measured factors carry {Math.round(r.coverage[k] * 100)}% of {k ? "person 2's" : "your"} weight{r.ranked[k] ? "." : ", under the " + Math.round(data.min_coverage * 100) + "% needed to rank."}</p>
          <table class="hv-factors"><thead><tr><th>Factor</th><th>This zip</th><th>Target</th><th>Match</th><th>Points lost</th></tr></thead><tbody>
            {#each ORDER.filter((i) => p.weights[i] > 0) as i}
              {@const part = parts[i]}
              {@const v = i === 2 && p.workplace ? r.commutes[k] : r[mode][i]}
              <tr><th scope="row">{factors[i].name} <span class="muted">{Math.round(part.share * 100)}%</span></th><td>
                {#if part.missing}<span class="hv-warn">no data, left out</span>{:else}{factorText(mode, i, v) + (i === 2 && p.workplace ? " drive" : "")}{/if}
              </td><td>{i === 5 && mode === "buy" ? money(p.targets[i]) : factorText(mode, i, p.targets[i])}</td><td>
                {#if part.closeness == null}–{:else}<span class="hv-meter" role="img" aria-label="{Math.round(part.closeness)} of 100"><span style="width:{part.closeness}%"></span></span>{/if}
              </td><td>{part.lost == null ? "–" : part.lost < 0.5 ? "0" : "−" + part.lost.toFixed(1)}</td></tr>
            {/each}
          </tbody></table>
          <p class="hv-small">{why(parts)}</p>
        </section>
      {/each}
    {/if}

    <section class="hv-block"><h4>Housing costs</h4><dl class="hv-dl">
      {#if z.buy}<dt>Median sale price</dt><dd>{money(z.buy[5])}</dd>{/if}
      {#if z.value}<dt>Price per sq ft</dt><dd>${Math.round(z.value.ppsf)} ({z.value.sales} sales)</dd>{/if}
      {#if z.rent}<dt>Rent per person</dt><dd>{money(z.rent[5])} a month</dd>{/if}
    </dl><p class="hv-small muted">Redfin, Jun 2025 to May 2026 (sales); Census ACS 2020–2024 (rent). {@render listing(z.zip, name(r || z))}</p></section>

    {#if mode === "buy"}
      {@const v = z.value}
      {#if v}
        <section class="hv-block"><h4>Price vs expected <span class="hv-gap hv-{v.cls}">{CLASS[v.cls]}</span></h4>
          <p>Sells for <b>${Math.round(v.ppsf)}</b> a sq ft. Zips with the same measured schools, safety, commute, walkability, train access, home age and state sell for about <b>${Math.round(v.expected)}</b>, so it is <b>{gapText(v.gap)}</b> (90% range from price noise alone: {signed(v.lo)} to {signed(v.hi)}).</p>
          <p class="hv-small"><b>Confidence: {CONF[v.conf]}.</b> {v.issues.length ? v.issues.map((i) => ISSUES[i] ? ISSUES[i](v) : i).join(" ") : "Enough sales, complete data, the same class under the other model versions and with last year's prices."}</p>
          <p class="hv-small">Earlier years, same model: {["2025", "2024", "2023"].map((y, i) => y + " " + (v.prev[i] == null ? "–" : signed(v.prev[i]))).join(" · ")}.</p>
          <p class="hv-small muted">Not a bargain signal: a gap also reflects what the model can't see, such as lot size, condition, taxes, flood risk or a lake view. See “Price vs expected” below.</p></section>
      {:else}
        <section class="hv-block"><h4>Price vs expected</h4><p class="hv-small">No estimate: the zip isn't in the buyers' sample or has no price per sq ft.</p></section>
      {/if}
    {/if}

    <section class="hv-block"><h4>Data notes</h4><ul class="hv-small">
      {#each notes as n}<li>{n}</li>{/each}
    </ul></section>
  {/if}
</div>
