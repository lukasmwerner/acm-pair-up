<script lang="ts">
	import { onMount } from 'svelte';
	import { saveSession } from '$lib/client/session';

	const EMOJIS = ['🐶', '🐱', '🐼', '🦊', '🦁', '🐸', '🐵', '🐰', '🐻', '🐨', '🐯', '🦄', '🐙', '🦋', '🌸', '🌻', '🍀', '🌈', '🔥', '⭐'];

	let floatingEmojis: Array<{emoji: string, x: number, y: number, size: number, delay: number, duration: number}> = [];
	let admin = { name: 'Speed Friending', code: '' };
	let created: { id: string; code: string; adminKey: string } | null = null;
	let joinUrl = '';
	let creating = false;

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

	async function createEvent() {
		creating = true;
		const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: admin.name, code: admin.code || undefined }) });
		const data = await res.json();
		created = data.event;
		saveSession({ eventId: created!.id, adminKey: created!.adminKey });
		joinUrl = `${location.origin}/join?e=${encodeURIComponent(created!.id)}&code=${encodeURIComponent(created!.code)}`;
		creating = false;
	}

	function copy(text: string) {
		navigator.clipboard?.writeText(text).catch(() => {});
	}
</script>

<svelte:head>
	<title>Create Event - ACM Pair Up</title>
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

	<div class="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
		{#if !created}
			<!-- Create Event Form -->
			<div class="text-6xl mb-4 animate-wave hero-emoji">🎉</div>

			<div class="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8">
				<h1 class="text-2xl font-bold text-slate-800 text-center mb-2">Create Event</h1>
				<p class="text-slate-600 text-center mb-6">Set up a new speed friending session</p>

				<div class="space-y-4">
					<div>
						<label for="name" class="block text-sm font-medium text-slate-700 mb-2">
							Event Name
						</label>
						<input
							type="text"
							id="name"
							bind:value={admin.name}
							class="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
							placeholder="Speed Friending"
							disabled={creating}
						/>
					</div>

					<div>
						<label for="code" class="block text-sm font-medium text-slate-700 mb-2">
							Join Code <span class="text-slate-400 font-normal">(optional)</span>
						</label>
						<input
							type="text"
							id="code"
							bind:value={admin.code}
							class="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
							placeholder="e.g. ABCD"
							disabled={creating}
						/>
						<p class="text-xs text-slate-500 mt-1">Leave blank to auto-generate</p>
					</div>

					<button
						class="w-full px-6 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-full shadow-lg hover:bg-indigo-700 hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cta-button"
						on:click={createEvent}
						disabled={creating}
					>
						{#if creating}
							<span class="flex items-center justify-center gap-2">
								<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Creating...
							</span>
						{:else}
							Create Event
						{/if}
					</button>
				</div>

				<p class="mt-6 text-sm text-slate-500 text-center">
					<a href="/" class="text-indigo-600 hover:text-indigo-700 hover:underline transition-colors">
						Back to home
					</a>
				</p>
			</div>
		{:else}
			<!-- Success State -->
			<div class="text-6xl mb-4 animate-bounce hero-emoji">🎊</div>

			<div class="w-full max-w-lg bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8">
				<h1 class="text-2xl font-bold text-slate-800 text-center mb-2">Event Created!</h1>
				<p class="text-slate-600 text-center mb-6">Your event is ready. Share the join link with participants.</p>

				<div class="space-y-4">
					<!-- Event Info -->
					<div class="bg-indigo-50/80 rounded-xl p-4 border border-indigo-100">
						<div class="flex justify-between items-center">
							<span class="text-sm text-slate-600">Event Code</span>
							<span class="font-bold text-indigo-700 text-lg">{created.code}</span>
						</div>
					</div>

					<!-- Join URL -->
					<div>
						<label class="block text-sm font-medium text-slate-700 mb-2">Join Link</label>
						<div class="flex items-center gap-2">
							<input
								class="flex-1 px-4 py-3 border border-slate-200 rounded-xl bg-white/50 text-sm"
								readonly
								value={joinUrl}
							/>
							<button
								class="px-4 py-3 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-900 transition-all"
								on:click={() => copy(joinUrl)}
							>
								Copy
							</button>
						</div>
					</div>

					<!-- Action Buttons -->
					<div class="flex gap-3 pt-2">
						<a
							href={`${joinUrl}&qr=1`}
							target="_blank"
							rel="noreferrer"
							class="flex-1 px-4 py-3 bg-indigo-100 text-indigo-700 font-medium rounded-xl text-center hover:bg-indigo-200 transition-all"
						>
							Show QR Code
						</a>
						<a
							href={`/admin/${created.id}`}
							class="flex-1 px-4 py-3 bg-indigo-600 text-white font-medium rounded-xl text-center hover:bg-indigo-700 transition-all cta-button"
						>
							Open Dashboard
						</a>
					</div>
				</div>
			</div>
		{/if}
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

	.hero-emoji {
		view-transition-name: hero-emoji;
	}

	.cta-button {
		view-transition-name: cta-button;
	}
</style>
