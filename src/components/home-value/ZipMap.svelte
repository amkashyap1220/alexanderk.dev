<!-- The map of zips, colored by fit or by price vs expected, and its legend -->
<script>
  import * as Plot from "@observablehq/plot";
  import { extent, scaleLinear, interpolateLab, geoCentroid } from "d3";
  import { CONF, css, gapText, money, name, who } from "./hv.js";
  import { frame, valueColor } from "./plot.js";

  let { data, geo, stations, byZip, result, cur, rank, mode, view, lens, selected, ps, placeName, theme, failed, onselect } = $props();

  let mapEl, width = $state(0);

  // Which zips get a color, and the fit scores the colors span
  const shade = $derived.by(() => {
    if (!geo || !result) return null;
    const scored = new Map(result.rows.map((r) => [r.zip, r]));
    const value = lens === "value";
    const inSample = geo.features.filter((f) => scored.has(f.id) && (value ? scored.get(f.id).value : cur.ranked(scored.get(f.id))));
    const [lo, hi] = value ? [] : extent(inSample.map((f) => cur.score(scored.get(f.id))));
    return { scored, value, inSample, lo, hi };
  });

  // Before the reader has set their targets every zip is one neutral color
  $effect(() => {
    theme;   // the colors come from the page's CSS, so redraw when the theme changes
    if (failed) { mapEl.replaceChildren(); return; }
    if (!geo || width < 200) return;
    const bg = css("--bg");
    const feats = geo.features;
    const projection = { type: "mercator", domain: geo };
    const height = Math.round(width * 1.12);
    if (!result) {
      return frame(mapEl, width, height, [
        Plot.geo(feats, { fill: css("--hv-none"), stroke: bg, strokeWidth: 0.5 }),
        stationDots(bg),
        ...zipTip(feats, { fill: bg, stroke: css("--border"), title: (f) => { const z = byZip.get(f.id); return z ? name(z) + " " + z.zip : "Zip " + f.id; } }),
      ], "Map of Chicago-area zip codes. Nothing is scored yet.", select, { projection });
    }

    const { picks, score, label } = cur;
    const { scored, value, inSample } = shade;
    const rest = feats.filter((f) => !inSample.includes(f));
    let fill, opacity = 1;
    if (value) {
      const color = valueColor();
      fill = (f) => color(scored.get(f.id).value.gap);
      opacity = (f) => (scored.get(f.id).value.conf === "low" ? 0.4 : 1);
    } else {
      // Red (lowest ranked score on the map) through orange and yellow to green (highest)
      const { lo, hi } = shade;
      const color = scaleLinear().domain([0, 1, 2, 3].map((i) => lo + (i / 3) * (hi - lo)))
        .range(["--hv-0", "--hv-1", "--hv-2", "--hv-3"].map(css)).interpolate(interpolateLab);
      fill = (f) => color(score(scored.get(f.id)));
    }
    const two = result.picks.length > 1;
    const sel = feats.filter((f) => f.id === selected);
    const people = ps;

    frame(mapEl, width, height, [
      Plot.geo(rest, { fill: css("--hv-none"), stroke: bg, strokeWidth: 0.5 }),
      Plot.geo(inSample, { fill, fillOpacity: opacity, stroke: bg, strokeWidth: 0.5 }),
      // The top areas: a soft blue glow, a halo in the page color, then a crisp blue outline (Tango sky blue reads on red to green)
      ...topMarks(feats.filter((f) => picks.has(f.id)), bg),
      Plot.geo(sel, { fill: "none", stroke: css("--text"), strokeWidth: 2.5 }),
      stationDots(bg),
      ...zipTip(feats, {
        fill: bg, stroke: css("--border"),
        title: (f) => {
          const r = scored.get(f.id);
          if (!r) return "Zip " + f.id + (byZip.get(f.id) ? " · " + name(byZip.get(f.id)) : "") + "\nNot in the " + (mode === "buy" ? "buyers'" : "renters'") + " sample (too few " + (mode === "buy" ? "sales" : "rented homes") + " or too much missing data)";
          const s = score(r);
          return [
            name(r) + " " + r.zip,
            (view === 2 && two ? "Fit for both " : "Fit ") + (s == null ? "–" : Math.round(s)) + " of 100" +
              (rank.has(r.zip) ? ", #" + rank.get(r.zip) + " of " + rank.size : ", not ranked (missing data)") +
              (picks.has(r.zip) ? " · in " + label + " top " + data.top : ""),
            two ? "You " + Math.round(r.scores[0]) + ", person 2 " + Math.round(r.scores[1]) : null,
            ...people.map((p, k) => p.workplace ? (two ? who(k) + ": " : "") + Math.round(r.commutes[k]) + " min drive to " + placeName(p.workplace) : null),
            mode === "buy" ? money(r.buy[5]) + " median sale price" : money(r.rent[5]) + " rent per person a month",
            r.value && mode === "buy" ? "Price per sq ft " + gapText(r.value.gap) + " (" + CONF[r.value.conf].toLowerCase() + " confidence)" : null,
            "Click for details",
          ].filter(Boolean).join("\n");
        },
      }),
    ], "Map of Chicago-area zip codes colored by " + (value ? "price per square foot compared with the expected price, blue for below and purple for above" : "fit score, red for low to green for high") +
      ". The top " + data.top + " fits are outlined in blue and listed in the table below. Small dark dots are train stations.", select, { projection });
  });

  const select = (zip) => { if (byZip.has(zip)) onselect(zip, false); };

  // The detail box for the zip under the pointer. It sits next to the zip, but on a
  // narrow map it would run off the screen, so there it stays in the top-left corner
  // and the zip itself gets an outline.
  function zipTip(feats, options) {
    if (width >= 560) return [Plot.tip(feats, Plot.pointer(Plot.centroid(options)))];
    const centers = new Map(feats.map((f) => [f.id, geoCentroid(f)]));
    const at = { px: (f) => centers.get(f.id)[0], py: (f) => centers.get(f.id)[1] };
    return [
      Plot.geo(feats, Plot.pointer({ ...at, fill: "none", stroke: css("--text"), strokeWidth: 2 })),
      Plot.tip(feats, Plot.pointer({ ...options, ...at, frameAnchor: "top-left", anchor: "top-left", pointerSize: 0 })),
    ];
  }

  // Metra, CTA 'L' and South Shore Line stations: small dots in the text color with a ring in the page color
  function stationDots(bg) {
    return Plot.dot(stations, { x: (d) => d[0], y: (d) => d[1], r: width < 560 ? 1.6 : 2.2, fill: css("--text"), stroke: bg, strokeWidth: 0.8 });
  }

  function topMarks(top, bg) {
    const blue = css("--hv-top");
    return [
      Plot.geo(top, { fill: "none", stroke: blue, strokeWidth: 7, strokeOpacity: 0.28, strokeLinejoin: "round" }),
      Plot.geo(top, { fill: "none", stroke: bg, strokeWidth: 3.5, strokeLinejoin: "round" }),
      Plot.geo(top, { fill: "none", stroke: blue, strokeWidth: 2, strokeLinejoin: "round" }),
    ];
  }
</script>

<!-- Legend: the color key changes with the lens, and always says what the numbers are -->
<ul class="hv-legend" id="hv-legend" aria-label="Legend">
  {#if geo}
    {#if shade && !shade.value}
      <li><span class="hv-num">{Math.round(shade.lo)}</span><span class="hv-key ramp"></span><span class="hv-num">{Math.round(shade.hi)}</span>Fit score (0 to 100; colors span this map's range)</li>
    {:else if shade}
      <li><span class="hv-num">−40%</span><span class="hv-key diverge"></span><span class="hv-num">+40%</span>Price per sq ft vs expected (below · in line · above)</li>
      <li><span class="hv-key faded"></span>Faded: low confidence</li>
    {/if}
    {#if shade}<li><span class="hv-key pick"></span>Top {data.top} fit</li>{/if}
    <li><span class="hv-key none"></span>{shade?.value ? "No price estimate" : shade ? "Not ranked or not in the sample (too little data)" : "Zip code"}</li>
    <li><span class="hv-key station"></span>Train station</li>
  {/if}
</ul>
<div id="hv-map" class="hv-map" bind:this={mapEl} bind:clientWidth={width}><p class="hv-placeholder">Loading the map…</p></div>
