<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { page } from "$app/stores";
	import {
		connectSSE,
		loadSession,
		startHeartbeat,
	} from "$lib/client/session";

	type Summary = {
		event: { id: string; name: string; code: string };
		participants: Array<{
			id: string;
			emojiId: string;
			emojiName: string;
			displayName?: string;
			presence?: { connected: boolean };
		}>;
		round?: { id: string; index: number };
		connectedCount: number;
	};

	let summary: Summary | null = null;
	let groupMembers: Array<{ emojiId: string; emojiName: string; displayName?: string }> = [];
	let my = { id: "", emojiId: "", emojiName: "", token: "" };
	let cleanupHeartbeat: (() => void) | null = null;
	let disconnectSSE: (() => void) | null = null;

	function bgFromEmoji(emoji: string) {
		// Generate consistent hue from emoji code point
		let hash = 0;
		for (let i = 0; i < emoji.length; i++) {
			hash = emoji.charCodeAt(i) + ((hash << 5) - hash);
		}
		const hue = Math.abs(hash) % 360;
		return `hsl(${hue}, 70%, 90%)`;
	}

	function bgFromGroup(members: typeof groupMembers) {
		if (members.length === 0) return "transparent";
		if (members.length === 1) return bgFromEmoji(members[0].emojiId);
		// For larger groups, blend hues or use a neutral gradient
		return "linear-gradient(135deg, hsl(220, 70%, 90%), hsl(280, 70%, 90%))";
	}

	let groupBg = "transparent";
	$: groupBg = bgFromGroup(groupMembers);

	async function fetchState(eventId: string) {
		const res = await fetch(`/api/events/${eventId}/state`);
		summary = await res.json();
	}

	async function fetchPairings(eventId: string) {
		const s = loadSession();
		if (!s?.participantId) return;
		const res = await fetch(`/api/events/${eventId}/pairings/current`);
		const data = await res.json();
		groupMembers = [];
		if (data.pairings) {
			for (const p of data.pairings) {
				// Check if current user is in this group
				const memberIds = [
					p.aParticipantId,
					p.bParticipantId,
					p.cParticipantId,
					p.dParticipantId,
				].filter(Boolean);

				if (memberIds.includes(s.participantId)) {
					// Found our group - get all other members
					groupMembers = memberIds
						.filter((id) => id !== s.participantId)
						.map((id) => summary?.participants.find((x) => x.id === id))
						.filter((p): p is NonNullable<typeof p> => p !== null && p !== undefined)
						.map((p) => ({
							emojiId: p.emojiId,
							emojiName: p.emojiName,
							displayName: p.displayName,
						}));
					break;
				}
			}
		}
	}

	async function disconnect() {
		if (!my.token) return;
		try {
			await fetch(`/api/events/${$page.params.eventId}/presence`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ participantToken: my.token })
			});
		} catch {
			// Best effort - server timeout will catch it anyway
		}
	}

	onMount(async () => {
		const eventId = $page.params.eventId;
		const s = loadSession();
		if (!s || s.eventId !== eventId) {
			alert("No session for this event. Join first.");
			location.href = "/";
			return;
		}
		my.id = s.participantId ?? "";
		my.emojiId = s.emojiId ?? "";
		my.emojiName = s.emojiName ?? "";
		my.token = s.participantToken ?? "";
		await fetchState(eventId);
		await fetchPairings(eventId);
		cleanupHeartbeat = startHeartbeat(eventId, my.token);
		disconnectSSE = connectSSE(eventId, async (msg) => {
			if (
				msg?.type === "presence:update" ||
				msg?.type === "pairings:updated"
			) {
				await fetchState(eventId);
				await fetchPairings(eventId);
			}
		});

		// Immediate disconnect on page close
		window.addEventListener('beforeunload', disconnect);
	});

	onDestroy(() => {
		cleanupHeartbeat?.();
		disconnectSSE?.();
		if (typeof window !== 'undefined') {
			window.removeEventListener('beforeunload', disconnect);
		}
		// Also disconnect on component unmount
		disconnect();
	});
</script>

<svelte:head>
	<title>{summary?.event.name || 'Event'} - ACM Pair Up</title>
</svelte:head>

{#if summary}
	<!-- Top overlay: self emoji -->
	<div class="fixed top-3 inset-x-0 z-20 flex justify-center">
		<div class="rounded-full bg-white/80 px-4 py-2 shadow">
			<div class="text-4xl">{my.emojiId}</div>
		</div>
	</div>

	<!-- Fullscreen group area with derived background -->
	<section
		class="fixed inset-0 z-10 flex items-center justify-center p-4"
		style="background: {groupBg};"
	>
		{#if groupMembers.length > 0}
			<div class="text-center w-full max-w-6xl">
				{#if groupMembers.length === 1}
					<!-- Single partner (pair) -->
					<div class="text-[20vw] leading-none md:text-[15rem]">
						{groupMembers[0].emojiId}
					</div>
					{#if groupMembers[0].displayName}
						<div class="mt-6 text-slate-800 text-3xl font-semibold">
							{groupMembers[0].displayName}
						</div>
					{/if}

				{:else if groupMembers.length === 2}
					<!-- Group of 3: side-by-side -->
					<div class="flex items-center justify-center gap-8 flex-wrap">
						{#each groupMembers as member}
							<div class="text-center">
								<div class="text-[15vw] md:text-[10rem]">
									{member.emojiId}
								</div>
								{#if member.displayName}
									<div class="mt-4 text-slate-800 text-2xl font-semibold">
										{member.displayName}
									</div>
								{/if}
							</div>
						{/each}
					</div>

				{:else if groupMembers.length === 3}
					<!-- Group of 4: 2x2 grid -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
						{#each groupMembers as member}
							<div class="text-center">
								<div class="text-[12vw] md:text-[8rem]">
									{member.emojiId}
								</div>
								{#if member.displayName}
									<div class="mt-3 text-slate-800 text-xl font-semibold">
										{member.displayName}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<div class="text-center">
				<p class="text-slate-700 text-xl">Waiting for pairing...</p>
				<p class="text-slate-600 text-sm mt-1">
					An organizer may rematch at any time.
				</p>
			</div>
		{/if}
	</section>

	<!-- Bottom overlay: event info -->
	<div
		class="fixed bottom-3 inset-x-0 z-20 text-center text-xs text-slate-600"
	>
		{summary.event.name} • Connected: {summary.connectedCount}
	</div>
{:else}
	<section class="fixed inset-0 flex items-center justify-center bg-slate-50">
		<p class="text-slate-700">Loading...</p>
	</section>
{/if}
