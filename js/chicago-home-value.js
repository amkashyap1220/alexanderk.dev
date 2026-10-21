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

  const FACTORS = [
    { name: "Schools", hint: "≥ %ile", label: "Target: schools at least this percentile in the state (0 to 100)" },
    { name: "Safety", hint: "≤ per 1k", label: "Target: at most this many crimes per 1,000 residents a year" },
    { name: "Commute", hint: "≤ min", label: "Target: average commute at most this many minutes" },
    { name: "Walkability", hint: "≥ 1–20", label: "Target: EPA walkability index at least this (1 to 20)" },
    { name: "Newer homes", hint: "≤ years", label: "Target: typical home at most this many years old" },
  ];
  const BUDGET = {
    buy: { hint: "≤ $", label: "Budget: median sale price at most this many dollars (350k works)" },
    rent: { hint: "≤ $/mo", label: "Budget: median rent at most this many dollars a month" },
  };

  let data = null, geo = null, byZip = null;
  let mode = "buy";
  let view = 0;            // 0 = you, 1 = person 2, 2 = best for both
  let result = null;
  const mine = {};         // my published top 20 per mode

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
      '<label class="hv-row"><span>' + f.name + '</span>' +
      '<input type="range" name="w' + i + '" min="0" max="3" step="0.5" value="1" aria-label="' + f.name + ' weight">' +
      '<output>1</output>' +
      '<input type="text" inputmode="decimal" name="t' + i + '" placeholder="' + f.hint + '" aria-label="' + f.label + '"></label>').join("");
    fs.innerHTML =
      '<legend>' + (k === 0 ? "You" : "Person 2") + '</legend>' +
      '<div class="hv-row hv-head" aria-hidden="true"><span></span><span>How much it counts</span><span></span><span>Target</span></div>' +
      rows +
      '<label class="hv-row hv-price"><span>Low price</span>' +
      '<input type="range" name="ps" min="0" max="100" step="5" value="50" aria-label="How much a low price counts, as a share of the score">' +
      '<output>50%</output>' +
      '<input type="text" inputmode="decimal" name="budget" aria-label="' + BUDGET[mode].label + '" placeholder="' + BUDGET[mode].hint + '"></label>' +
      '<div class="hv-buttons"><button class="btn small" type="button" data-reset>' + (k === 0 ? "Use my weights" : "Reset") + '</button>' +
      (k === 1 ? '<button class="btn small" type="button" data-remove>Remove person 2</button>' : "") + '</div>';
    fs.addEventListener("input", update);
    fs.querySelector("[data-reset]").addEventListener("click", () => {
      fs.querySelectorAll("input[type=range]").forEach((el) => { el.value = el.name === "ps" ? 50 : 1; });
      fs.querySelectorAll("input[type=text]").forEach((el) => { el.value = ""; });
      update();
    });
    const remove = fs.querySelector("[data-remove]");
    if (remove) remove.addEventListener("click", () => { fs.remove(); addBtn.hidden = false; setView(0); });
    return fs;
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
    const weights = [0, 1, 2, 3, 4].map((i) => Number(f["w" + i].value));
    [0, 1, 2, 3, 4].forEach((i) => { f["w" + i].nextElementSibling.textContent = f["w" + i].value; });
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
    const ps = people();
    if (ps.some((p) => p.weights.every((w) => w === 0) && p.priceShare < 1)) {
      summaryEl.textContent = "Give at least one thing a weight above 0, or set low price to 100%.";
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
    const inMine = rows.filter((r) => mine[mode].has(r.zip)).length;
    const what = mode === "buy" ? "to buy" : "to rent";
    let head;
    if (view === 2 && n > 1) {
      const a = rows.filter((r) => result.picks[0].has(r.zip)).length;
      const b = rows.filter((r) => result.picks[1].has(r.zip)).length;
      head = "<b>The " + picks.size + " best areas " + what + " for both of you</b> (" + a + " are also in your own top " + data.top + ", " + b + " in person 2's).";
    } else {
      head = "<b>" + (view === 1 ? "Person 2's " : "Your ") + picks.size + " value areas " + what + ".</b>";
    }
    summaryEl.innerHTML = head + " <b>" + onList + "</b> of them " + (onList === 1 ? "is" : "are") + " on the Niche list, and " +
      inMine + " " + (inMine === 1 ? "is" : "are") + " in my top " + data.top + ".";
  }

  // ---- Map

  function draw() {
    const width = mapEl.clientWidth;
    if (!result || width < 200) return;
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
        Plot.dot(feats.filter((f) => byZip.get(f.id)?.list), Plot.centroid({ symbol: "diamond", r: 3.5, stroke: css("--text"), strokeWidth: 1.25, fill: "none" })),
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

  // ---- Table

  function fillTable() {
    const { picks, score } = current();
    const rows = result.rows.filter((r) => picks.has(r.zip)).sort((a, b) => score(b) - score(a));
    const scoreHead = view === 2 ? "<th>You</th><th>Person 2</th>" : "<th>Value</th>";
    const head = "<thead><tr><th>#</th><th>Place</th><th>Zip</th>" + scoreHead + "<th>" + (mode === "buy" ? "$/sq ft" : "Rent") +
      "</th><th>Niche</th><th>Mine</th></tr></thead>";
    const body = rows.map((r, i) => "<tr><td>" + (i + 1) + "</td><td>" + name(r) + "</td><td>" + r.zip + "</td>" +
      (view === 2 ? "<td>" + Math.round(r.scores[0]) + "</td><td>" + Math.round(r.scores[1]) + "</td>" : "<td>" + Math.round(score(r)) + "</td>") +
      "<td>" + money(r[mode].v[5]) + "</td><td>" + (r.list ? "Yes" : "No") + "</td><td>" + (mine[mode].has(r.zip) ? "Yes" : "No") + "</td></tr>").join("");
    tableEl.innerHTML = head + "<tbody>" + body + "</tbody>";
  }

  // ---- Buying / renting

  function setMode(m) {
    mode = m;
    document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    peopleEl.querySelectorAll("input[name=budget]").forEach((el) => {
      el.value = "";
      el.placeholder = BUDGET[mode].hint;
      el.setAttribute("aria-label", BUDGET[mode].label);
    });
    document.querySelectorAll("[data-mode-text]").forEach((el) => { el.textContent = el.dataset[mode]; });
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
      const me = { weights: data.default.weights, priceShare: data.default.price_share, targets: [null, null, null, null, null], budget: null };
      ["buy", "rent"].forEach((m) => { mine[m] = window.HVModel.run(data.zips, m, [me], data.top).picks[0]; });
      update();
    })
    .catch(() => { mapEl.innerHTML = '<p class="muted">The map could not load. The data is in the GitHub repo linked above.</p>'; });
})();
