<script lang="ts">
	import { onMount } from 'svelte';
	import { saveSession, startHeartbeat } from '$lib/client/session';

	const EMOJIS = ['🐶', '🐱', '🐼', '🦊', '🦁', '🐸', '🐵', '🐰', '🐻', '🐨', '🐯', '🦄', '🐙', '🦋', '🌸', '🌻', '🍀', '🌈', '🔥', '⭐'];

	let floatingEmojis: Array<{emoji: string, x: number, y: number, size: number, delay: number, duration: number}> = [];
	let errorMsg = '';
	let qrMode = false;
	let joinUrl = '';
	let showForm = false;
	let joining = false;
	let formCode = '';
	let formName = '';

	async function handleJoin(eventId: string, code: string, displayName: string) {
		joining = true;
		errorMsg = '';
		const res = await fetch(`/api/events/${eventId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, displayName }) });
		if (!res.ok) {
			errorMsg = 'Join failed. Check your event code.';
			joining = false;
			return;
		}
		const data = await res.json();
		saveSession({ eventId, participantToken: data.participantToken, emojiId: data.emojiId, emojiName: data.emojiName, participantId: data.participantId });
		startHeartbeat(eventId, data.participantToken);
		location.href = `/events/${eventId}`;
	}

	async function handleFormSubmit() {
		if (!formCode.trim()) {
			errorMsg = 'Please enter an event code';
			return;
		}
		await handleJoin(formCode.trim(), formCode.trim(), formName.trim());
	}

	onMount(async () => {
		// Initialize floating emojis
		floatingEmojis = Array.from({ length: 12 }, () => ({
			emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
			x: Math.random() * 100,
			y: Math.random() * 100,
			size: 1.5 + Math.random() * 2,
			delay: Math.random() * 5,
			duration: 8 + Math.random() * 6
		}));

		const url = new URL(location.href);
		const eventId = url.searchParams.get('e') || url.searchParams.get('event') || '';
		const code = url.searchParams.get('code') || url.searchParams.get('c') || '';
		const displayName = url.searchParams.get('name') || '';
		const qr = url.searchParams.get('qr') || '';
		if (!eventId || !code) {
			showForm = true;
			return;
		}
		joinUrl = `${location.origin}/join?e=${encodeURIComponent(eventId)}&code=${encodeURIComponent(code)}${displayName ? `&name=${encodeURIComponent(displayName)}` : ''}`;
		if (qr) { qrMode = true; return; }
		await handleJoin(eventId, code, displayName);
	});
</script>

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

	{#if qrMode}
		<!-- QR Mode -->
		<div class="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
			<div class="text-5xl mb-4 animate-wave">📱</div>
			<h1 class="text-3xl font-bold text-slate-800 mb-6">Scan to Join</h1>

			<div class="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
				<img
					alt="Join QR code"
					width="280"
					height="280"
					class="rounded-lg"
					src={"https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=" + encodeURIComponent(joinUrl)}
				/>
			</div>

			<div class="mt-6 max-w-sm text-center text-sm text-slate-600 break-all bg-white/40 backdrop-blur-sm px-4 py-2 rounded-full">
				{joinUrl}
			</div>

			<div class="mt-6 flex gap-3">
				<a
					class="px-6 py-3 bg-slate-800 text-white font-medium rounded-full shadow-md hover:bg-slate-900 hover:shadow-lg hover:scale-105 transition-all duration-200"
					target="_blank"
					rel="noreferrer"
					href={joinUrl}
				>
					Open Link
				</a>
				<button
					class="px-6 py-3 bg-indigo-600 text-white font-medium rounded-full shadow-md hover:bg-indigo-700 hover:shadow-lg hover:scale-105 transition-all duration-200"
					on:click={() => navigator.clipboard.writeText(joinUrl)}
				>
					Copy Link
				</button>
			</div>
		</div>

	{:else if showForm}
		<!-- Form Mode -->
		<div class="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
			<div class="text-6xl mb-4 animate-wave hero-emoji">🎟️</div>

			<div class="w-full max-w-sm bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8">
				<h1 class="text-2xl font-bold text-slate-800 text-center mb-2">Join Event</h1>
				<p class="text-slate-600 text-center mb-6">Enter the code from your organizer</p>

				<form on:submit|preventDefault={handleFormSubmit}>
					<div class="mb-4">
						<label for="code" class="block text-sm font-medium text-slate-700 mb-2">
							Event Code
						</label>
						<input
							type="text"
							id="code"
							bind:value={formCode}
							class="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
							placeholder="Enter event code"
							disabled={joining}
						/>
					</div>

					<div class="mb-6">
						<label for="name" class="block text-sm font-medium text-slate-700 mb-2">
							Your Name <span class="text-slate-400 font-normal">(optional)</span>
						</label>
						<input
							type="text"
							id="name"
							bind:value={formName}
							class="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
							placeholder="How should we call you?"
							disabled={joining}
						/>
					</div>

					{#if errorMsg}
						<div class="mb-4 p-4 bg-red-50/80 backdrop-blur-sm text-red-700 text-sm rounded-xl border border-red-100">
							{errorMsg}
						</div>
					{/if}

					<button
						type="submit"
						disabled={joining}
						class="w-full px-6 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-full shadow-lg hover:bg-indigo-700 hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cta-button"
					>
						{#if joining}
							<span class="flex items-center justify-center gap-2">
								<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Joining...
							</span>
						{:else}
							Join Event
						{/if}
					</button>
				</form>

				<p class="mt-6 text-sm text-slate-500 text-center">
					<a href="/" class="text-indigo-600 hover:text-indigo-700 hover:underline transition-colors">
						Back to home
					</a>
				</p>
			</div>
		</div>

	{:else}
		<!-- Joining State -->
		<div class="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
			<div class="text-6xl mb-6 animate-bounce">🚀</div>
			<p class="text-xl text-slate-700 font-medium">Joining event...</p>
			<div class="mt-4">
				<svg class="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			</div>
		</div>
	{/if}
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
