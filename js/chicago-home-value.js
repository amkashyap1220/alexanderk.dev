/* ==========================================================================
   Chicago home value: the target map for the post.
   Reads /research/chicago-home-value.json (per-zip values, made by
   src/site_data.py in the Home-Value-Score repo) and
   /research/chicago-home-value-zips.json (zip shapes, src/map.py), scores the
   zips with js/chicago-home-value-model.js and draws them with Observable Plot.

   The reader picks buying or renting, sets a target and a weight for each
   factor, can name where they work (commute becomes the drive time there,
   from /research/chicago-home-value-drive.json, src/commute.py), and can add
   a second person. The form starts with sample values; a factor that counts
   needs a target before anything is scored. Every change rescores and redraws
   the map and the table, whose place names link to Zillow listings. Colors come from the site's CSS variables, so the map
   redraws when the theme or the width changes.
   ========================================================================== */

(function () {
  const root = document.getElementById("hv");
  if (!root || !window.Plot || !window.HVModel) return;
  const mapEl = document.getElementById("hv-map");
  const tableEl = document.getElementById("hv-table");
  const summaryEl = document.getElementById("hv-summary");
  const peopleEl = document.getElementById("hv-people");
  const addBtn = document.getElementById("hv-add");
  const viewEl = document.getElementById("hv-view");

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
  const factors = () => [...FACTORS, PRICE[mode]];
  // The weight slider runs 0 to 4; these are the weights and words for each step
  const WEIGHTS = [
    { weight: 0, word: "Ignore" }, { weight: 0.5, word: "Low" }, { weight: 1, word: "Normal" },
    { weight: 2, word: "High" }, { weight: 3, word: "Top" },
  ];

  let data = null, geo = null, byZip = null;
  let drive = null;        // drive(fromZip, toZip) in minutes, from chicago-home-value-drive.json
  let places = [];         // [{ zip, label }] for the workplace box
  let mode = "buy";
  let view = 0;            // 0 = you, 1 = person 2, 2 = best for both
  let result = null;

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const money = (x) => "$" + Math.round(x).toLocaleString();
  const name = (z) => (z.place || "Zip " + z.zip) + ", " + z.state;
  // digits < 0 rounds to tens, hundreds, thousands...
  const fmt = (x, digits) => (digits < 0 ? Math.round(x / 10 ** -digits) * 10 ** -digits : x)
    .toLocaleString(undefined, { maximumFractionDigits: Math.max(digits, 0) });
  const priceText = (z) => money(z[mode][5]) + (mode === "buy" ? " median sale price" : " rent per person a month");

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

  // "60606", "Naperville" or "Naperville, IL 60540" (from the list) all work; returns a zip or null
  function findWork(text) {
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
      '<p class="hv-intro">Type the value you want, then slide how much it matters.</p>' +
      '<p class="hv-sample" data-sample><span><b>Sample values.</b> Change them to yours.</span><span><b>Your values.</b> Edited from the sample.</span></p>' +
      [0, 1, 2, 3, 4, 5].map(row).join("") +
      '<div class="hv-buttons"><button class="btn small" type="button" data-fill>Use sample values</button>' +
      '<button class="btn small" type="button" data-clear>Clear</button>' +
      (k === 1 ? '<button class="btn small" type="button" data-remove>Remove person 2</button>' : "") + '</div>';
    fs.addEventListener("input", update);
    fs.querySelector("[data-fill]").addEventListener("click", () => { fillSample(fs); update(); });
    fs.querySelector("[data-clear]").addEventListener("click", () => {
      fs.querySelectorAll("input[type=range]").forEach((el) => { el.value = 2; });
      fs.querySelectorAll("input[type=text]").forEach((el) => { el.value = ""; });
      update();
    });
    const remove = fs.querySelector("[data-remove]");
    if (remove) remove.addEventListener("click", () => { fs.remove(); addBtn.hidden = false; setView(0); });
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

  // The sample values (SAMPLE in src/value.py): typical targets, every weight Normal, a job in the Loop
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
    const steps = [0, 1, 2, 3, 4, 5].map((i) => WEIGHTS[Number(f["w" + i].value)]);
    steps.forEach((st, i) => { f["w" + i].nextElementSibling.textContent = st.word; });
    const workplace = findWork(f.work.value);
    const note = fs.querySelector("[data-work]");
    note.textContent = workplace ? "Drive time to " + placeName(workplace) + ", no traffic." :
      workplace === undefined ? "No match. Try a zip code." : "";
    return { weights: steps.map((st) => st.weight), targets: [0, 1, 2, 3, 4, 5].map((i) => parse(f["t" + i].value)), workplace };
  }

  function setView(v) {
    view = v;
    viewEl.hidden = peopleEl.querySelectorAll(".hv-person").length < 2;
    viewEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.view) === view)));
    update();
  }

  const ps = () => [...peopleEl.querySelectorAll(".hv-person")].map(readPerson);
  const placeName = (zip) => (places.find((p) => p.zip === zip) || { label: zip }).label;

  // ---- Scoring

  // What's still missing before a person can be scored, as text, or null when they're ready
  function missing(p, who) {
    if (p.weights.every((w) => w === 0)) return who + " set everything to Ignore, so give at least one thing a weight.";
    const need = factors().filter((f, i) => p.weights[i] > 0 && p.targets[i] == null).map((f) => f.name.toLowerCase());
    if (p.workplace === undefined) return who + " named a workplace the map doesn't know.";
    if (!need.length) return null;
    return who + " still need" + (who === "You" ? "" : "s") + " a target for " + need.join(", ").replace(/, ([^,]*)$/, " and $1") + ".";
  }

  function update() {
    if (!data) return;
    const people = ps();
    peopleEl.querySelectorAll(".hv-person").forEach(markSample);
    const gaps = people.map((p, k) => missing(p, k === 0 ? "You" : "Person 2")).filter(Boolean);
    root.classList.toggle("hv-unscored", gaps.length > 0);
    if (gaps.length) {
      result = null;
      draw();
      tableEl.innerHTML = "";
      summaryEl.innerHTML = "<b>Not scored yet.</b> " + gaps.join(" ") + " Set a weight to Ignore to skip it.";
      return;
    }
    result = window.HVModel.run(data.zips, mode, people, data.top, drive);
    if (view >= people.length && view !== 2) view = 0;
    draw();
    fillTable();
    summarize(people.length);
  }

  function current() {
    if (view === 2 && result.both) return { picks: result.both, score: (r) => r.both, label: "best for both" };
    const k = Math.min(view, result.picks.length - 1);
    return { picks: result.picks[k], score: (r) => r.scores[k], label: k === 0 ? "your" : "person 2's" };
  }

  function summarize(n) {
    const { picks, score } = current();
    const rows = result.rows.filter((r) => picks.has(r.zip)).sort((a, b) => score(b) - score(a));
    const what = mode === "buy" ? "to buy" : "to rent";
    const best = rows[0];
    const who = view === 2 && n > 1 ? "Best " + picks.size + " " + what + " for both of you" : (view === 1 ? "Person 2's" : "Your") + " top " + picks.size + " " + what;
    summaryEl.innerHTML = "<b>" + who + ".</b> Best match: " + name(best) + " (" + Math.round(score(best)) + ").";
  }

  // ---- Map

  function frame(width, marks, label) {
    const plot = Plot.plot({
      width,
      height: Math.round(width * 1.12),
      margin: 4,
      projection: { type: "mercator", domain: geo },
      style: { background: "transparent", color: css("--muted"), fontFamily: css("--font"), fontSize: "11px" },
      marks,
    });
    plot.setAttribute("aria-label", label);
    mapEl.replaceChildren(plot);
  }

  function draw() {
    const width = mapEl.clientWidth;
    if (!geo || width < 200) return;
    const bg = css("--bg");
    const feats = geo.features;
    if (!result) {
      // Before the reader has set their targets: every zip in one neutral color
      return frame(width, [
        Plot.geo(feats, { fill: css("--hv-none"), stroke: bg, strokeWidth: 0.5 }),
        ...zipTip(feats, width, {
          fill: bg, stroke: css("--border"),
          title: (f) => {
            const z = byZip.get(f.id);
            return z ? name(z) + " " + z.zip : "Zip " + f.id;
          },
        }),
      ], "Map of Chicago-area zip codes. Nothing is scored yet.");
    }

    const { picks, score, label } = current();
    const scored = new Map(result.rows.map((r) => [r.zip, r]));
    const values = result.rows.map(score);
    // Red (lowest score on the map) through orange and yellow to green (highest)
    const [lo, hi] = d3.extent(values);
    const color = d3.scaleLinear().domain([0, 1, 2, 3].map((i) => lo + (i / 3) * (hi - lo)))
      .range(["--hv-0", "--hv-1", "--hv-2", "--hv-3"].map(css)).interpolate(d3.interpolateLab);
    const rank = new Map([...result.rows].sort((a, b) => score(b) - score(a)).map((r, i) => [r.zip, i + 1]));
    const inSample = feats.filter((f) => scored.has(f.id));
    const two = result.picks.length > 1;

    frame(width, [
      Plot.geo(feats.filter((f) => !scored.has(f.id)), { fill: css("--hv-none"), stroke: bg, strokeWidth: 0.5 }),
      Plot.geo(inSample, { fill: (f) => color(score(scored.get(f.id))), stroke: bg, strokeWidth: 0.5 }),
      // The top areas: a soft blue glow, a halo in the page color, then a crisp blue outline (Tango sky blue reads on red to green)
      ...topMarks(inSample.filter((f) => picks.has(f.id)), bg),
      ...zipTip(inSample, width, {
        fill: bg, stroke: css("--border"),
        title: (f) => {
          const r = scored.get(f.id);
          return [
            name(r) + " " + r.zip,
            (view === 2 && two ? "Score for both " : "Score ") + Math.round(score(r)) + " of 100, #" + rank.get(r.zip) + " of " + result.rows.length +
              (picks.has(r.zip) ? " (in " + label + " top " + data.top + ")" : ""),
            two ? "You " + Math.round(r.scores[0]) + ", person 2 " + Math.round(r.scores[1]) : null,
            ...ps().map((p, k) => p.workplace ? (two ? (k ? "Person 2" : "You") + ": " : "") + Math.round(r.commutes[k]) + " min drive to " + placeName(p.workplace) : null),
            priceText(r),
          ].filter(Boolean).join("\n");
        },
      }),
    ], "Map of " + result.rows.length + " Chicago-area zip codes colored by score, red for low to green for high. " +
      "The top " + data.top + " are outlined in blue and listed in the table below.");
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

  function topMarks(top, bg) {
    const blue = css("--hv-top");
    return [
      Plot.geo(top, { fill: "none", stroke: blue, strokeWidth: 7, strokeOpacity: 0.28, strokeLinejoin: "round" }),
      Plot.geo(top, { fill: "none", stroke: bg, strokeWidth: 3.5, strokeLinejoin: "round" }),
      Plot.geo(top, { fill: "none", stroke: blue, strokeWidth: 2, strokeLinejoin: "round" }),
    ];
  }

  // ---- Table

  function fillTable() {
    const { picks, score } = current();
    const two = result.picks.length > 1;
    const rows = result.rows.filter((r) => picks.has(r.zip)).sort((a, b) => score(b) - score(a));
    const scoreHead = (view === 2 && two ? "<th>Both</th>" : "<th>Score</th>") + (two ? "<th>You</th><th>Person 2</th>" : "");
    // A drive-time column for each person who named a workplace
    const works = ps().map((p, k) => (p.workplace ? k : null)).filter((k) => k != null);
    const driveHead = works.map((k) => "<th>" + (two ? (k ? "Person 2" : "You") + " drive" : "Drive") + "</th>").join("");
    const head = "<thead><tr><th>#</th><th>Place</th><th>Zip</th>" + scoreHead + driveHead + "<th>" + (mode === "buy" ? "Price" : "Rent each") +
      "</th></tr></thead>";
    const body = rows.map((r, i) => "<tr><td>" + (i + 1) + "</td><td>" + listing(r) + "</td><td>" + r.zip + "</td><td><b>" + Math.round(score(r)) + "</b></td>" +
      (two ? "<td>" + Math.round(r.scores[0]) + "</td><td>" + Math.round(r.scores[1]) + "</td>" : "") +
      works.map((k) => "<td>" + Math.round(r.commutes[k]) + " min</td>").join("") +
      "<td>" + money(r[mode][5]) + "</td></tr>").join("");
    tableEl.innerHTML = head + "<tbody>" + body + "</tbody>";
  }

  // A Zillow search for homes for sale (buying) or rentals (renting) in the zip, in a new tab
  function listing(r) {
    const url = "https://www.zillow.com/homes/for_" + (mode === "buy" ? "sale" : "rent") + "/" + r.zip + "_rb/";
    return '<a href="' + url + '" target="_blank" rel="noopener" aria-label="' + name(r) + ", " + (mode === "buy" ? "homes for sale" : "rentals") +
      ' on Zillow (new tab)">' + name(r) + " ↗</a>";
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
    update();
  }

  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  viewEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => setView(Number(b.dataset.view))));
  addBtn.addEventListener("click", () => {
    peopleEl.append(personForm(1));
    addBtn.hidden = true;
    setView(2);
  });

  // Redraw when the theme changes (js/theme.js swaps .light/.dark on <html>) or the width does
  new MutationObserver(() => draw()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  let lastWidth = 0;
  new ResizeObserver(() => {
    if (mapEl.clientWidth === lastWidth) return;
    lastWidth = mapEl.clientWidth;
    draw();
  }).observe(mapEl);

  peopleEl.append(personForm(0));
  Promise.all(["", "-zips", "-drive"].map((f) => fetch("/research/chicago-home-value" + f + ".json").then((r) => r.json())))
    .then(([json, shapes, times]) => {
      data = json;
      geo = shapes;
      byZip = new Map(data.zips.map((z) => [z.zip, z]));
      // Drive times: an n x n grid of whole minutes, row = from, column = to
      const index = new Map(times.zips.map((z, i) => [z, i]));
      const grid = Uint8Array.from(atob(times.minutes), (c) => c.charCodeAt(0));
      drive = (from, to) => (index.has(from) && index.has(to) ? grid[index.get(from) * times.zips.length + index.get(to)] : null);
      places = times.zips.map((z) => ({ zip: z, label: (byZip.get(z)?.place || "Zip") + ", " + (byZip.get(z)?.state || (z[0] === "4" ? "IN" : "IL")) + " " + z }))
        .sort((a, b) => a.label.localeCompare(b.label));
      document.getElementById("hv-places").innerHTML = places.map((p) => '<option value="' + p.label + '">').join("");
      label(peopleEl);
      peopleEl.querySelectorAll(".hv-person").forEach(fillSample);
      update();
    })
    .catch(() => { mapEl.innerHTML = '<p class="muted">The map could not load. The data is in the GitHub repo linked above.</p>'; });
})();
