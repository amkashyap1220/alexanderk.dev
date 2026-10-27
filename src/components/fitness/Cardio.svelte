<!-- Cardio minutes per week, stacked by machine, with the week's target as a tick -->
<script>
  import { MACHINE_COLOR, fmtDate, ticks } from "./fit.js";
  import TableView from "./TableView.svelte";

  let { D, A } = $props();

  const weeks = $derived(A.weekly.slice(-12));
  const machines = $derived((D.preferences.cardio && D.preferences.cardio.machines) || Object.keys(MACHINE_COLOR));
  const goal = $derived((D.preferences.cardio && D.preferences.cardio.minutes) || 25);
  const totals = $derived(weeks.map((w) => machines.reduce((t, m) => t + (w.cardio[m] || 0), 0)));
  const targets = $derived(weeks.map((w) => w.sessions * goal));

  let width = $state(0);
  const H = 220, L = 40, R = 8, T = 12, B = 28;
  const W = $derived(Math.max(300, width || 760));
  const yt = $derived(ticks(0, Math.max(...totals, ...targets, goal)));
  const Y = (v) => T + (1 - v / yt.at(-1)) * (H - T - B);
  const slot = $derived((W - L - R) / weeks.length), bw = $derived(Math.min(36, slot * 0.6));
  const every = $derived(Math.ceil(56 / slot));   // week labels far enough apart not to touch

  // Each week's bars, stacked from the bottom
  function stack(w, i) {
    let base = 0;
    return machines.filter((m) => w.cardio[m]).map((m) => {
      const v = w.cardio[m], y1 = Y(base + v), y0 = Y(base);
      base += v;
      return { m, y: y1, height: Math.max(0, y0 - y1 - 2), top: base === totals[i] };
    });
  }
  const tipText = (w, i) => [`Week of ${fmtDate(w.week)}`, ...machines.filter((m) => w.cardio[m]).map((m) => `${m}: ${w.cardio[m]} min`), `Target: ${targets[i]} min (${w.sessions} workouts)`].join("\n");
</script>

<div id="fit-cardio" class="fit-chart" bind:clientWidth={width}>
  {#if !totals.some(Boolean)}
    <p class="empty">No cardio logged yet.</p>
  {:else}
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Cardio minutes per week by machine">
      {#each yt as v}
        <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--border)" />
        <text x={L - 8} y={Y(v) + 4} text-anchor="end" font-size="11" fill="var(--muted)">{v}</text>
      {/each}
      {#each weeks as w, i}
        {@const cx = L + slot * (i + 0.5)}
        {#if (weeks.length - 1 - i) % every === 0}
          <text x={cx} y={H - 10} text-anchor="middle" font-size="11" fill="var(--muted)">{fmtDate(w.week)}</text>
        {/if}
        <g data-tip={tipText(w, i)}>
          <rect x={cx - slot / 2} y={T} width={slot} height={H - T - B} fill="transparent" />
          {#each stack(w, i) as bar}
            <rect x={cx - bw / 2} y={bar.y} width={bw} height={bar.height} fill={MACHINE_COLOR[bar.m] || "var(--muted)"} rx={bar.top ? 3 : 0} />
          {/each}
          {#if targets[i]}
            <line x1={cx - bw / 2 - 4} x2={cx + bw / 2 + 4} y1={Y(targets[i])} y2={Y(targets[i])} stroke="var(--text)" stroke-width="2" />
          {/if}
        </g>
      {/each}
    </svg>
    <ul class="fit-legend">
      {#each machines as m}<li><span class="fit-swatch" style="--c:{MACHINE_COLOR[m]}"></span>{m}</li>{/each}
      <li><span class="fit-swatch" style="--c:var(--text);height:2px;vertical-align:3px"></span>target</li>
    </ul>
    <TableView head={["Week of", ...machines, "Target"]} rows={[...weeks].reverse().map((w, i) => [w.week, ...machines.map((m) => String(w.cardio[m] || 0)), String(targets[weeks.length - 1 - i])])} />
  {/if}
</div>
