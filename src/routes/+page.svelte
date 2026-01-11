<script lang="ts">
	import { onMount } from 'svelte';

	const EMOJIS = ['🐶', '🐱', '🐼', '🦊', '🦁', '🐸', '🐵', '🐰', '🐻', '🐨', '🐯', '🦄', '🐙', '🦋', '🌸', '🌻', '🍀', '🌈', '🔥', '⭐'];

	let floatingEmojis: Array<{emoji: string, x: number, y: number, size: number, delay: number, duration: number}> = [];

	onMount(() => {
		floatingEmojis = Array.from({ length: 12 }, () => ({
			emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
			x: Math.random() * 100,
			y: Math.random() * 100,
			size: 1.5 + Math.random() * 2,
			delay: Math.random() * 5,
			duration: 8 + Math.random() * 6
		}));
	});
</script>

<svelte:head>
	<title>ACM Pair Up - Speed Friending Made Easy</title>
</svelte:head>

<div class="fixed inset-0 overflow-hidden bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
	<!-- Floating emojis background -->
	{#each floatingEmojis as emoji}
		<div
			class="absolute opacity-20 pointer-events-none animate-float"
			style="
				left: {emoji.x}%;
				top: {emoji.y}%;
				font-size: {emoji.size}rem;
				animation-delay: {emoji.delay}s;
				animation-duration: {emoji.duration}s;
			"
		>
			{emoji.emoji}
		</div>
	{/each}

	<!-- Main content -->
	<div class="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
		<!-- Hero emoji cluster -->
		<div class="text-6xl md:text-8xl mb-6 flex gap-2 hero-emoji">
			<span class="animate-wave" style="animation-delay: 0s;">🤝</span>
		</div>

		<!-- Title -->
		<h1 class="text-4xl md:text-5xl font-bold text-slate-800 text-center mb-3">
			ACM Pair Up
		</h1>

		<!-- Subtitle -->
		<p class="text-lg md:text-xl text-slate-600 text-center max-w-md mb-10">
			Meet new people through random 1:1 pairings at speed friending events
		</p>

		<!-- CTA Button -->
		<a
			href="/join"
			class="group relative px-8 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-full shadow-lg hover:bg-indigo-700 hover:shadow-xl hover:scale-105 transition-all duration-200 cta-button"
		>
			<span class="flex items-center gap-2">
				Join an Event
				<svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
				</svg>
			</span>
		</a>

		<!-- Helper text -->
		<p class="mt-8 text-sm text-slate-500 text-center">
			Enter your event code to get matched with a partner
		</p>

		<!-- Feature pills -->
		<div class="mt-12 flex flex-wrap justify-center gap-3">
			<div class="px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-slate-600 shadow-sm">
				Real-time matching
			</div>
			<div class="px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-slate-600 shadow-sm">
				No app required
			</div>
			<div class="px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-slate-600 shadow-sm">
				Unique emoji IDs
			</div>
		</div>
	</div>
</div>

<style>
	@keyframes float {
		0%, 100% {
			transform: translateY(0) rotate(0deg);
		}
		50% {
			transform: translateY(-20px) rotate(10deg);
		}
	}

	@keyframes wave {
		0%, 100% {
			transform: rotate(0deg);
		}
		25% {
			transform: rotate(-10deg);
		}
		75% {
			transform: rotate(10deg);
		}
	}

	.animate-float {
		animation: float ease-in-out infinite;
	}

	.animate-wave {
		display: inline-block;
		animation: wave 2s ease-in-out infinite;
	}

	/* View transition names */
	.hero-emoji {
		view-transition-name: hero-emoji;
	}

	.cta-button {
		view-transition-name: cta-button;
	}
</style>
