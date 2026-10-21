/* ==========================================================================
   Chicago home value: the value map for the post.
   Reads /writing/chicago-home-value.json (per-zip factors, made by
   src/site_data.py in the Home-Value-Score repo) and
   /writing/chicago-home-value-zips.json (zip shapes, src/map.py), scores the
   zips with js/chicago-home-value-model.js and draws them with Observable Plot.

   The reader picks buying or renting, sets weights and optional targets, and
   can add a second person. Every change rescores and redraws the map and the
   table. Colors come from the site's CSS variables, so the map redraws when
   the theme or the width changes.
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

  // Each factor: what it measures, and the wording around its optional "must" box
  const FACTORS = [
    { name: "Schools", hint: "District test scores, ranked within the state: 80 means better than 80% of the state's districts.", before: "At least", example: "60", after: "percentile" },
    { name: "Safety", hint: "Crimes per 1,000 residents a year, from the local police department.", before: "At most", example: "15", after: "crimes per 1,000" },
    { name: "Commute", hint: "Average one-way trip to work.", before: "At most", example: "30", after: "minutes" },
    { name: "Walkability", hint: "EPA walkability index, from 1 (need a car for everything) to 20 (very walkable).", before: "At least", example: "12", after: "out of 20" },
    { name: "Newer homes", hint: "How old the typical (median) home is.", before: "At most", example: "40", after: "years old" },
  ];
  // The importance slider runs 0 to 4; these are the weights and words for each step
  const IMPORTANCE = [
    { weight: 0, word: "Ignore" }, { weight: 0.5, word: "Low" }, { weight: 1, word: "Normal" },
    { weight: 2, word: "High" }, { weight: 3, word: "Top" },
  ];
  const BUDGET = {
    buy: { before: "at most $", example: "350k", after: "(compared with the zip's median sale price)" },
    rent: { before: "at most $", example: "1,500", after: "a month (compared with the zip's median rent)" },
  };
  // Decimals for each factor's "typical zip" note
  const TYPICAL_DIGITS = [0, 1, 0, 1, 0];

  let data = null, geo = null, byZip = null;
  let mode = "buy";
  let view = 0;            // 0 = you, 1 = person 2, 2 = best for both
  let result = null;
  let started = false;     // no scores until the reader sets something (or asks for the defaults)

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const money = (x) => "$" + Math.round(x).toLocaleString();
  const name = (z) => (z.place || "Zip " + z.zip) + ", " + z.state;
  const priceText = (z) => mode === "buy"
    ? money(z.buy.v[5]) + "/sq ft" + (z.buy.v[6] ? ", median sale " + money(z.buy.v[6]) : "")
    : money(z.rent.v[5]) + "/month";

  // ---- Controls: one fieldset per person, built here so both people get the same form

  function personForm(k) {
    const fs = document.createElement("fieldset");
    fs.className = "hv-person";
    fs.dataset.k = k;
    const rows = FACTORS.map((f, i) =>
      '<div class="hv-factor">' +
      '<label class="hv-line"><span class="hv-name">' + f.name + '</span>' +
      '<input type="range" name="w' + i + '" min="0" max="4" step="1" value="2" aria-label="How much ' + f.name.toLowerCase() + ' matter">' +
      '<output>Normal</output></label>' +
      '<p class="hv-hint">' + f.hint + ' <span data-typical="' + i + '"></span></p>' +
      '<label class="hv-must"><span>Must have: ' + f.before + '</span>' +
      '<input type="text" inputmode="decimal" name="t' + i + '" placeholder="e.g. ' + f.example + '">' +
      '<span>' + f.after + '</span></label></div>').join("");
    fs.innerHTML =
      '<legend>' + (k === 0 ? "You" : "Person 2") + '</legend>' +
      '<p class="hv-intro">Slide each one to set how much it matters to you. The "must have" boxes are optional: fill one in only for a hard limit, and zips that miss it drop down the ranking.</p>' +
      rows +
      '<div class="hv-factor hv-price">' +
      '<label class="hv-line"><span class="hv-name">Low price</span>' +
      '<input type="range" name="ps" min="0" max="100" step="5" value="50" aria-label="Share of the score that is low price">' +
      '<output>50%</output></label>' +
      '<p class="hv-hint">How much of the score is price. At 50%, half the score is a low price and half is everything above. At 0%, price is ignored.</p>' +
      '<label class="hv-must"><span data-budget-before>Budget: ' + BUDGET[mode].before + '</span>' +
      '<input class="hv-wide" type="text" inputmode="decimal" name="budget" placeholder="e.g. ' + BUDGET[mode].example + '">' +
      '<span data-budget-after>' + BUDGET[mode].after + '</span></label></div>' +
      '<div class="hv-buttons"><button class="btn small" type="button" data-reset>Reset</button>' +
      (k === 1 ? '<button class="btn small" type="button" data-remove>Remove person 2</button>' : "") + '</div>';
    fs.addEventListener("input", () => { started = true; update(); });
    fs.querySelector("[data-reset]").addEventListener("click", () => {
      fs.querySelectorAll("input[type=range]").forEach((el) => { el.value = el.name === "ps" ? 50 : 2; });
      fs.querySelectorAll("input[type=text]").forEach((el) => { el.value = ""; });
      if (k === 0) started = false;
      update();
    });
    const remove = fs.querySelector("[data-remove]");
    if (remove) remove.addEventListener("click", () => { fs.remove(); addBtn.hidden = false; setView(0); });
    if (data) showTypical(fs);
    return fs;
  }

  // "Typical zip: 24 minutes" under each factor, the median over the current sample
  function showTypical(scope) {
    const rows = data.zips.filter((z) => z[mode]);
    scope.querySelectorAll("[data-typical]").forEach((el) => {
      const i = Number(el.dataset.typical);
      if (i === 0) return;   // a percentile's typical value is 50 by definition
      const v = rows.map((z) => z[mode].v[i]).filter((x) => x != null).sort((a, b) => a - b);
      const m = v[v.length >> 1];
      el.textContent = "Typical zip: " + m.toFixed(TYPICAL_DIGITS[i]) + " " + FACTORS[i].after + ".";
    });
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
    const steps = [0, 1, 2, 3, 4].map((i) => IMPORTANCE[Number(f["w" + i].value)]);
    const weights = steps.map((st) => st.weight);
    steps.forEach((st, i) => { f["w" + i].nextElementSibling.textContent = st.word; });
    f.ps.nextElementSibling.textContent = f.ps.value + "%";
    return {
      weights,
      priceShare: Number(f.ps.value) / 100,
      targets: [0, 1, 2, 3, 4].map((i) => parse(f["t" + i].value)),
      budget: parse(f.budget.value),
    };
  }

  function people() {
    return [...peopleEl.querySelectorAll(".hv-person")].map(readPerson);
  }

  function setView(v) {
    view = v;
    viewEl.hidden = peopleEl.querySelectorAll(".hv-person").length < 2;
    viewEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.view) === view)));
    update();
  }

  // ---- Scoring

  function update() {
    if (!data) return;
    root.classList.toggle("hv-unscored", !started);
    if (!started) {
      result = null;
      draw();
      tableEl.innerHTML = "";
      summaryEl.innerHTML = "<b>Nothing is ranked yet.</b> Tell the map what matters to you: slide an importance or fill in a must-have, and it will show your 20 best-value " +
        (mode === "buy" ? "places to buy" : "places to rent") + '. Or <button class="btn small" type="button" data-start>use the middle settings</button>.';
      summaryEl.querySelector("[data-start]").addEventListener("click", () => { started = true; update(); });
      return;
    }
    const ps = people();
    if (ps.some((p) => p.weights.every((w) => w === 0) && p.priceShare < 1)) {
      summaryEl.textContent = "Set at least one thing above Ignore, or set low price to 100%.";
      return;
    }
    result = window.HVModel.run(data.zips, mode, ps, data.top);
    if (view >= ps.length && view !== 2) view = 0;
    draw();
    fillTable();
    summarize(ps.length);
  }

  function current() {
    if (view === 2 && result.both) return { picks: result.both, score: (r) => r.both, label: "best for both" };
    const k = Math.min(view, result.picks.length - 1);
    return { picks: result.picks[k], score: (r) => r.scores[k], label: k === 0 ? "your" : "person 2's" };
  }

  function summarize(n) {
    const { picks } = current();
    const rows = result.rows.filter((r) => picks.has(r.zip));
    const onList = rows.filter((r) => r.list).length;
    const what = mode === "buy" ? "to buy" : "to rent";
    let head;
    if (view === 2 && n > 1) {
      const a = rows.filter((r) => result.picks[0].has(r.zip)).length;
      const b = rows.filter((r) => result.picks[1].has(r.zip)).length;
      head = "<b>The " + picks.size + " best areas " + what + " for both of you</b> (" + a + " are also in your own top " + data.top + ", " + b + " in person 2's).";
    } else {
      head = "<b>" + (view === 1 ? "Person 2's " : "Your ") + picks.size + " value areas " + what + ".</b>";
    }
    summaryEl.innerHTML = head + " <b>" + onList + "</b> of them " + (onList === 1 ? "is" : "are") + " on Niche's list of the best places to live (the diamonds).";
  }

  // ---- Map

  function draw() {
    const width = mapEl.clientWidth;
    if (!geo || width < 200) return;
    if (!result) return drawPlain(width);
    const { picks, score, label } = current();
    const scored = new Map(result.rows.map((r) => [r.zip, r]));
    const values = result.rows.map(score);
    const color = d3.scaleLinear().domain([d3.min(values), d3.max(values)]).range([css("--hv-low"), css("--hv-high")]).interpolate(d3.interpolateLab);
    const rank = new Map([...result.rows].sort((a, b) => score(b) - score(a)).map((r, i) => [r.zip, i + 1]));
    const pick = css("--pick"), bg = css("--bg");
    const feats = geo.features;
    const inSample = feats.filter((f) => scored.has(f.id));

    const plot = Plot.plot({
      width,
      height: Math.round(width * 1.12),
      margin: 4,
      projection: { type: "mercator", domain: geo },
      style: { background: "transparent", color: css("--muted"), fontFamily: css("--font"), fontSize: "11px" },
      marks: [
        Plot.geo(feats.filter((f) => !scored.has(f.id)), { fill: css("--hv-none"), stroke: bg, strokeWidth: 0.5 }),
        Plot.geo(inSample, { fill: (f) => color(score(scored.get(f.id))), stroke: bg, strokeWidth: 0.5 }),
        Plot.geo(inSample.filter((f) => picks.has(f.id)), { fill: pick, stroke: bg, strokeWidth: 1 }),
        nicheMarks(feats, bg),
        Plot.tip(inSample, Plot.pointer(Plot.centroid({
          fill: bg, stroke: css("--border"),
          title: (f) => {
            const r = scored.get(f.id);
            return [
              name(r) + " " + r.zip,
              "Value " + Math.round(score(r)) + " (" + rank.get(r.zip) + " of " + result.rows.length + ")" + (picks.has(r.zip) ? ", in " + label + " top " + data.top : ""),
              r.scores.length > 1 ? "You " + Math.round(r.scores[0]) + ", person 2 " + Math.round(r.scores[1]) : null,
              priceText(r),
              r.list ? "On the Niche list (" + r.list + ")" : null,
            ].filter(Boolean).join("\n");
          },
        }))),
      ],
    });
    plot.setAttribute("aria-label", "Map of " + result.rows.length + " Chicago-area zip codes colored by value score, stronger blue is better value. " +
      "The top " + data.top + " are orange and listed in the table below. Diamonds mark the Niche list.");
    mapEl.replaceChildren(plot);
  }

  // Before the reader has set anything: every zip in one neutral color, with Niche's places marked
  function drawPlain(width) {
    const bg = css("--bg");
    const feats = geo.features;
    const plot = Plot.plot({
      width,
      height: Math.round(width * 1.12),
      margin: 4,
      projection: { type: "mercator", domain: geo },
      style: { background: "transparent", color: css("--muted"), fontFamily: css("--font"), fontSize: "11px" },
      marks: [
        Plot.geo(feats, { fill: css("--hv-none"), stroke: bg, strokeWidth: 0.5 }),
        nicheMarks(feats, bg),
        Plot.tip(feats, Plot.pointer(Plot.centroid({
          fill: bg, stroke: css("--border"),
          title: (f) => {
            const z = byZip.get(f.id);
            return z ? [name(z) + " " + z.zip, z.list ? "On the Niche list (" + z.list + ")" : null].filter(Boolean).join("\n") : "Zip " + f.id;
          },
        }))),
      ],
    });
    plot.setAttribute("aria-label", "Map of Chicago-area zip codes. Nothing is ranked yet. Diamonds mark Niche's best places to live.");
    mapEl.replaceChildren(plot);
  }

  // Niche's places, always shown: a diamond with a halo in the page color so it reads on any fill
  function nicheMarks(feats, bg) {
    const listed = feats.filter((f) => byZip.get(f.id)?.list);
    return [
      Plot.dot(listed, Plot.centroid({ symbol: "diamond", r: 4, stroke: bg, strokeWidth: 3.5, fill: "none" })),
      Plot.dot(listed, Plot.centroid({ symbol: "diamond", r: 4, stroke: css("--text"), strokeWidth: 1.5, fill: "none" })),
    ];
  }

  // ---- Table

  function fillTable() {
    const { picks, score } = current();
    const rows = result.rows.filter((r) => picks.has(r.zip)).sort((a, b) => score(b) - score(a));
    const scoreHead = view === 2 ? "<th>You</th><th>Person 2</th>" : "<th>Value</th>";
    const head = "<thead><tr><th>#</th><th>Place</th><th>Zip</th>" + scoreHead + "<th>" + (mode === "buy" ? "$/sq ft" : "Rent") +
      "</th><th>On Niche</th></tr></thead>";
    const body = rows.map((r, i) => "<tr><td>" + (i + 1) + "</td><td>" + name(r) + "</td><td>" + r.zip + "</td>" +
      (view === 2 ? "<td>" + Math.round(r.scores[0]) + "</td><td>" + Math.round(r.scores[1]) + "</td>" : "<td>" + Math.round(score(r)) + "</td>") +
      "<td>" + money(r[mode].v[5]) + "</td><td>" + (r.list ? "Yes" : "No") + "</td></tr>").join("");
    tableEl.innerHTML = head + "<tbody>" + body + "</tbody>";
  }

  // ---- Buying / renting

  function setMode(m) {
    mode = m;
    document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    peopleEl.querySelectorAll(".hv-person").forEach((fs) => {
      fs.elements.budget.value = "";
      fs.elements.budget.placeholder = "e.g. " + BUDGET[mode].example;
      fs.querySelector("[data-budget-before]").textContent = "Budget: " + BUDGET[mode].before;
      fs.querySelector("[data-budget-after]").textContent = BUDGET[mode].after;
      showTypical(fs);
    });
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
  Promise.all([fetch("/writing/chicago-home-value.json").then((r) => r.json()), fetch("/writing/chicago-home-value-zips.json").then((r) => r.json())])
    .then(([json, shapes]) => {
      data = json;
      geo = shapes;
      byZip = new Map(data.zips.map((z) => [z.zip, z]));
      showTypical(peopleEl);
      update();
    })
    .catch(() => { mapEl.innerHTML = '<p class="muted">The map could not load. The data is in the GitHub repo linked above.</p>'; });
})();
