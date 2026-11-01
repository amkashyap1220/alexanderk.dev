<script>
  import { tip, showTip, hideTip } from "./tip.svelte.js";

  let box = $state();

  // Next to the pointer, but never off the screen
  $effect(() => {
    if (!tip.open) return;
    tip.title; tip.lines;   // re-measure when the text changes
    const r = box.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(window.innerWidth - r.width - 8, tip.x + 12)) + "px";
    box.style.top = Math.max(8, tip.y - r.height - 12) + "px";
  });

  function onpointermove(e) {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (t) { const [title, ...lines] = t.dataset.tip.split("\n"); showTip(e.clientX, e.clientY, title, lines); }
    else if (!e.target.closest || !e.target.closest("[data-chart]")) hideTip();
  }
</script>

<svelte:document {onpointermove} onscroll={hideTip} />

<div class="fit-tip" id="fit-tip" role="tooltip" hidden={!tip.open} bind:this={box}>
  <b>{tip.title}</b>
  {#each tip.lines as line}<div>{line}</div>{/each}
</div>
