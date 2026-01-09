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

	$: joinUrl = summary && typeof window !== 'undefined'
		? `${location.origin}/join?e=${encodeURIComponent(summary.event.id)}&code=${encodeURIComponent(summary.event.code)}`
		: '';

	async function copyJoinLink() {
		if (!joinUrl) return;
		try {
			await navigator.clipboard.writeText(joinUrl);
			alert('Join link copied');
		} catch (e) {
			console.error('Copy failed', e);
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
			alert("No admin key");
			return;
		}
		/*if (!confirm('Rematch all connected participants now?')) return;*/
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
			alert("Rematch failed");
			return;
		}
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
						class="inline-flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
						disabled={loading}
						on:click={rematchConnected}>Rematch Connected</button>
				</div>
			</div>
		</section>

		<section class="bg-white rounded-lg shadow p-6 md:col-span-2">
			<h2 class="font-semibold mb-3">Current Pairings</h2>
			{#if pairings.length > 0}
				<ul class="space-y-2">
					{#each pairings as pair}
						{@const participantA = summary.participants.find(p => p.id === pair.aParticipantId)}
						{@const participantB = summary.participants.find(p => p.id === pair.bParticipantId)}
						{@const participantC = pair.cParticipantId ? summary.participants.find(p => p.id === pair.cParticipantId) : null}
						{#if participantA && participantB}
							<li class="flex items-center gap-3 py-2">
								<span class="text-2xl">{participantA.emojiId}</span>
								{#if participantA.displayName}
									<span class="text-sm text-slate-600">{participantA.displayName}</span>
								{/if}
								<span class="text-slate-400">→</span>
								<span class="text-2xl">{participantB.emojiId}</span>
								{#if participantB.displayName}
									<span class="text-sm text-slate-600">{participantB.displayName}</span>
								{/if}
								{#if pair.isTrio && participantC}
									<span class="text-slate-400">→</span>
									<span class="text-2xl">{participantC.emojiId}</span>
									{#if participantC.displayName}
										<span class="text-sm text-slate-600">{participantC.displayName}</span>
									{/if}
								{/if}
							</li>
						{/if}
					{/each}
				</ul>
			{:else}
				<p class="text-slate-500 text-sm">No pairings yet. Click "Rematch Connected" to create pairings.</p>
			{/if}
		</section>

		<section class="bg-white rounded-lg shadow p-6 md:col-span-3">
			<h2 class="font-semibold mb-3">Participants</h2>
			<ul class="divide-y">
				{#each summary.participants as p}
					<li class="flex items-center justify-between py-2">
						<div class="flex items-center gap-3">
							<span
								class="inline-block h-2 w-2 rounded-full {p
									.presence?.connected
									? 'bg-emerald-500'
									: 'bg-slate-300'}"
							></span>
							<span class="text-2xl">{p.emojiId}</span>
							{#if p.displayName}
								<span class="text-slate-700"
									>{p.displayName}</span
								>
							{/if}
						</div>
						<div class="text-sm text-slate-500">
							{p.presence?.connected ? "connected" : "away"}
						</div>
					</li>
				{/each}
			</ul>
		</section>
	</div>
{:else}
	<p>Loading...</p>
{/if}
