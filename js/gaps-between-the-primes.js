/* ==========================================================================
   Gaps Between the Primes: in-browser demo for the project's Walkthrough.
   Same idea as primegaps.cpp, with the faster isPrime from section 5,
   and it stops at a limit instead of running forever.
   ========================================================================== */

(function () {
  const input = document.getElementById("gap-limit");
  const button = document.getElementById("gap-run");
  const result = document.getElementById("gap-result");
  if (!input || !button || !result) return;

  const MAX = 5000000;   // keeps the page responsive

  // Stop at the square root, and stop at the first divisor
  function isPrime(num) {
    if (num < 2) return false;
    for (let i = 2; i * i <= num; i++) {
      if (num % i === 0) return false;
    }
    return true;
  }

  function findGaps(limit) {
    let lastp = 2, count = 1, twins = 0;
    let lgap = 0, sgap = Infinity;
    const records = [];                       // every time the largest gap grew
    for (let current = 3; current <= limit; current++) {
      if (!isPrime(current)) continue;
      count++;
      const gap = current - lastp;
      if (gap === 2) twins++;
      if (gap > lgap) { lgap = gap; records.push([gap, lastp, current]); }
      if (gap < sgap) sgap = gap;              // two separate ifs: no missed gap of 1
      lastp = current;
    }
    return { count, lgap, sgap, twins, records, lastp };
  }

  const n = (x) => x.toLocaleString();

  function el(tag, text) {
    const e = document.createElement(tag);
    if (text != null) e.textContent = text;
    return e;
  }

  function run() {
    const limit = Math.min(MAX, Math.max(10, Math.floor(Number(input.value) || 0)));
    input.value = limit;
    result.textContent = "";
    result.append(el("p", "Counting…"));
    button.disabled = true;

    // Let the page show "Counting…" before the work starts
    setTimeout(() => {
      const start = performance.now();
      const r = findGaps(limit);
      const ms = Math.round(performance.now() - start);
      const last = r.records[r.records.length - 1];

      result.textContent = "";
      result.append(
        el("p", "Found " + n(r.count) + " primes up to " + n(limit) + " in " + n(ms) + " ms. The last one is " + n(r.lastp) + "."),
        el("p", "Largest gap: " + n(r.lgap) + " (between " + n(last[1]) + " and " + n(last[2]) + "). Smallest gap: " + r.sgap +
          " (only 2 and 3). Gaps of exactly 2, twin primes: " + n(r.twins) + ".")
      );

      const table = el("table");
      const head = el("tr");
      ["Record gap", "From", "To"].forEach((h) => head.append(el("th", h)));
      table.append(el("thead"), el("tbody"));
      table.tHead.append(head);
      r.records.forEach(([gap, from, to]) => {
        const row = el("tr");
        row.append(el("td", n(gap)), el("td", n(from)), el("td", n(to)));
        table.tBodies[0].append(row);
      });
      result.append(el("p", "Each time the largest gap grew:"), table);
      button.disabled = false;
    }, 20);
  }

  button.addEventListener("click", run);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  run();   // show the 100,000 result right away
})();
