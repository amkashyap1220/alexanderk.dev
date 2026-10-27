<!-- Weekly sets per muscle against the target band, lowest first -->
<script>
  let { D, A } = $props();

  const ws = $derived(D.program.weekly_sets);
  const max = $derived(Math.max(ws.high * 1.2, ...A.volume.map((v) => v.avgWeekly)));
  const pct = (v) => `${(v / max) * 100}%`;
  const LABEL = { low: ["bad", "low"], under: ["warn", "under"], ok: ["", ""], high: ["warn", "high"] };
  const rows = $derived([...A.volume].sort((a, b) => a.avgWeekly - b.avgWeekly));
</script>

<div id="fit-volume">
  {#each rows as v}
    {@const [cls, word] = LABEL[v.status]}
    <div class="fit-bar-row" data-tip={`${v.name}\n${v.avgWeekly} sets a week (target ${ws.target}–${ws.high})`}>
      <span>{v.name}</span>
      <div class="fit-track"><div class="band" style="left:{pct(ws.target)};width:calc({pct(ws.high)} - {pct(ws.target)})"></div><div class="fill" style="width:{pct(v.avgWeekly)}"></div></div>
      <span class="fit-bar-value">{v.avgWeekly} sets {#if word}<span class={cls}>{word}</span>{/if}</span>
    </div>
  {/each}
</div>
