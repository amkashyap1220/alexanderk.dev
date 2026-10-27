<!-- Add a lift: plain text the next daily session turns into a catalog entry -->
<script>
  import { post } from "./fit.js";

  let { D, onchange } = $props();

  let text = $state(""), status = $state("");
  const requests = $derived(D.preferences.requests || []);

  async function send(body, done) {
    status = "Saving…";
    try {
      const out = await post("request", body);
      onchange(out.preferences.requests);
      status = done;
      return true;
    } catch (err) {
      status = "Not saved: " + err.message;
      return false;
    }
  }

  async function onsubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    if (await send({ text: text.trim() }, "Added. Your next daily session will put it in your plans.")) text = "";
  }
</script>

<form id="fit-request" class="fit-request" {onsubmit}>
  <input class="fit-input" name="text" maxlength="200" required autocomplete="off" placeholder="e.g. landmine press, love it for shoulders" aria-label="Lift to add" bind:value={text}>
  <button class="btn primary" type="submit">Add</button>
</form>
<p class="muted fit-request-status" id="fit-request-status" role="status">{status}</p>
<ul class="fit-requests" id="fit-requests" aria-label="Waiting for your next session">
  {#each requests as r, i}
    <li>
      <span class="name">{r.text}</span>
      <span class="muted">next session</span>
      <button class="btn small" type="button" aria-label={`Cancel "${r.text}"`} onclick={() => send({ cancel: i }, "Cancelled.")}>✕</button>
    </li>
  {/each}
</ul>
