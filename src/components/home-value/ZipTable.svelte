<!-- The top list or every zip, sortable, with a filter -->
<script>
  import { flushSync } from "svelte";
  import { CONF, money, name, pctText, who, zillow } from "./hv.js";

  let { result, cur, rank, mode, view, ps, factors, selected, onselect } = $props();

  const PAGE = 50;
  let sortKey = $state("rank"), sortDir = $state(1);
  let show = $state("top"), filter = $state("");
  let showEvery = $state(false);   // the "every zip" list shows PAGE rows until the reader asks for the rest
  let tableEl;

  const two = $derived(!!result && result.picks.length > 1);
  const cols = $derived.by(() => {
    if (!result) return [];
    const works = ps.map((p, k) => (p.workplace ? k : null)).filter((k) => k != null);
    return [
      { key: "rank", head: "#", val: (r) => rank.get(r.zip) ?? Infinity },
      { key: "place", head: "Place", val: (r) => name(r) },
      { key: "zip", head: "Zip", val: (r) => r.zip },
      { key: "score", head: view === 2 && two ? "Fit, both" : "Fit", val: (r) => cur.score(r) ?? -1 },
      ...(two ? [0, 1].map((k) => ({ key: "s" + k, k, head: who(k), val: (r) => r.scores[k] ?? -1 })) : []),
      ...works.map((k) => ({ key: "d" + k, k, head: (two ? who(k) + " drive" : "Drive"), val: (r) => r.commutes[k] ?? Infinity })),
      { key: "price", head: mode === "buy" ? "Price" : "Rent each", val: (r) => r[mode][5] ?? Infinity },
      ...(mode === "buy" ? [
        { key: "gap", head: "Price vs expected", val: (r) => r.value?.gap ?? Infinity },
        { key: "conf", head: "Confidence", val: (r) => ({ high: 0, medium: 1, low: 2 })[r.value?.conf] ?? 3 },
      ] : []),
      { key: "data", head: "Data", val: (r) => -Math.min(...(view === 2 ? r.coverage : [r.coverage[cur.k]])) },
      { key: "list", head: "Listings", nosort: true },
    ];
  });

  // The column the table sorts by: the one picked, or rank while that column isn't shown
  // (it comes back when the column does, e.g. buying again after renting)
  const sortCol = $derived(cols.find((c) => c.key === sortKey && !c.nosort) || cols[0]);
  const list = $derived.by(() => {
    if (!result) return null;
    const q = filter.trim().toLowerCase();
    const col = sortCol;
    const rows = result.rows.filter((r) => show === "all" || cur.picks.has(r.zip))
      .filter((r) => !q || (name(r) + " " + r.zip).toLowerCase().includes(q))
      .sort((a, b) => { const x = col.val(a), y = col.val(b); return (x < y ? -1 : x > y ? 1 : 0) * sortDir; });
    return { q, total: rows.length, rows: show === "all" && !showEvery ? rows.slice(0, PAGE) : rows };
  });

  // Best fit first; everything else low to high
  const firstDir = (key) => (["score", "s0", "s1"].includes(key) ? -1 : 1);
  function sortBy(key) {
    sortDir = key === sortKey ? -sortDir : firstDir(key);
    sortKey = key;
    flushSync();
    tableEl.querySelector('[data-sort="' + key + '"]')?.focus();
  }

  // Data coverage: a check when every weighted factor is measured, else what's missing
  function coverage(r) {
    const ks = view === 2 ? ps.map((_, k) => k) : [cur.k];
    const gaps = new Set();
    ks.forEach((k) => r.close[k].forEach((c, i) => { if (c == null && ps[k].weights[i] > 0) gaps.add(factors[i].name.toLowerCase()); }));
    return gaps.size ? { gaps: [...gaps].join(", "), cov: Math.round(Math.min(...ks.map((k) => r.coverage[k])) * 100) } : null;
  }
</script>

<div class="hv-list">
  <div class="hv-list-bar">
    <h2 class="hv-h">The zips</h2>
    <!-- Phones hide the header row, so a small menu sorts instead -->
    <label class="hv-sort-pick">Sort <select id="hv-list-sort" value={sortCol?.key} onchange={(e) => { sortKey = e.currentTarget.value; sortDir = firstDir(sortKey); }}>
      {#each cols.filter((c) => !c.nosort) as c}<option value={c.key}>{c.key === "rank" ? "Rank" : c.head}</option>{/each}
    </select></label>
    <label>Show <select id="hv-list-show" bind:value={show} onchange={() => (showEvery = false)}><option value="top">Top 20 fits</option><option value="all">Every zip</option></select></label>
    <label>Filter <input id="hv-list-filter" type="search" placeholder="place or zip" autocomplete="off" bind:value={filter}></label>
  </div>
  <div class="prose hv-table-wrap"><table id="hv-table" bind:this={tableEl}>
    {#if list && !list.rows.length}
      <caption>{list.q ? "No zip matches “" + list.q + "”." : "Nothing to list."}</caption>
    {:else if list}
      <caption>{show === "all" ? list.total + " zips" + (list.q ? " matching “" + list.q + "”" : "") + (list.rows.length < list.total ? ", showing the first " + list.rows.length : "") : "Top " + list.rows.length + " fits"}. Pick a place for its details.</caption>
      <thead><tr>
        {#each cols as c (c.key)}
          {#if c.nosort}<th>{c.head}</th>
          {:else}<th aria-sort={c.key === sortKey ? (sortDir > 0 ? "ascending" : "descending") : "none"}><button type="button" class="hv-sort" data-sort={c.key} onclick={() => sortBy(c.key)}>{c.head}{c.key === sortKey ? (sortDir > 0 ? " ▲" : " ▼") : ""}</button></th>{/if}
        {/each}
      </tr></thead>
      <tbody>
        {#each list.rows as r (r.zip)}
          <tr class={r.zip === selected ? "hv-selected" : !cur.ranked(r) ? "hv-dim" : ""}>
            {#each cols as c (c.key)}
              <td class="c-{c.key}" data-label={c.head}>
                {#if c.key === "rank"}{rank.get(r.zip) ?? "–"}
                {:else if c.key === "place"}<button class="hv-link" type="button" data-zip={r.zip} onclick={() => onselect(r.zip, true)}>{name(r)}</button>
                {:else if c.key === "zip"}{r.zip}
                {:else if c.key === "score"}<b>{cur.score(r) == null ? "–" : Math.round(cur.score(r))}</b>
                {:else if c.key[0] === "s"}{r.scores[c.k] == null ? "–" : Math.round(r.scores[c.k])}
                {:else if c.key[0] === "d" && c.key !== "data"}{r.commutes[c.k] == null ? "–" : Math.round(r.commutes[c.k]) + " min"}
                {:else if c.key === "price"}{r[mode][5] == null ? "–" : money(r[mode][5])}
                {:else if c.key === "gap"}{#if r.value}<span class="hv-gap hv-{r.value.cls}">{(r.value.gap > 0 ? "+" : "−") + pctText(r.value.gap)}</span>{:else}–{/if}
                {:else if c.key === "conf"}{r.value ? CONF[r.value.conf] : "–"}
                {:else if c.key === "data"}
                  {@const gap = coverage(r)}
                  {#if gap}<span class="hv-warn" title="Left out: {gap.gaps}">No {gap.gaps} ({gap.cov}%)</span>{:else}<span class="hv-ok" title="Every factor you weight is measured">✓</span>{/if}
                {:else}<a href={zillow(mode, r.zip)} target="_blank" rel="noopener" aria-label="{name(r)}, {mode === 'buy' ? 'homes for sale' : 'rentals'} on Zillow (new tab)">Zillow ↗</a>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
      {#if list.rows.length < list.total}
        <tfoot><tr><td colspan={cols.length}><button class="btn small" type="button" data-more onclick={() => (showEvery = true)}>Show all {list.total}</button></td></tr></tfoot>
      {/if}
    {/if}
  </table></div>
</div>
