/* ==========================================================================
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
   ========================================================================== */

(function () {
  const root = document.getElementById("hv");
  if (!root) return;
  const $ = (id) => document.getElementById(id);
  const mapEl = $("hv-map"), chartEl = $("hv-chart"), tableEl = $("hv-table"), summaryEl = $("hv-summary");
  const driversEl = $("hv-drivers"), detailEl = $("hv-detail"), legendEl = $("hv-legend");
  const peopleEl = $("hv-people"), addBtn = $("hv-add"), viewEl = $("hv-view"), lensEl = $("hv-lens");
  const sortPick = $("hv-list-sort");
  const listShow = $("hv-list-show"), listFilter = $("hv-list-filter"), findEl = $("hv-find"), findNote = $("hv-find-note");

  if (!window.Plot || !window.d3 || !window.HVModel) {
    summaryEl.innerHTML = "<b>The map could not load</b> (its scripts were blocked or failed to download). The data is in the GitHub repo linked above.";
    return;
  }

  // Each factor: what it measures and the units around its target box. Price depends on buying or renting.
  const FACTORS = [
    { name: "Schools", hint: "State test percentile: 80 beats 80% of districts.", before: "", after: "percentile", digits: 0 },
    { name: "Safety", hint: "Crimes per 1,000 residents a year.", before: "", after: "crimes per 1,000", digits: 1 },
    { name: "Commute", hint: "One-way minutes. Add where you work to use the drive time there.", before: "", after: "minutes", digits: 0 },
    { name: "Walkability", hint: "1 (car for everything) to 20 (very walkable).", before: "", after: "out of 20", digits: 1 },
    { name: "Home age", hint: "Age of the typical home.", before: "", after: "years old", digits: 0 },
  ];
  const PRICE = {
    buy: { name: "Price", hint: "Median sale price, past year.", before: "$", after: "", digits: -3, example: "600k" },
    rent: { name: "Rent per person", hint: "Median rent split by bedroom, so one roommate's share.", before: "$", after: "a month", digits: 0, example: "1,200" },
  };
  const TRAIN = { name: "Train station", hint: "Miles to the nearest Metra, CTA 'L' or South Shore Line station.", before: "", after: "miles", digits: 1 };
  const factors = () => [...FACTORS, PRICE[mode], TRAIN];
  const ALL = [0, 1, 2, 3, 4, 5, 6];
  // The form shows the train station right after commute
  const ORDER = [0, 1, 2, 6, 3, 4, 5];
  // The weight slider runs 0 to 4; these are the weights and words for each step
  const WEIGHTS = [
    { weight: 0, word: "Ignore" }, { weight: 0.5, word: "Low" }, { weight: 1, word: "Normal" },
    { weight: 2, word: "High" }, { weight: 3, word: "Top" },
  ];
  // Housing value classes and the reasons a zip's estimate is less certain (src/value_gap.py)
  const CLASS = { below: "Below expected", in_line: "In line", above: "Above expected" };
  const CONF = { high: "High", medium: "Medium", low: "Low" };
  const ISSUES = {
    few_sales: (v) => "Only " + v.sales + " sales in the past year, so its median price is noisy.",
    missing_indicator: () => "Missing a measured factor (usually crime), so its expected price uses fewer factors.",
    chicago_schools: () => "Chicago is one school district, so the model can't see school differences between city neighborhoods.",
    spec_sensitive: (v) => "Only " + Math.round(v.agree * 100) + "% of the 12 other model versions put it in the same class.",
    changed_since_2025: () => "It was in a different class with last year's prices.",
    noisy_price: () => "Price noise alone could put it back in line.",
  };

  let data = null, geo = null, byZip = null;
  let drive = null;        // drive(fromZip, toZip) in minutes, from chicago-home-value-drive.json
  let stations = [];       // [lon, lat, name, agency], from chicago-home-value-stations.json
  let places = [];         // [{ zip, label }] for the workplace and search boxes
  let mode = "buy";
  let lens = "fit";        // "fit" or "value"
  let view = 0;            // 0 = you, 1 = person 2, 2 = best for both
  let result = null;
  let selected = null;     // zip shown in the detail panel
  let sortKey = "rank", sortDir = 1;
  let lastPicks = null, lastContext = "", changeNote = "";
  let showEvery = false;   // the "every zip" list shows PAGE rows until the reader asks for the rest
  const PAGE = 50;

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const money = (x) => "$" + Math.round(x).toLocaleString();
  const name = (z) => (z.place || "Zip " + z.zip) + ", " + z.state;
  // digits < 0 rounds to tens, hundreds, thousands...
  const fmt = (x, digits) => (digits < 0 ? Math.round(x / 10 ** -digits) * 10 ** -digits : x)
    .toLocaleString(undefined, { maximumFractionDigits: Math.max(digits, 0) });
  const listJoin = (a) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  const pctText = (g) => Math.round(Math.abs(g) * 100) + "%";
  const gapText = (g) => g == null ? "no estimate" : Math.abs(g) < 0.005 ? "at expected" : pctText(g) + (g < 0 ? " below" : " above") + " expected";
  const valueOk = () => mode === "buy";

  // A factor's value in words, for the detail panel
  function factorText(i, x) {
    if (x == null) return "no data";
    const f = factors()[i];
    if (i === 0) return Math.round(x) + suffix(Math.round(x)) + " percentile";
    if (i === 5) return mode === "buy" ? money(Math.round(x / 1000) * 1000) : money(x) + "/mo";
    return f.before + fmt(x, Math.max(f.digits, i === 2 ? 0 : 1)) + " " + ({ 1: "per 1,000", 2: "min", 3: "of 20", 4: "years", 6: "mi" })[i];
  }
  const suffix = (n) => (n % 100 >= 11 && n % 100 <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th";

  // ---- Controls: one fieldset per person, built here so both people get the same form

  function row(i) {
    return '<div class="hv-factor">' +
      '<label class="hv-line"><span class="hv-name" data-name="' + i + '"></span>' +
      '<input type="range" name="w' + i + '" min="0" max="4" step="1" value="2">' +
      '<output>Normal</output></label>' +
      '<p class="hv-hint"><span data-hint="' + i + '"></span> <span data-typical="' + i + '"></span></p>' +
      '<label class="hv-target"><span>Target: <span data-before="' + i + '"></span></span>' +
      '<input type="text" inputmode="decimal" name="t' + i + '">' +
      '<span data-after="' + i + '"></span></label>' +
      (i === 2 ? '<label class="hv-target"><span>Where you work:</span>' +
        '<input class="hv-work" type="text" name="work" list="hv-places" placeholder="town or zip" aria-label="Where you work, a town or zip code">' +
        '</label><p class="hv-hint" data-work></p>' : "") +
      '</div>';
  }

  // "60606", "Naperville" or "Naperville, IL 60540" (from the list) all work; returns a zip, null (empty) or undefined (no match)
  function findPlace(text) {
    const s = text.trim().toLowerCase();
    if (!s) return null;
    const zip = s.match(/\b\d{5}\b/);
    if (zip) return places.some((p) => p.zip === zip[0]) ? zip[0] : undefined;
    const hit = places.find((p) => p.label.toLowerCase().startsWith(s));
    return hit ? hit.zip : undefined;
  }

  function personForm(k) {
    const fs = document.createElement("fieldset");
    fs.className = "hv-person";
    fs.innerHTML =
      '<legend>' + (k === 0 ? "You" : "Person 2") + '</legend>' +
      '<p class="hv-intro">Type the value you want, then slide how much it matters. These are your preferences: they change the fit score, not the price estimate.</p>' +
      '<p class="hv-sample" data-sample><span><b>Sample values.</b> Change them to yours.</span><span><b>Your values.</b> Edited from the sample.</span></p>' +
      ORDER.map(row).join("") +
      '<div class="hv-buttons"><button class="btn small" type="button" data-fill>Use sample values</button>' +
      '<button class="btn small" type="button" data-clear>Clear</button>' +
      (k === 1 ? '<button class="btn small" type="button" data-remove>Remove person 2</button>' : "") + '</div>';
    fs.addEventListener("input", (e) => steady(e.target, update));
    const fill = fs.querySelector("[data-fill]");
    fill.addEventListener("click", () => steady(fill, () => { fillSample(fs); update(); }));
    const clear = fs.querySelector("[data-clear]");
    clear.addEventListener("click", () => steady(clear, () => {
      fs.querySelectorAll("input[type=range]").forEach((el) => { el.value = 2; });
      fs.querySelectorAll("input[type=text]").forEach((el) => { el.value = ""; });
      update();
    }));
    const remove = fs.querySelector("[data-remove]");
    if (remove) remove.addEventListener("click", () => steady(addBtn, () => { fs.remove(); addBtn.hidden = false; setView(0); }));
    label(fs);
    fillSample(fs);
    return fs;
  }

  // Names, hints, units and "typical zip" values, which change with buying or renting
  function label(scope) {
    const fs = factors();
    const rows = data ? data.zips.filter((z) => z[mode]) : [];
    scope.querySelectorAll("[data-name]").forEach((el) => { el.textContent = fs[el.dataset.name].name; });
    scope.querySelectorAll("[data-hint]").forEach((el) => { el.textContent = fs[el.dataset.hint].hint; });
    scope.querySelectorAll("[data-before]").forEach((el) => { el.textContent = fs[el.dataset.before].before; });
    scope.querySelectorAll("[data-after]").forEach((el) => { el.textContent = fs[el.dataset.after].after; });
    scope.querySelectorAll("[data-typical]").forEach((el) => {
      const i = Number(el.dataset.typical);
      if (!rows.length) return;
      const v = rows.map((z) => z[mode][i]).filter((x) => x != null).sort((a, b) => a - b);
      el.textContent = "Typical zip: " + fs[i].before + fmt(v[v.length >> 1], fs[i].digits) + (fs[i].after ? " " + fs[i].after : "") + ".";
    });
    scope.querySelectorAll("input[type=range]").forEach((el) => {
      el.setAttribute("aria-label", "How much " + fs[el.name.slice(1)].name.toLowerCase() + " matters");
    });
    scope.querySelectorAll("input[name^=t]").forEach((el) => {
      const i = Number(el.name.slice(1));
      el.setAttribute("aria-label", fs[i].name + " target" + (fs[i].after ? ", " + fs[i].after : ", dollars"));
      el.placeholder = i === 5 ? "e.g. " + fs[5].example : "";
    });
  }

  // The sample values (SAMPLE in src/value.py)
  function sampleText() {
    const s = data.sample[mode];
    return { targets: s.targets.map((t) => t.toLocaleString()), sliders: s.weights.map((w) => String(WEIGHTS.findIndex((st) => st.weight === w))), work: placeName(s.workplace) };
  }

  function fillSample(fs) {
    if (!data) return;
    const s = sampleText();
    s.targets.forEach((t, i) => { fs.elements["t" + i].value = t; });
    s.sliders.forEach((v, i) => { fs.elements["w" + i].value = v; });
    fs.elements.work.value = s.work;
  }

  // The note says "sample values" while every field still holds its sample value. Both
  // wordings sit in one grid cell, so the form doesn't jump when the note changes.
  function markSample(fs) {
    const s = data && sampleText();
    const on = !!s && fs.elements.work.value === s.work &&
      s.targets.every((t, i) => fs.elements["t" + i].value === t) && s.sliders.every((v, i) => fs.elements["w" + i].value === v);
    fs.querySelector("[data-sample]").classList.toggle("on", on);
  }

  // "350k", "$1,500" and "30" all work
  function parse(text) {
    const s = text.trim().toLowerCase().replace(/[$,\s]/g, "");
    if (!s) return null;
    const x = parseFloat(s) * (s.endsWith("k") ? 1000 : 1);
    return Number.isFinite(x) ? x : null;
  }

  function readPerson(fs) {
    const f = fs.elements;
    const steps = ALL.map((i) => WEIGHTS[Number(f["w" + i].value)]);
    steps.forEach((st, i) => { f["w" + i].nextElementSibling.textContent = st.word; });
    const workplace = findPlace(f.work.value);
    const note = fs.querySelector("[data-work]");
    note.textContent = workplace ? "Drive time to " + placeName(workplace) + ", no traffic." :
      workplace === undefined ? "No match. Try a zip code." : "";
    return { weights: steps.map((st) => st.weight), targets: ALL.map((i) => parse(f["t" + i].value)), workplace };
  }

  function setView(v) {
    view = v;
    viewEl.hidden = peopleEl.querySelectorAll(".hv-person").length < 2;
    viewEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.view) === view)));
    update();
  }

  function setLens(l) {
    lens = l === "value" && valueOk() ? "value" : "fit";
    lensEl.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.lens === lens));
      if (b.dataset.lens === "value") b.disabled = !valueOk();
    });
    $("hv-lens-note").hidden = valueOk();
    draw();
  }

  const ps = () => [...peopleEl.querySelectorAll(".hv-person")].map(readPerson);
  const placeName = (zip) => (places.find((p) => p.zip === zip) || { label: zip }).label;
  const who = (k) => (k === 0 ? "You" : "Person 2");

  // ---- Scoring

  // What's still missing before a person can be scored, as text, or null when they're ready
  function missing(p, w) {
    if (p.weights.every((x) => x === 0)) return w + " set everything to Ignore, so give at least one thing a weight.";
    const need = factors().filter((f, i) => p.weights[i] > 0 && p.targets[i] == null).map((f) => f.name.toLowerCase());
    if (p.workplace === undefined) return w + " named a workplace the map doesn't know.";
    if (!need.length) return null;
    return w + " still need" + (w === "You" ? "" : "s") + " a target for " + listJoin(need) + ".";
  }

  // Runs fn without moving el on screen. The summary, the lines under it and the legend sit
  // above the form on a phone and change height as the reader edits; Safari doesn't keep the
  // scroll position anchored itself (and .hv turns that off elsewhere for consistency), so this
  // scrolls back by however far el moved.
  function steady(el, fn) {
    const before = el.getBoundingClientRect().top;
    fn();
    const moved = el.getBoundingClientRect().top - before;
    if (moved) window.scrollBy(0, moved);
  }

  function update() {
    if (!data) return;
    const people = ps();
    peopleEl.querySelectorAll(".hv-person").forEach(markSample);
    const gaps = people.map((p, k) => missing(p, who(k))).filter(Boolean);
    root.classList.toggle("hv-unscored", gaps.length > 0);
    if (gaps.length) {
      result = null;
      lastPicks = null;
      draw();
      tableEl.innerHTML = "";
      driversEl.innerHTML = "";
      summaryEl.innerHTML = "<b>Not scored yet.</b> " + esc(gaps.join(" ")) + " Set a weight to Ignore to skip it.";
      showDetail();
      return;
    }
    result = window.HVModel.run(data.zips, mode, people, data.top, drive);
    if (view >= people.length && view !== 2) view = 0;
    // What the last change did to the top list (only when the change was to the targets or weights)
    const { picks } = current();
    const context = mode + "|" + view + "|" + people.length;
    if (lastPicks && context === lastContext) {
      const c = window.HVModel.changes(lastPicks, picks);
      if (c.added.length) {
        const names = (zs) => listJoin(zs.slice(0, 3).map((z) => esc(name(byZip.get(z)))) .concat(zs.length > 3 ? [zs.length - 3 + " more"] : []));
        changeNote = "<b>Your last change</b> brought " + names(c.added) + " into the top " + data.top + " and pushed out " + names(c.removed) + ".";
      } else changeNote = lastPicks.size ? "<b>Your last change</b> kept the same top " + data.top + " (the order may have moved)." : "";
    } else changeNote = "";
    lastPicks = picks;
    lastContext = context;
    draw();
    fillTable();
    summarize(people);
    showDetail();
  }

  function current() {
    if (view === 2 && result.both) return { picks: result.both, score: (r) => r.both, ranked: (r) => r.bothRanked, label: "best for both", k: null };
    const k = Math.min(view, result.picks.length - 1);
    return { picks: result.picks[k], score: (r) => r.scores[k], ranked: (r) => r.ranked[k], label: k === 0 ? "your" : "person 2's", k };
  }

  // Ranks among ranked zips under the current view
  function ranks() {
    const { score, ranked } = current();
    const order = result.rows.filter((r) => ranked(r) && score(r) != null).sort((a, b) => score(b) - score(a));
    return new Map(order.map((r, i) => [r.zip, i + 1]));
  }

  function summarize(people) {
    const { picks, score, ranked } = current();
    const rows = result.rows.filter((r) => picks.has(r.zip)).sort((a, b) => score(b) - score(a));
    const what = mode === "buy" ? "to buy" : "to rent";
    const unranked = result.rows.filter((r) => !ranked(r)).length;
    const head = view === 2 && people.length > 1 ? "Best " + picks.size + " " + what + " for both of you" : (view === 1 ? "Person 2's" : "Your") + " top " + picks.size + " " + what;
    if (!rows.length) {
      summaryEl.innerHTML = "<b>No zip has enough data to rank.</b> Lower the weight of a factor with gaps (usually safety) and try again.";
    } else {
      const best = rows[0];
      let text = "<b>" + head + ".</b> Best fit: " + esc(name(best)) + " (" + Math.round(score(best)) + " of 100). " +
        result.rows.length + " zips scored";
      text += unranked ? "; " + unranked + " not ranked because data is missing for a factor carrying over " + Math.round((1 - data.min_coverage) * 100) + "% of the weight." : ".";
      if (valueOk()) {
        const vs = rows.map((r) => r.value).filter(Boolean);
        const below = vs.filter((v) => v.cls === "below").length, above = vs.filter((v) => v.cls === "above").length;
        text += " Of the top " + rows.length + ", " + below + " sell below the price their measured features predict and " + above + " above it.";
      }
      summaryEl.innerHTML = text;
    }
    drivers(people);
  }

  // What drives the score: each factor's share of the weight, factors that move together, and what the last change did
  function drivers(people) {
    const fs = factors();
    const lines = people.map((p, k) => {
      if (view !== 2 && k !== Math.min(view, people.length - 1)) return "";
      const total = p.weights.reduce((s, w) => s + w, 0);
      const parts = ORDER.filter((i) => p.weights[i] > 0).sort((a, b) => p.weights[b] - p.weights[a])
        .map((i) => '<span class="hv-share"><span class="hv-share-bar" style="width:' + Math.round((p.weights[i] / total) * 60) + 'px"></span>' +
          esc(fs[i].name) + " " + Math.round((p.weights[i] / total) * 100) + "%</span>");
      return "<p><b>" + (people.length > 1 ? who(k) + ": w" : "W") + "hat your score is made of</b> (share of your weights): " + parts.join(" ") + "</p>";
    });
    // Strongly related pairs among the factors one person weights (Spearman correlation across zips, |rho| >= 0.6)
    const corr = data.factor_correlation;
    const p = people[Math.min(view === 2 ? 0 : view, people.length - 1)];
    const pairs = [];
    for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) {
      // Price is left out: it's a cost, not a feature, and it's meant to go with quality
      if (a === 5 || b === 5 || (p.workplace && (a === 2 || b === 2))) continue;
      if (p.weights[a] > 0 && p.weights[b] > 0 && Math.abs(corr.spearman[a][b]) >= 0.6)
        pairs.push(fs[a].name.toLowerCase() + " and " + fs[b].name.toLowerCase() + " (ρ = " + corr.spearman[a][b].toFixed(2).replace("-", "−") + ")");
    }
    if (pairs.length) lines.push('<p class="hv-note hv-related">Related factors: ' + esc(listJoin(pairs)) + " go together across zips, so weighting both counts much the same thing twice. Consider weighting just one.</p>");
    if (changeNote) lines.push('<p class="hv-note">' + changeNote + "</p>");
    driversEl.innerHTML = lines.join("");
  }

  // ---- Map

  function frame(el, width, height, marks, label, extra = {}) {
    const plot = Plot.plot({
      width, height, margin: 4,
      style: { background: "transparent", color: css("--muted"), fontFamily: css("--font"), fontSize: "11px" },
      marks, ...extra,
    });
    plot.setAttribute("aria-label", label);
    plot.setAttribute("role", "img");
    // Click (or tap) a zip to open its details
    plot.addEventListener("click", () => {
      const v = plot.value;
      const zip = v && (v.id || v.zip);
      if (zip && byZip.has(zip)) select(zip, false);
    });
    el.replaceChildren(plot);
  }

  function valueColor() {
    return d3.scaleLinear().domain([-0.4, 0, 0.4]).range(["--hv-below", "--hv-mid", "--hv-above"].map(css)).interpolate(d3.interpolateLab).clamp(true);
  }

  function draw() {
    drawMap();
    drawChart();
  }

  function drawMap() {
    const width = mapEl.clientWidth;
    if (!geo || width < 200) return;
    const bg = css("--bg");
    const feats = geo.features;
    const projection = { type: "mercator", domain: geo };
    const height = Math.round(width * 1.12);
    if (!result) {
      // Before the reader has set their targets: every zip in one neutral color
      legend(null);
      return frame(mapEl, width, height, [
        Plot.geo(feats, { fill: css("--hv-none"), stroke: bg, strokeWidth: 0.5 }),
        stationDots(width, bg),
        ...zipTip(feats, width, { fill: bg, stroke: css("--border"), title: (f) => { const z = byZip.get(f.id); return z ? name(z) + " " + z.zip : "Zip " + f.id; } }),
      ], "Map of Chicago-area zip codes. Nothing is scored yet.", { projection });
    }

    const { picks, score, ranked, label } = current();
    const scored = new Map(result.rows.map((r) => [r.zip, r]));
    const value = lens === "value";
    const rank = ranks();
    const inSample = feats.filter((f) => scored.has(f.id) && (value ? scored.get(f.id).value : ranked(scored.get(f.id))));
    const rest = feats.filter((f) => !inSample.includes(f));
    let fill, opacity = 1;
    if (value) {
      const color = valueColor();
      fill = (f) => color(scored.get(f.id).value.gap);
      opacity = (f) => (scored.get(f.id).value.conf === "low" ? 0.4 : 1);
      legend("value");
    } else {
      // Red (lowest ranked score on the map) through orange and yellow to green (highest)
      const [lo, hi] = d3.extent(inSample.map((f) => score(scored.get(f.id))));
      const color = d3.scaleLinear().domain([0, 1, 2, 3].map((i) => lo + (i / 3) * (hi - lo)))
        .range(["--hv-0", "--hv-1", "--hv-2", "--hv-3"].map(css)).interpolate(d3.interpolateLab);
      fill = (f) => color(score(scored.get(f.id)));
      legend("fit", lo, hi);
    }
    const two = result.picks.length > 1;
    const sel = feats.filter((f) => f.id === selected);

    frame(mapEl, width, height, [
      Plot.geo(rest, { fill: css("--hv-none"), stroke: bg, strokeWidth: 0.5 }),
      Plot.geo(inSample, { fill, fillOpacity: opacity, stroke: bg, strokeWidth: 0.5 }),
      // The top areas: a soft blue glow, a halo in the page color, then a crisp blue outline (Tango sky blue reads on red to green)
      ...topMarks(feats.filter((f) => picks.has(f.id)), bg),
      Plot.geo(sel, { fill: "none", stroke: css("--text"), strokeWidth: 2.5 }),
      stationDots(width, bg),
      ...zipTip(feats, width, {
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
            ...ps().map((p, k) => p.workplace ? (two ? who(k) + ": " : "") + Math.round(r.commutes[k]) + " min drive to " + placeName(p.workplace) : null),
            mode === "buy" ? money(r.buy[5]) + " median sale price" : money(r.rent[5]) + " rent per person a month",
            r.value && mode === "buy" ? "Price per sq ft " + gapText(r.value.gap) + " (" + CONF[r.value.conf].toLowerCase() + " confidence)" : null,
            "Click for details",
          ].filter(Boolean).join("\n");
        },
      }),
    ], "Map of Chicago-area zip codes colored by " + (value ? "price per square foot compared with the expected price, blue for below and purple for above" : "fit score, red for low to green for high") +
      ". The top " + data.top + " fits are outlined in blue and listed in the table below. Small dark dots are train stations.", { projection });
  }

  // Legend: the color key changes with the lens, and always says what the numbers are
  function legend(kind, lo, hi) {
    const station = '<li><span class="hv-key station"></span>Train station</li>';
    const none = '<li><span class="hv-key none"></span>' + (kind === "value" ? "No price estimate" : kind ? "Not ranked or not in the sample (too little data)" : "Zip code") + "</li>";
    if (!kind) { legendEl.innerHTML = none + station; return; }
    const pick = '<li><span class="hv-key pick"></span>Top ' + data.top + " fit</li>";
    if (kind === "fit") {
      legendEl.innerHTML = '<li><span class="hv-num">' + Math.round(lo) + '</span><span class="hv-key ramp"></span><span class="hv-num">' + Math.round(hi) +
        "</span>Fit score (0 to 100; colors span this map's range)</li>" + pick + none + station;
    } else {
      legendEl.innerHTML = '<li><span class="hv-num">−40%</span><span class="hv-key diverge"></span><span class="hv-num">+40%</span>Price per sq ft vs expected (below · in line · above)</li>' +
        '<li><span class="hv-key faded"></span>Faded: low confidence</li>' + pick + none + station;
    }
  }

  // The detail box for the zip under the pointer. It sits next to the zip, but on a
  // narrow map it would run off the screen, so there it stays in the top-left corner
  // and the zip itself gets an outline.
  function zipTip(feats, width, options) {
    if (width >= 560) return [Plot.tip(feats, Plot.pointer(Plot.centroid(options)))];
    const centers = new Map(feats.map((f) => [f.id, d3.geoCentroid(f)]));
    const at = { px: (f) => centers.get(f.id)[0], py: (f) => centers.get(f.id)[1] };
    return [
      Plot.geo(feats, Plot.pointer({ ...at, fill: "none", stroke: css("--text"), strokeWidth: 2 })),
      Plot.tip(feats, Plot.pointer({ ...options, ...at, frameAnchor: "top-left", anchor: "top-left", pointerSize: 0 })),
    ];
  }

  // Metra, CTA 'L' and South Shore Line stations: small dots in the text color with a ring in the page color
  function stationDots(width, bg) {
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

  // ---- Fit vs price chart (buyers): your fit score across, price vs expected up and down

  function drawChart() {
    const box = $("hv-chart-box");
    box.hidden = !result || !valueOk();
    if (box.hidden) return;
    const width = chartEl.clientWidth;
    if (width < 200) return;
    const { picks, score, ranked } = current();
    const rows = result.rows.filter((r) => r.value && ranked(r) && score(r) != null);
    const rank = ranks();
    const cut = Math.min(...rows.filter((r) => picks.has(r.zip)).map(score));
    const color = valueColor();
    const y = (r) => Math.max(-60, Math.min(60, r.value.gap * 100));
    const x0 = d3.min(rows, score);
    const bg = css("--bg");
    const narrow = width < 560;   // phones: a taller chart and shorter labels, so nothing collides
    // Labels get a halo in the page color so they stay readable over the dots
    const halo = { stroke: bg, strokeWidth: 4, paintOrder: "stroke" };
    frame(chartEl, width, Math.min(420, Math.round(width * (narrow ? 0.95 : 0.7))), [
      Plot.ruleY([0], { stroke: css("--border") }),
      Plot.rectY([0], { x1: x0, x2: 100, y1: -100 * data.value_model.in_line_band, y2: 100 * data.value_model.in_line_band, fill: css("--border"), fillOpacity: 0.35 }),
      Plot.ruleX([cut], { stroke: css("--hv-top"), strokeDasharray: "4,3" }),
      Plot.dot(rows, { x: score, y, r: (r) => (picks.has(r.zip) ? 5 : 3.5), fill: (r) => color(r.value.gap), fillOpacity: (r) => (r.value.conf === "low" ? 0.35 : 0.9),
        stroke: (r) => (r.zip === selected ? css("--text") : picks.has(r.zip) ? css("--hv-top") : css("--muted")), strokeWidth: (r) => (r.zip === selected || picks.has(r.zip) ? 2 : 0.5) }),
      // Left of the dashed line, pointing at it, so it never runs past the right edge
      Plot.text([[(narrow ? "Top " : "Your top ") + data.top + " →"]], { x: cut, frameAnchor: "top", dx: -6, dy: 4, textAnchor: "end", text: (d) => d[0], fill: css("--hv-top"), ...halo }),
      Plot.text([narrow ? "Cheaper than predicted" : "Cheaper than its features predict"], { frameAnchor: "bottom-left", dx: 6, dy: -4, fill: css("--muted"), ...halo }),
      Plot.text([narrow ? "Pricier than predicted" : "Pricier than its features predict"], { frameAnchor: "top-left", dx: 6, dy: 4, fill: css("--muted"), ...halo }),
      Plot.tip(rows, Plot.pointer({ x: score, y, fill: bg, stroke: css("--border"),
        title: (r) => name(r) + " " + r.zip + "\nFit " + Math.round(score(r)) + (rank.has(r.zip) ? " (#" + rank.get(r.zip) + ")" : "") +
          "\n$" + Math.round(r.value.ppsf) + "/sq ft vs $" + Math.round(r.value.expected) + " expected: " + gapText(r.value.gap) +
          "\n" + CONF[r.value.conf] + " confidence\nClick for details" })),
    ], "Scatter chart of " + rows.length + " ranked zips: fit score across, price per square foot compared with the expected price up and down.", {
      marginLeft: 44, marginBottom: 36, marginTop: 20, marginRight: 12,
      x: { label: "Fit to your targets →", domain: [x0, 100], nice: false },
      y: { label: "↑ Price vs expected (%)", domain: [-60, 60], tickFormat: (d) => (d > 0 ? "+" : "") + d + "%" },
    });
    $("hv-chart-note").innerHTML = "Each dot is a ranked zip. Right of the dashed line are your top " + data.top +
      ". The shaded band is ±" + Math.round(data.value_model.in_line_band * 100) + "%, where a price counts as in line. Faded dots: low confidence. Gaps beyond ±60% are drawn at the edge.";
  }

  // ---- Table: the top list or every zip, sortable, with a filter

  function fillTable() {
    const { picks, score, ranked } = current();
    const two = result.picks.length > 1;
    const rank = ranks();
    const showAll = listShow.value === "all";
    const q = listFilter.value.trim().toLowerCase();
    let rows = result.rows.filter((r) => showAll || picks.has(r.zip))
      .filter((r) => !q || (name(r) + " " + r.zip).toLowerCase().includes(q));
    const works = ps().map((p, k) => (p.workplace ? k : null)).filter((k) => k != null);
    const cols = [
      { key: "rank", head: "#", val: (r) => rank.get(r.zip) ?? Infinity, cell: (r) => rank.get(r.zip) ?? "–" },
      { key: "place", head: "Place", val: (r) => name(r), cell: (r) => '<button class="hv-link" type="button" data-zip="' + r.zip + '">' + esc(name(r)) + "</button>" },
      { key: "zip", head: "Zip", val: (r) => r.zip, cell: (r) => r.zip },
      { key: "score", head: view === 2 && two ? "Fit, both" : "Fit", val: (r) => score(r) ?? -1, cell: (r) => "<b>" + (score(r) == null ? "–" : Math.round(score(r))) + "</b>" },
      ...(two ? [0, 1].map((k) => ({ key: "s" + k, head: who(k), val: (r) => r.scores[k] ?? -1, cell: (r) => (r.scores[k] == null ? "–" : Math.round(r.scores[k])) })) : []),
      ...works.map((k) => ({ key: "d" + k, head: (two ? who(k) + " drive" : "Drive"), val: (r) => r.commutes[k] ?? Infinity, cell: (r) => (r.commutes[k] == null ? "–" : Math.round(r.commutes[k]) + " min") })),
      { key: "price", head: mode === "buy" ? "Price" : "Rent each", val: (r) => r[mode][5] ?? Infinity, cell: (r) => (r[mode][5] == null ? "–" : money(r[mode][5])) },
      ...(valueOk() ? [
        { key: "gap", head: "Price vs expected", val: (r) => r.value?.gap ?? Infinity, cell: (r) => r.value ? '<span class="hv-gap hv-' + r.value.cls + '">' + (r.value.gap > 0 ? "+" : "−") + pctText(r.value.gap) + "</span>" : "–" },
        { key: "conf", head: "Confidence", val: (r) => ({ high: 0, medium: 1, low: 2 })[r.value?.conf] ?? 3, cell: (r) => (r.value ? CONF[r.value.conf] : "–") },
      ] : []),
      { key: "data", head: "Data", val: (r) => -Math.min(...(view === 2 ? r.coverage : [r.coverage[current().k]])), cell: (r) => coverageCell(r) },
      { key: "list", head: "Listings", val: () => 0, cell: (r) => listing(r), nosort: true },
    ];
    const col = cols.find((c) => c.key === sortKey) || cols[0];
    rows = rows.sort((a, b) => { const x = col.val(a), y = col.val(b); return (x < y ? -1 : x > y ? 1 : 0) * sortDir; });
    if (!rows.length) {
      tableEl.innerHTML = '<caption>' + (q ? "No zip matches “" + esc(q) + "”." : "Nothing to list.") + "</caption>";
      return;
    }
    // Phones hide the header row, so a small menu sorts instead
    sortPick.innerHTML = cols.filter((c) => !c.nosort).map((c) => '<option value="' + c.key + '"' + (c.key === sortKey ? " selected" : "") + ">" + (c.key === "rank" ? "Rank" : c.head) + "</option>").join("");
    const head = "<thead><tr>" + cols.map((c) => c.nosort ? "<th>" + c.head + "</th>" :
      '<th aria-sort="' + (c.key === sortKey ? (sortDir > 0 ? "ascending" : "descending") : "none") + '"><button type="button" class="hv-sort" data-sort="' + c.key + '">' + c.head +
      (c.key === sortKey ? (sortDir > 0 ? " ▲" : " ▼") : "") + "</button></th>").join("") + "</tr></thead>";
    const total = rows.length;
    if (showAll && !showEvery) rows = rows.slice(0, PAGE);
    const body = rows.map((r) => '<tr' + (r.zip === selected ? ' class="hv-selected"' : "") + (!ranked(r) ? ' class="hv-dim"' : "") + ">" +
      cols.map((c) => '<td class="c-' + c.key + '" data-label="' + c.head + '">' + c.cell(r) + "</td>").join("") + "</tr>").join("");
    tableEl.innerHTML = "<caption>" + (showAll ? total + " zips" + (q ? " matching “" + esc(q) + "”" : "") + (rows.length < total ? ", showing the first " + rows.length : "") : "Top " + rows.length + " fits") +
      ". Pick a place for its details.</caption>" + head + "<tbody>" + body + "</tbody>" +
      (rows.length < total ? '<tfoot><tr><td colspan="' + cols.length + '"><button class="btn small" type="button" data-more>Show all ' + total + "</button></td></tr></tfoot>" : "");
  }

  // Data coverage: a check when every weighted factor is measured, else what's missing
  function coverageCell(r) {
    const people = ps();
    const ks = view === 2 ? people.map((_, k) => k) : [current().k];
    const gaps = new Set();
    ks.forEach((k) => r.close[k].forEach((c, i) => { if (c == null && people[k].weights[i] > 0) gaps.add(factors()[i].name.toLowerCase()); }));
    if (!gaps.size) return '<span class="hv-ok" title="Every factor you weight is measured">✓</span>';
    const cov = Math.min(...ks.map((k) => r.coverage[k]));
    return '<span class="hv-warn" title="Left out: ' + esc([...gaps].join(", ")) + '">No ' + esc([...gaps].join(", ")) + " (" + Math.round(cov * 100) + "%)</span>";
  }

  // A Zillow search for homes for sale (buying) or rentals (renting) in the zip, in a new tab
  function listing(r) {
    const url = "https://www.zillow.com/homes/for_" + (mode === "buy" ? "sale" : "rent") + "/" + r.zip + "_rb/";
    return '<a href="' + url + '" target="_blank" rel="noopener" aria-label="' + esc(name(r)) + ", " + (mode === "buy" ? "homes for sale" : "rentals") +
      ' on Zillow (new tab)">Zillow ↗</a>';
  }

  // ---- Detail panel for one zip

  function select(zip, focus) {
    selected = zip;
    draw();
    if (result) fillTable();
    showDetail();
    if (focus) detailEl.querySelector("h3")?.focus();
  }

  function showDetail() {
    if (!selected || !data) {
      detailEl.innerHTML = '<p class="hv-empty">Pick a zip on the map, the chart or the table (or search for one above) to see why it scores what it does.</p>';
      return;
    }
    const z = byZip.get(selected);
    const r = result && result.rows.find((x) => x.zip === selected);
    const fs = factors();
    const people = ps();
    let html = '<div class="hv-detail-head"><h3 tabindex="-1">' + esc(name(z)) + " " + z.zip + '</h3><button class="btn small" type="button" data-close aria-label="Close details">×</button></div>';

    if (!z[mode]) {
      html += "<p>Not in the " + (mode === "buy" ? "buyers' sample: fewer than 20 sales in the past year, no median price, or two missing factors." : "renters' sample: fewer than 100 rented homes, no rent, or two missing factors.") + "</p>";
    } else if (!r) {
      html += "<p>Set your targets to see how this zip scores.</p>";
    } else {
      const rank = ranks();
      people.forEach((p, k) => {
        if (view !== 2 && k !== current().k) return;
        const s = r.scores[k];
        const parts = window.HVModel.explain(r.close[k], p.weights);
        const rk = view === 2 ? null : rank.get(r.zip);
        html += '<section class="hv-block"><h4>' + (people.length > 1 ? who(k) + ": fit" : "Fit to your targets") + ' <span class="hv-big">' + (s == null ? "–" : Math.round(s)) + "</span><span class=\"muted\"> of 100</span></h4>";
        html += "<p class=\"hv-small\">" + (r.ranked[k] ? (rk ? "#" + rk + " of " + rank.size + " ranked zips. " : "") : "<b>Not ranked:</b> ") +
          "Measured factors carry " + Math.round(r.coverage[k] * 100) + "% of " + (k ? "person 2's" : "your") + " weight" +
          (r.ranked[k] ? "." : ", under the " + Math.round(data.min_coverage * 100) + "% needed to rank.") + "</p>";
        html += '<table class="hv-factors"><thead><tr><th>Factor</th><th>This zip</th><th>Target</th><th>Match</th><th>Points lost</th></tr></thead><tbody>' +
          ORDER.filter((i) => p.weights[i] > 0).map((i) => {
            const part = parts[i];
            const v = i === 2 && p.workplace ? r.commutes[k] : r[mode][i];
            const target = (i === 5 && mode === "buy") ? money(p.targets[i]) : factorText(i, p.targets[i]);
            return "<tr><th scope=\"row\">" + esc(fs[i].name) + ' <span class="muted">' + Math.round(part.share * 100) + "%</span></th><td>" +
              (part.missing ? '<span class="hv-warn">no data, left out</span>' : esc(factorText(i, v)) + (i === 2 && p.workplace ? " drive" : "")) +
              "</td><td>" + esc(target) + "</td><td>" + (part.closeness == null ? "–" : '<span class="hv-meter" role="img" aria-label="' + Math.round(part.closeness) + ' of 100"><span style="width:' + part.closeness + '%"></span></span>') +
              "</td><td>" + (part.lost == null ? "–" : part.lost < 0.5 ? "0" : "−" + part.lost.toFixed(1)) + "</td></tr>";
          }).join("") + "</tbody></table>";
        html += '<p class="hv-small">' + why(parts, fs) + "</p></section>";
      });
    }

    // Prices
    const b = z.buy, rent = z.rent, v = z.value;
    html += '<section class="hv-block"><h4>Housing costs</h4><dl class="hv-dl">' +
      (b ? "<dt>Median sale price</dt><dd>" + money(b[5]) + "</dd>" : "") +
      (v ? "<dt>Price per sq ft</dt><dd>$" + Math.round(v.ppsf) + " (" + v.sales + " sales)</dd>" : "") +
      (rent ? "<dt>Rent per person</dt><dd>" + money(rent[5]) + " a month</dd>" : "") +
      "</dl><p class=\"hv-small muted\">Redfin, Jun 2025 to May 2026 (sales); Census ACS 2020–2024 (rent). " + listing(r || z) + "</p></section>";

    // Housing value
    if (mode === "buy") {
      if (v) {
        const lo = v.lo, hi = v.hi;
        html += '<section class="hv-block"><h4>Price vs expected <span class="hv-gap hv-' + v.cls + '">' + esc(CLASS[v.cls]) + "</span></h4>" +
          "<p>Sells for <b>$" + Math.round(v.ppsf) + "</b> a sq ft. Zips with the same measured schools, safety, commute, walkability, train access, home age and state sell for about <b>$" +
          Math.round(v.expected) + "</b>, so it is <b>" + gapText(v.gap) + "</b>" +
          " (90% range from price noise alone: " + signed(lo) + " to " + signed(hi) + ").</p>" +
          "<p class=\"hv-small\"><b>Confidence: " + CONF[v.conf] + ".</b> " + (v.issues.length ? v.issues.map((i) => ISSUES[i] ? ISSUES[i](v) : i).join(" ") : "Enough sales, complete data, the same class under the other model versions and with last year's prices.") + "</p>" +
          "<p class=\"hv-small\">Earlier years, same model: " + ["2025", "2024", "2023"].map((y, i) => y + " " + (v.prev[i] == null ? "–" : signed(v.prev[i]))).join(" · ") + ".</p>" +
          '<p class="hv-small muted">Not a bargain signal: a gap also reflects what the model can\'t see, such as lot size, condition, taxes, flood risk or a lake view. See “Price vs expected” below.</p></section>';
      } else {
        html += '<section class="hv-block"><h4>Price vs expected</h4><p class="hv-small">No estimate: the zip isn\'t in the buyers\' sample or has no price per sq ft.</p></section>';
      }
    }

    // Data behind it
    const notes = [];
    if (z.crime) notes.push("Crime: " + z.crime[0] + (z.crime[1] === "city" ? ", this zip's share of Chicago's FBI total, placed by the city's incident data." : ", the police agency's rate (FBI)."));
    else notes.push("Crime: no usable FBI data for its police agency.");
    if (z.place === "Chicago") notes.push("Schools: Chicago Public Schools is one district, so every city zip has the same school value.");
    if (z.station) notes.push("Nearest station for most residents: " + z.station + ".");
    html += '<section class="hv-block"><h4>Data notes</h4><ul class="hv-small">' + notes.map((n) => "<li>" + esc(n) + "</li>").join("") + "</ul></section>";
    detailEl.innerHTML = html;
    detailEl.querySelector("[data-close]").addEventListener("click", () => { selected = null; draw(); if (result) fillTable(); showDetail(); });
  }

  const signed = (g) => (g > 0 ? "+" : g < 0 ? "−" : "") + pctText(g);

  // One sentence on why: the factors that cost the most points and the ones right on target
  function why(parts, fs) {
    const idx = ORDER.filter((i) => parts[i].weight > 0 && parts[i].closeness != null);
    const costly = idx.filter((i) => parts[i].lost >= 1).sort((a, b) => parts[b].lost - parts[a].lost);
    const hits = idx.filter((i) => parts[i].closeness >= 99.5);
    const missingNames = ORDER.filter((i) => parts[i].missing).map((i) => fs[i].name.toLowerCase());
    let s = hits.length ? "On target for " + listJoin(hits.map((i) => fs[i].name.toLowerCase())) + ". " : "";
    s += costly.length ? "Loses the most on " + listJoin(costly.slice(0, 2).map((i) => fs[i].name.toLowerCase() + " (−" + parts[i].lost.toFixed(1) + ")")) + "." : "Close to every target.";
    if (missingNames.length) s += " Left out for missing data: " + listJoin(missingNames) + ".";
    return esc(s);
  }

  // ---- Buying / renting

  function setMode(m) {
    if (m === mode) return;
    const old = data ? sampleText().targets[5] : null;
    mode = m;
    document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    // A sale price and a monthly rent aren't the same target, so the price box starts over:
    // with the new sample price if it held the old one, otherwise empty
    peopleEl.querySelectorAll(".hv-person").forEach((fs) => {
      fs.elements.t5.value = data && fs.elements.t5.value === old ? sampleText().targets[5] : "";
    });
    label(peopleEl);
    lastPicks = null;
    result = null;   // the old results are for the other mode
    update();
    setLens(lens);
  }

  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => steady(b, () => setMode(b.dataset.mode))));
  lensEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => steady(b, () => setLens(b.dataset.lens))));
  viewEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => steady(b, () => setView(Number(b.dataset.view)))));
  addBtn.addEventListener("click", () => steady(peopleEl, () => {
    peopleEl.append(personForm(1));
    addBtn.hidden = true;
    setView(2);
  }));
  listShow.addEventListener("change", () => { showEvery = false; if (result) fillTable(); });
  sortPick.addEventListener("change", () => {
    sortKey = sortPick.value;
    sortDir = ["score", "s0", "s1"].includes(sortKey) ? -1 : 1;   // best fit first; everything else low to high
    if (result) fillTable();
  });
  listFilter.addEventListener("input", () => result && fillTable());
  tableEl.addEventListener("click", (e) => {
    const s = e.target.closest("[data-sort]");
    if (s) {
      const key = s.dataset.sort;
      sortDir = key === sortKey ? -sortDir : (["score", "s0", "s1"].includes(key) ? -1 : 1);
      sortKey = key;
      fillTable();
      tableEl.querySelector('[data-sort="' + key + '"]')?.focus();
      return;
    }
    if (e.target.closest("[data-more]")) { showEvery = true; fillTable(); return; }
    const z = e.target.closest("[data-zip]");
    if (z) select(z.dataset.zip, true);
  });
  findEl.addEventListener("change", () => {
    const zip = findPlace(findEl.value);
    findNote.textContent = zip === undefined ? "No match. Try a zip code." : "";
    if (zip) select(zip, true);
  });

  // Redraw when the theme changes (js/theme.js swaps .light/.dark on <html>) or the width does
  new MutationObserver(() => draw()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  let lastWidth = 0;
  new ResizeObserver(() => {
    if (mapEl.clientWidth === lastWidth) return;
    lastWidth = mapEl.clientWidth;
    draw();
  }).observe(mapEl);

  // ---- Methods: tables filled from the data file, so every number on the page traces to src/value_gap.py

  function methods() {
    const m = data.value_model;
    const pct = (x) => Math.round(x * 100) + "%";
    const val = (kind) => Object.entries(m.validation[kind]);
    $("hv-validation").innerHTML = "<caption>How well each model predicts zips it didn't see (" + m.n + " zips). Lower error is better. R² is the share of the variation in price it explains, from 0 to 1.</caption>" +
      "<thead><tr><th>Model</th><th>Typical error, random folds</th><th>R², random</th><th>Typical error, spatial folds</th><th>R², spatial</th></tr></thead><tbody>" +
      val("random_10_fold").map(([k, v]) => {
        const s = m.validation.spatial_10_fold[k];
        return "<tr" + (k.startsWith("This model:") ? ' class="hv-selected"' : "") + "><td>" + esc(k) + "</td><td>" + v.median_abs_pct_error.toFixed(1) + "%</td><td>" + v.r2_log.toFixed(2) +
          "</td><td>" + s.median_abs_pct_error.toFixed(1) + "%</td><td>" + s.r2_log.toFixed(2) + "</td></tr>";
      }).join("") + "</tbody>";
    $("hv-coefs").innerHTML = "<caption>What each factor does to price per sq ft, holding the others fixed (" + m.n_complete + " zips with every factor). Effect = percent change in price for one more unit of the factor.</caption>" +
      "<thead><tr><th>Term</th><th>Effect</th><th>p (robust)</th><th>p (clustered by county)</th></tr></thead><tbody>" +
      m.coefficients.filter((c) => c.term !== "const").map((c) => "<tr><td>" + esc(c.label) + "</td><td>" + (c.pct_effect > 0 ? "+" : "") + c.pct_effect.toFixed(1) + "%</td><td>" +
        (c.p_hc1 < 0.001 ? "< 0.001" : c.p_hc1.toFixed(3)) + "</td><td>" + (c.p_county < 0.001 ? "< 0.001" : c.p_county.toFixed(3)) + "</td></tr>").join("") + "</tbody>";
    const p = m.persistence, sa = m.spatial_autocorrelation;
    document.querySelectorAll("[data-stat]").forEach((el) => {
      el.textContent = ({
        r2: m.r2_in_sample.toFixed(2), sd: pct(Math.exp(m.loo_residual_sd_log) - 1), n: m.n,
        persist: p["2025"].correlation.toFixed(2), persist23: p["2023"].correlation.toFixed(2), same: pct(p["2025"].same_sign),
        moran: sa.this_model_loo_residuals.moran_i.toFixed(2), moranPre: sa.pre_registered_residuals.moran_i.toFixed(2),
        below: m.classes.below, above: m.classes.above, inline: m.classes.in_line, band: pct(m.in_line_band),
        high: m.confidence.high, medium: m.confidence.medium, low: m.confidence.low,
        se50: pct(Math.sqrt(m.sales_noise_b / 50)), se200: pct(Math.sqrt(m.sales_noise_b / 200)),
      })[el.dataset.stat] ?? el.textContent;
    });
  }

  peopleEl.append(personForm(0));
  showDetail();
  const load = (f) => fetch("/research/chicago-home-value" + f + ".json").then((r) => { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); });
  Promise.all(["", "-zips", "-drive", "-stations"].map(load))
    .then(([json, shapes, times, stops]) => {
      data = json;
      geo = shapes;
      stations = stops;
      byZip = new Map(data.zips.map((z) => [z.zip, z]));
      // Drive times: an n x n grid of whole minutes, row = from, column = to
      const index = new Map(times.zips.map((z, i) => [z, i]));
      const grid = Uint8Array.from(atob(times.minutes), (c) => c.charCodeAt(0));
      drive = (from, to) => (index.has(from) && index.has(to) ? grid[index.get(from) * times.zips.length + index.get(to)] : null);
      places = times.zips.map((z) => ({ zip: z, label: (byZip.get(z)?.place || "Zip") + ", " + (byZip.get(z)?.state || (z[0] === "4" ? "IN" : "IL")) + " " + z }))
        .sort((a, b) => a.label.localeCompare(b.label));
      $("hv-places").innerHTML = places.map((p) => '<option value="' + esc(p.label) + '">').join("");
      root.classList.remove("hv-loading");
      label(peopleEl);
      peopleEl.querySelectorAll(".hv-person").forEach(fillSample);
      setLens("fit");
      methods();
      update();
    })
    .catch(() => {
      root.classList.remove("hv-loading");
      summaryEl.innerHTML = "<b>The map could not load.</b> Check your connection and <a href=\"\">reload the page</a>. The data is also in the GitHub repo linked above.";
      mapEl.innerHTML = "";
    });
})();
