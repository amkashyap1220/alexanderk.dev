<!--
  A chart over time, shared by body weight and strength: the grid, the
  month labels, the latest value spelled out, and a crosshair with a tooltip
  on the point nearest the pointer. The parent draws its own marks with
  {#snippet marks(X, Y)} using the scales it's handed.
-->
<script>
  import { fmtDate, ticks, monthStarts } from "./fit.js";
  import { showTip, hideTip } from "./tip.svelte.js";

  // points: [{ date, ... }] in date order; domain: [lowest, highest] value to fit;
  // last: { date, value } labelled at the right; tip(p): [title, lines]
  let { width, height, label, points, domain, last, tip, marks } = $props();

  const L = 44, R = 72, T = 16, B = 32;
  const W = $derived(Math.max(300, width || 760));
  const t = (d) => Date.parse(d);
  const x0 = $derived(t(points[0].date));
  const x1 = $derived(Math.max(t(last.date), x0 + 7 * 864e5));
  const yt = $derived(ticks(domain[0], domain[1]));
  const X = $derived((d) => L + ((t(d) - x0) / (x1 - x0)) * (W - L - R));
  const Y = $derived((v) => T + (1 - (v - yt[0]) / (yt.at(-1) - yt[0])) * (height - T - B));
  const months = $derived(monthStarts(x0, x1));

  let svg, cross = $state(null), crossOn = $state(false);
  function onpointermove(e) {
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const p = points.reduce((a, b) => (Math.abs(X(b.date) - sx) < Math.abs(X(a.date) - sx) ? b : a));
    cross = X(p.date);
    crossOn = true;
    showTip(e.clientX, e.clientY, ...tip(p));
  }
  function onpointerleave() { crossOn = false; hideTip(); }
</script>

<svg viewBox="0 0 {W} {height}" role="img" aria-label={label} data-chart="" bind:this={svg}>
  {#each yt as v}
    <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--border)" />
    <text x={L - 8} y={Y(v) + 4} text-anchor="end" font-size="11" fill="var(--muted)">{v}</text>
  {/each}
  {#each months.length ? months : [points[0].date, last.date] as d}
    <text x={X(d)} y={height - 10} text-anchor="middle" font-size="11" fill="var(--muted)">{fmtDate(d, months.length ? { month: "short" } : undefined)}</text>
  {/each}
  {@render marks(X, Y)}
  <text x={X(last.date) + 10} y={Y(last.value) + 4} font-size="12" fill="var(--text)">{last.value} lb</text>
  <line x1={cross} x2={cross} y1={T} y2={height - B} stroke="var(--muted)" stroke-dasharray="3 3" visibility={crossOn ? "visible" : "hidden"} />
  <rect x={L} y={T} width={W - L - R} height={height - T - B} fill="transparent" {onpointermove} {onpointerleave} />
</svg>
