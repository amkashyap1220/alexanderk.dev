<!-- A chart's numbers as a table, folded under it: for screen readers, for
     copying, and for anyone who'd rather read than hover. heads names the
     columns; each row is a list of cell texts, the first being the row's name.
     It's in the page as built, so it works before (or without) the chart's script. -->
<script>
  let { heads, rows } = $props();
</script>

<details class="pa-numbers">
  <summary>Show the numbers</summary>
  <div class="pa-table-wrap">
    <table>
      <thead><tr>{#each heads as h}<th scope="col">{h}</th>{/each}</tr></thead>
      <tbody>
        {#each rows as row}<tr>{#each row as cell, i}{#if i === 0}<th scope="row">{cell}</th>{:else}<td>{cell}</td>{/if}{/each}</tr>{/each}
      </tbody>
    </table>
  </div>
</details>
