<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onNavigate } from '$app/navigation';

	let { children } = $props();

	// Enable View Transitions API for smooth page transitions
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-dvh bg-slate-50 text-slate-900">
	<main>
		{@render children?.()}
	</main>
</div>

<style>
	/* View transition animations */
	:global(::view-transition-old(root)) {
		animation: fade-out 0.25s ease-out forwards;
	}

	:global(::view-transition-new(root)) {
		animation: fade-in 0.25s ease-in forwards;
	}

	:global(::view-transition-old(hero-emoji)) {
		animation: scale-down 0.3s ease-out forwards;
	}

	:global(::view-transition-new(hero-emoji)) {
		animation: scale-up 0.3s ease-out forwards;
	}

	:global(::view-transition-old(cta-button)) {
		animation: slide-out-down 0.25s ease-out forwards;
	}

	:global(::view-transition-new(cta-button)) {
		animation: slide-in-up 0.25s ease-out forwards;
	}

	@keyframes fade-out {
		from { opacity: 1; }
		to { opacity: 0; }
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes scale-down {
		from { transform: scale(1); opacity: 1; }
		to { transform: scale(0.8); opacity: 0; }
	}

	@keyframes scale-up {
		from { transform: scale(0.8); opacity: 0; }
		to { transform: scale(1); opacity: 1; }
	}

	@keyframes slide-out-down {
		from { transform: translateY(0); opacity: 1; }
		to { transform: translateY(20px); opacity: 0; }
	}

	@keyframes slide-in-up {
		from { transform: translateY(20px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
</style>
