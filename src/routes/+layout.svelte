<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-dvh bg-slate-50 text-slate-900">
	<main class="container mx-auto p-4">
		{@render children?.()}
	</main>
</div>
