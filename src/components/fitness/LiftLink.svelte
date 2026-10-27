<!-- A lift's name as a link to its Google results (opens in a new tab) -->
<script>
  let { name } = $props();
</script>

<a class="fit-link" href={"https://www.google.com/search?q=" + encodeURIComponent(name)} target="_blank" rel="noopener noreferrer">{name}</a>
