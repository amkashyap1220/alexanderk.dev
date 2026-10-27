<!--
  Chicago home value: the map, chart and table for the post.
  Reads /research/chicago-home-value.json (per-zip values and the housing
  value estimates, made by src/site_data.py in the Home-Value-Score repo) and
  /research/chicago-home-value-zips.json (zip shapes, src/map.py), scores the
  zips with js/chicago-home-value-model.js and draws them with Observable Plot,
  with the train stations from /research/chicago-home-value-stations.json on top.

  Two separate questions, two lenses on the same map:
  - Fit to you: how close each zip is to the reader's own targets (the fit score).
  - Price vs expected: whether a zip's price per sq ft is below or above what zips
    with the same measured characteristics sell for (src/value_gap.py). Fixed, not
    affected by the reader's targets; buyers only.
  The chart puts the two side by side, and clicking a zip anywhere (map, chart,
  table or the search box) opens its detail panel: the score, each factor's part
  in it, prices, the value estimate and how sure it is, and the data behind it.

  The reader picks buying or renting, sets a target and a weight for each
  factor, can name where they work (commute becomes the drive time there,
  from /research/chicago-home-value-drive.json, src/commute.py), and can add
  a second person. The form starts with sample values. Colors come from the
  site's CSS variables, so the map redraws when the theme or the width changes.

  This file holds the state and the scoring; each part of the page is its own
  component next to it. The methods tables further down the post are filled
  in when the site is built (src/pages/research/chicago-home-value.astro).
-->
<script>
  import { onMount, flushSync } from "svelte";
  import { ALL, WEIGHTS, factorsFor, findPlace, listJoin, name, parse, who } from "./hv.js";
  import PersonForm from "./PersonForm.svelte";
  import Summary from "./Summary.svelte";
  import ZipMap from "./ZipMap.svelte";
  import FitPriceChart from "./FitPriceChart.svelte";
  import ZipTable from "./ZipTable.svelte";
  import ZipDetail from "./ZipDetail.svelte";

  let data = $state.raw(null), geo = $state.raw(null);
  let stations = $state.raw([]);   // [lon, lat, name, agency], from chicago-home-value-stations.json
  let places = $state.raw([]);     // [{ zip, label }] for the workplace and search boxes
  let byZip = $state.raw(new Map());
  let drive = null;                // drive(fromZip, toZip) in minutes, from chicago-home-value-drive.json
  let failed = $state(""), loading = $state(true);

  let mode = $state("buy");
  let lens = $state("fit");        // "fit" or "value"
  let view = $state(0);            // 0 = you, 1 = person 2, 2 = best for both
  let selected = $state(null);     // zip shown in the detail panel
  let theme = $state(0);           // bumps when the light/dark theme changes, so the colors are read again

  // Each person's form as typed: targets as text, sliders 0 to 4, both by factor
  const blank = () => ({ targets: Array(7).fill(""), sliders: Array(7).fill(2), work: "" });
  let people = $state([blank()]);
  let addBtn, peopleEl;

  const factors = $derived(factorsFor(mode));
  const placeName = (zip) => (places.find((p) => p.zip === zip) || { label: zip }).label;

  // The sample values (SAMPLE in src/value.py)
  const sampleFor = (m) => {
    const s = data.sample[m];
    return { targets: s.targets.map((t) => t.toLocaleString()), sliders: s.weights.map((w) => WEIGHTS.findIndex((st) => st.weight === w)), work: placeName(s.workplace) };
  };
  const sample = $derived(data && sampleFor(mode));
  const fillSample = (p) => { if (data) Object.assign(p, structuredClone(sample)); };

  // What each person asks for, read from their form
  const ps = $derived(people.map((p) => ({ weights: p.sliders.map((v) => WEIGHTS[v].weight), targets: ALL.map((i) => parse(p.targets[i])), workplace: findPlace(places, p.work) })));

  // What's still missing before a person can be scored, as text, or null when they're ready
  function missing(p, w) {
    if (p.weights.every((x) => x === 0)) return w + " set everything to Ignore, so give at least one thing a weight.";
    const need = factors.filter((f, i) => p.weights[i] > 0 && p.targets[i] == null).map((f) => f.name.toLowerCase());
    if (p.workplace === undefined) return w + " named a workplace the map doesn't know.";
    if (!need.length) return null;
    return w + " still need" + (w === "You" ? "" : "s") + " a target for " + listJoin(need) + ".";
  }

  function currentOf(result, view) {
    if (view === 2 && result.both) return { picks: result.both, score: (r) => r.both, ranked: (r) => r.bothRanked, label: "best for both", k: null };
    const k = Math.min(view, result.picks.length - 1);
    return { picks: result.picks[k], score: (r) => r.scores[k], ranked: (r) => r.ranked[k], label: k === 0 ? "your" : "person 2's", k };
  }

  // Scores every zip and says what the last change did to the top list (only when the
  // change was to the targets or weights, not to buying/renting, the view or the people)
  let last = null;
  const scored = $derived.by(() => {
    if (!data) return null;
    const gaps = ps.map((p, k) => missing(p, who(k))).filter(Boolean);
    if (gaps.length) { last = null; return { gaps, result: null, cur: null, note: "" }; }
    const result = window.HVModel.run(data.zips, mode, ps, data.top, drive);
    const cur = currentOf(result, view);
    const context = mode + "|" + view + "|" + people.length;
    let note = "";
    if (last && last.context === context) {
      const c = window.HVModel.changes(last.picks, cur.picks);
      const names = (zs) => listJoin(zs.slice(0, 3).map((z) => name(byZip.get(z))).concat(zs.length > 3 ? [zs.length - 3 + " more"] : []));
      if (c.added.length) note = " brought " + names(c.added) + " into the top " + data.top + " and pushed out " + names(c.removed) + ".";
      else if (last.picks.size) note = " kept the same top " + data.top + " (the order may have moved).";
    }
    last = { picks: cur.picks, context };
    return { gaps, result, cur, note };
  });
  const result = $derived(scored?.result ?? null);
  const cur = $derived(scored?.cur ?? null);

  // Ranks among ranked zips under the current view
  const rank = $derived.by(() => {
    if (!result) return new Map();
    const { score, ranked } = cur;
    const order = result.rows.filter((r) => ranked(r) && score(r) != null).sort((a, b) => score(b) - score(a));
    return new Map(order.map((r, i) => [r.zip, i + 1]));
  });

  // Runs fn without moving el on screen. The summary, the lines under it and the legend sit
  // above the form on a phone and change height as the reader edits; Safari doesn't keep the
  // scroll position anchored itself (and .hv turns that off elsewhere for consistency), so this
  // scrolls back by however far el moved.
  // hold(el) notes where el is; the function it returns scrolls it back there once the page has redrawn.
  function hold(el) {
    const before = el.getBoundingClientRect().top;
    return () => {
      flushSync();
      const moved = el.getBoundingClientRect().top - before;
      if (moved) window.scrollBy(0, moved);
    };
  }
  function steady(el, fn) {
    const done = hold(el);
    fn();
    done();
  }

  function select(zip, focus) {
    selected = zip;
    if (focus) { flushSync(); document.querySelector("#hv-detail h3")?.focus(); }
  }

  const setLens = (l) => { lens = l === "value" && mode === "buy" ? "value" : "fit"; };

  function setMode(m) {
    if (m === mode) return;
    // A sale price and a monthly rent aren't the same target, so the price box starts over:
    // with the new sample price if it held the old one, otherwise empty
    const old = data ? sample.targets[5] : null;
    const next = data ? sampleFor(m).targets[5] : "";
    people.forEach((p) => { p.targets[5] = data && p.targets[5] === old ? next : ""; });
    mode = m;
    last = null;   // the old results are for the other mode
    setLens(lens);
  }

  function addPerson() {
    steady(peopleEl, () => {
      const p = blank();
      fillSample(p);
      people.push(p);
      view = 2;
    });
  }
  function removePerson() {
    steady(addBtn, () => { people.splice(1, 1); view = 0; });
  }

  let find = $state(""), findNote = $state("");
  function onfind() {
    const zip = findPlace(places, find);
    findNote = zip === undefined ? "No match. Try a zip code." : "";
    if (zip) select(zip, true);
  }

  onMount(() => {
    // Redraw when the theme changes (js/theme.js swaps .light/.dark on <html>)
    const watch = new MutationObserver(() => theme++);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    if (!window.HVModel) {
      failed = "blocked";
      return () => watch.disconnect();
    }
    const load = (f) => fetch("/research/chicago-home-value" + f + ".json").then((r) => { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); });
    Promise.all(["", "-zips", "-drive", "-stations"].map(load))
      .then(([json, shapes, times, stops]) => {
        const zips = new Map(json.zips.map((z) => [z.zip, z]));
        // Drive times: an n x n grid of whole minutes, row = from, column = to
        const index = new Map(times.zips.map((z, i) => [z, i]));
        const grid = Uint8Array.from(atob(times.minutes), (c) => c.charCodeAt(0));
        drive = (from, to) => (index.has(from) && index.has(to) ? grid[index.get(from) * times.zips.length + index.get(to)] : null);
        places = times.zips.map((z) => ({ zip: z, label: (zips.get(z)?.place || "Zip") + ", " + (zips.get(z)?.state || (z[0] === "4" ? "IN" : "IL")) + " " + z }))
          .sort((a, b) => a.label.localeCompare(b.label));
        byZip = zips;
        geo = shapes;
        stations = stops;
        data = json;
        loading = false;
        people.forEach(fillSample);
        setLens("fit");
      })
      .catch(() => {
        loading = false;
        failed = "load";
      });
    return () => watch.disconnect();
  });
</script>

<div class="hv" class:hv-loading={loading && failed !== "blocked"} class:hv-unscored={scored && scored.gaps.length > 0} id="hv">
  <div class="hv-bar">
    <div class="hv-toggle" role="group" aria-label="Buying or renting">
      {#each [["buy", "Buying"], ["rent", "Renting"]] as [m, text]}
        <button class="btn small" type="button" data-mode={m} aria-pressed={String(mode === m)} onclick={(e) => steady(e.currentTarget, () => setMode(m))}>{text}</button>
      {/each}
    </div>
    <div class="hv-toggle" id="hv-lens" role="group" aria-label="What the map shows">
      <button class="btn small" type="button" data-lens="fit" aria-pressed={String(lens === "fit")} onclick={(e) => steady(e.currentTarget, () => setLens("fit"))}>Fit to you</button>
      <button class="btn small" type="button" data-lens="value" aria-pressed={String(lens === "value")} disabled={!!data && mode !== "buy"} onclick={(e) => steady(e.currentTarget, () => setLens("value"))}>Price vs expected</button>
    </div>
    <div class="hv-toggle" id="hv-view" role="group" aria-label="Whose results to show" hidden={people.length < 2}>
      {#each ["You", "Person 2", "Best for both"] as text, v}
        <button class="btn small" type="button" data-view={v} aria-pressed={String(view === v)} onclick={(e) => steady(e.currentTarget, () => (view = v))}>{text}</button>
      {/each}
    </div>
  </div>
  <p class="hv-lens-note" id="hv-lens-note" hidden={!data || mode === "buy"}>“Price vs expected” covers sale prices only. Renters see the fit score.</p>
  <Summary {data} {failed} {mode} {view} {ps} {scored} {factors} />

  <div class="hv-grid">
    <div class="hv-main">
      <figure class="hv-figure" aria-labelledby="hv-caption">
        <ZipMap {data} {geo} {stations} {byZip} {result} {cur} {rank} {mode} {view} {lens} {selected} {ps} {placeName} {theme} {failed} onselect={select} />
        <figcaption id="hv-caption">Hover or tap a zip for a summary; click it for details. Scores are for zip codes as a whole, not for streets or homes.</figcaption>
      </figure>
      <label class="hv-find"><span>Find a zip:</span>
        <input id="hv-find" type="search" list="hv-places" placeholder="town or zip" autocomplete="off" bind:value={find} onchange={onfind}>
        <span class="hv-hint" id="hv-find-note" aria-live="polite">{findNote}</span></label>
      <ZipDetail {data} {byZip} {result} {cur} {rank} {mode} {view} {ps} {factors} {selected} onclose={() => (selected = null)} />
    </div>

    <form class="hv-controls" aria-label="Your targets and weights" onsubmit={(e) => e.preventDefault()}>
      <div id="hv-people" bind:this={peopleEl}>
        {#each people as _, k}
          <PersonForm bind:person={people[k]} {k} {mode} {data} {factors} {sample} workplace={ps[k].workplace} {placeName} {hold} {steady} {fillSample} onremove={removePerson} />
        {/each}
      </div>
      <datalist id="hv-places">
        {#each places as p}<option value={p.label}></option>{/each}
      </datalist>
      <button class="btn small hv-add" type="button" id="hv-add" hidden={people.length > 1} bind:this={addBtn} onclick={addPerson}>+ Add a second person</button>
    </form>
  </div>

  <FitPriceChart {data} {result} {cur} {rank} {mode} {selected} {theme} onselect={select} />

  <ZipTable {result} {cur} {rank} {mode} {view} {ps} {factors} {selected} onselect={select} />
  <p class="hv-age"><b>How old the data is:</b> pulled Oct 21–22, 2026. Prices: Redfin, Jun 2025 to May 2026 (earlier years for the checks). Rent, home age and the Census commute: ACS 2020–2024. Crime: FBI, 2025 (2024 where 2025 is incomplete); inside Chicago spread across zips with the city's 2025 incident data. Schools: 2024–25 tests (IL), 2025–26 (IN). Walkability: EPA, 2021. Drive times: OpenStreetMap, Oct 2026. Train stations: Metra, CTA and South Shore Line, Oct 2026.</p>
</div>
