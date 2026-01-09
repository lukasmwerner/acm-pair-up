<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { page } from "$app/stores";
	import { connectSSE, loadSession } from "$lib/client/session";

	type Summary = {
		event: { id: string; name: string; code: string };
		participants: Array<{
			id: string;
			emojiId: string;
			emojiName: string;
			displayName?: string;
			presence?: { connected: boolean; lastSeenAt?: number };
		}>;
		round?: { id: string; index: number };
		connectedCount: number;
	};

	type Pairing = {
		id: string;
		roundId: string;
		aParticipantId: string;
		bParticipantId: string;
		isTrio?: boolean;
		cParticipantId?: string | null;
	};

	let summary: Summary | null = null;
	let pairings: Pairing[] = [];
	let adminKey: string | null = null;
	let disconnectSSE: (() => void) | null = null;
	let loading = false;
	let joinUrl = '';
	let currentTime = Date.now(); // For reactive last-seen updates
	let lastRematchTime = 0;
	let rematchCooldown = 0; // Milliseconds remaining

	// Toast notification state
	let toastMessage = '';
	let toastType: 'success' | 'error' | 'warning' = 'success';
	let toastVisible = false;

	function showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
		toastMessage = message;
		toastType = type;
		toastVisible = true;
		setTimeout(() => {
			toastVisible = false;
		}, 3000);
	}

	$: joinUrl = summary && typeof window !== 'undefined'
		? `${location.origin}/join?e=${encodeURIComponent(summary.event.id)}&code=${encodeURIComponent(summary.event.code)}`
		: '';

	$: connectedParticipants = summary?.participants.filter(p => p.presence?.connected) || [];
	$: disconnectedParticipants = summary?.participants.filter(p => !p.presence?.connected) || [];

	function formatLastSeen(lastSeenAt?: number): string {
		if (!lastSeenAt) return 'never';
		const seconds = Math.floor((currentTime - lastSeenAt) / 1000);
		if (seconds < 60) return `${seconds}s ago`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h ago`;
	}

	async function copyJoinLink() {
		if (!joinUrl) return;
		try {
			await navigator.clipboard.writeText(joinUrl);
			showToast('Join link copied to clipboard!', 'success');
		} catch (e) {
			console.error('Copy failed', e);
			showToast('Failed to copy link', 'error');
		}
	}

	async function fetchState(eventId: string) {
		const res = await fetch(`/api/events/${eventId}/state`);
		summary = await res.json();
	}

	async function fetchPairings(eventId: string) {
		const res = await fetch(`/api/events/${eventId}/pairings/current`);
		const data = await res.json();
		pairings = data.pairings || [];
	}

	async function rematchConnected() {
		if (!summary) return;
		if (!adminKey) {
			showToast("No admin key found", "error");
			return;
		}

		// Client-side cooldown check
		const now = Date.now();
		const timeSinceLastRematch = now - lastRematchTime;
		if (lastRematchTime > 0 && timeSinceLastRematch < 1000) {
			rematchCooldown = 1000 - timeSinceLastRematch;
			showToast("Please wait 1 second between rematches", "warning");
			return;
		}

		loading = true;
		const res = await fetch(
			`/api/events/${summary.event.id}/rematch-connected`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ adminKey }),
			},
		);
		loading = false;

		if (!res.ok) {
			showToast("Rematch failed - please try again", "error");
			return;
		}

		const data = await res.json();
		if (data.skipped) {
			// Server rejected due to idempotency - start cooldown animation
			const timeToWait = 1000 - (Date.now() - lastRematchTime);
			rematchCooldown = Math.max(0, timeToWait);
			showToast("Too fast! Please wait 1 second", "warning");
			return;
		}

		// Success - update last rematch time and show success
		lastRematchTime = Date.now();
		showToast(`Created ${data.pairings?.length || 0} new pairings!`, "success");
	}

	onMount(async () => {
		const eventId = $page.params.eventId;
		const s = loadSession();
		adminKey = s?.adminKey ?? null;
		await fetchState(eventId);
		await fetchPairings(eventId);
		disconnectSSE = connectSSE(eventId, async (msg) => {
			if (
				msg?.type === "presence:update" ||
				msg?.type === "pairings:updated"
			) {
				await fetchState(eventId);
				await fetchPairings(eventId);
			}
		});

		// Update currentTime every second for live "last seen" updates
		const timeInterval = setInterval(() => {
			currentTime = Date.now();
		}, 1000);

		// Cooldown countdown timer - recalculate from lastRematchTime for accuracy
		const cooldownInterval = setInterval(() => {
			if (lastRematchTime > 0) {
				const elapsed = Date.now() - lastRematchTime;
				const remaining = 1000 - elapsed;
				rematchCooldown = Math.max(0, remaining);
			}
		}, 50);

		return () => {
			clearInterval(timeInterval);
			clearInterval(cooldownInterval);
		};
	});

	onDestroy(() => disconnectSSE?.());
</script>

{#if summary}
	<header class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-semibold">Admin — {summary.event.name}</h1>
		<div class="text-slate-600">
			Code: <strong>{summary.event.code}</strong>
		</div>
	</header>
	<div class="grid gap-6 md:grid-cols-3">
		<section class="bg-white rounded-lg shadow p-6">
			<h2 class="font-semibold mb-3">Controls</h2>
			<div class="space-y-3">
				<div>
					<label class="block text-sm text-slate-600 mb-1">Join link</label>
					<div class="flex items-center gap-2">
						<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" readonly value={joinUrl} />
						<button class="rounded bg-slate-800 text-white px-3 py-2 text-sm hover:bg-slate-900" on:click={copyJoinLink}>Copy</button>
						<a class="rounded bg-emerald-600 text-white px-3 py-2 text-sm hover:bg-emerald-700" target="_blank" rel="noreferrer" href={joinUrl}>Open</a>
						<a class="rounded bg-indigo-600 text-white px-3 py-2 text-sm hover:bg-indigo-700" target="_blank" rel="noreferrer" href={`${joinUrl}&qr=1`}>QR</a>
					</div>
				</div>
				<div>
					<button
						class="inline-flex items-center justify-center gap-2 rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all relative overflow-hidden min-w-[180px]"
						disabled={loading || rematchCooldown > 0}
						on:click={rematchConnected}>
						<span class="relative z-10">
							{#if rematchCooldown > 0}
								Wait {Math.ceil(rematchCooldown / 1000)}s
							{:else if loading}
								Creating pairs...
							{:else}
								Rematch Connected
							{/if}
						</span>
						{#if rematchCooldown > 0}
							<div class="absolute inset-0 bg-indigo-800 transition-all" style="width: {100 - (rematchCooldown / 10)}%"></div>
						{/if}
					</button>
				</div>
			</div>
		</section>

		<section class="bg-white rounded-lg shadow p-6 md:col-span-2">
			<h2 class="font-semibold mb-3">Current Pairings</h2>
			{#if pairings.length > 0}
				<div class="flex flex-wrap gap-3">
					{#each pairings as pair}
						{@const participantA = summary.participants.find(p => p.id === pair.aParticipantId)}
						{@const participantB = summary.participants.find(p => p.id === pair.bParticipantId)}
						{@const participantC = pair.cParticipantId ? summary.participants.find(p => p.id === pair.cParticipantId) : null}
						{#if participantA && participantB}
							<div class="flex items-center gap-2 bg-indigo-50 rounded-full px-4 py-2 border border-indigo-200">
								<span class="text-2xl">{participantA.emojiId}</span>
								<span class="text-indigo-400 text-sm">↔</span>
								<span class="text-2xl">{participantB.emojiId}</span>
								{#if pair.isTrio && participantC}
									<span class="text-indigo-400 text-sm">↔</span>
									<span class="text-2xl">{participantC.emojiId}</span>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			{:else}
				<p class="text-slate-500 text-sm">No pairings yet. Click "Rematch Connected" to create pairings.</p>
			{/if}
		</section>

		<section class="bg-white rounded-lg shadow p-6 md:col-span-3">
			<h2 class="font-semibold mb-4">Participants</h2>

			{#if connectedParticipants.length > 0}
				<div class="mb-6">
					<h3 class="text-sm font-medium text-emerald-700 mb-3">Connected ({connectedParticipants.length})</h3>
					<div class="flex flex-wrap gap-3">
						{#each connectedParticipants as p}
							<div class="relative group">
								<div class="flex flex-col items-center justify-center w-20 h-20 bg-emerald-100 rounded-2xl border-2 border-emerald-400 hover:border-emerald-500 transition-colors">
									<span class="text-4xl">{p.emojiId}</span>
								</div>
								{#if p.displayName}
									<div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow-sm">
										{p.displayName}
									</div>
								{/if}
								<span class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if disconnectedParticipants.length > 0}
				<div>
					<h3 class="text-sm font-medium text-slate-500 mb-3">Disconnected ({disconnectedParticipants.length})</h3>
					<div class="flex flex-wrap gap-3">
						{#each disconnectedParticipants as p}
							<div class="relative group">
								<div class="flex flex-col items-center justify-center w-20 h-20 bg-slate-100 rounded-2xl border-2 border-slate-300 opacity-60">
									<span class="text-4xl grayscale">{p.emojiId}</span>
								</div>
								<div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow-sm">
									{#if p.displayName}{p.displayName} • {/if}{formatLastSeen(p.presence?.lastSeenAt)}
								</div>
								<span class="absolute -top-1 -right-1 w-3 h-3 bg-slate-400 rounded-full border-2 border-white"></span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if connectedParticipants.length === 0 && disconnectedParticipants.length === 0}
				<p class="text-slate-500 text-sm">No participants yet.</p>
			{/if}
		</section>
	</div>

	<!-- Toast Notification -->
	{#if toastVisible}
		<div class="fixed bottom-6 right-6 z-50 animate-slide-up">
			<div class="rounded-lg shadow-lg px-6 py-4 flex items-center gap-3 {toastType === 'success' ? 'bg-emerald-600' : toastType === 'error' ? 'bg-red-600' : 'bg-amber-500'} text-white">
				{#if toastType === 'success'}
					<span class="text-xl">✓</span>
				{:else if toastType === 'error'}
					<span class="text-xl">✗</span>
				{:else}
					<span class="text-xl">⚠</span>
				{/if}
				<span class="font-medium">{toastMessage}</span>
			</div>
		</div>
	{/if}
{:else}
	<p>Loading...</p>
{/if}

<style>
	@keyframes slide-up {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
	.animate-slide-up {
		animation: slide-up 0.3s ease-out;
	}
</style>
