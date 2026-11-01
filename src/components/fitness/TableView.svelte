<!-- The numbers behind a chart, folded under "Show as a table" -->
<script>
  let { head, rows } = $props();
</script>

<details class="fit-table">
  <summary>Show as a table</summary>
  <table>
    <thead><tr>{#each head as h}<th>{h}</th>{/each}</tr></thead>
    <tbody>{#each rows as r}<tr>{#each r as c}<td>{c}</td>{/each}</tr>{/each}</tbody>
  </table>
</details>
