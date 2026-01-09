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
	let partner: { emojiId: string; emojiName: string; displayName?: string } | null = null;
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

	let partnerBg = "transparent";
	$: partnerBg = partner ? bgFromEmoji(partner.emojiId) : "transparent";

	async function fetchState(eventId: string) {
		const res = await fetch(`/api/events/${eventId}/state`);
		summary = await res.json();
	}

	async function fetchPairings(eventId: string) {
		const s = loadSession();
		if (!s?.participantId) return;
		const res = await fetch(`/api/events/${eventId}/pairings/current`);
		const data = await res.json();
		partner = null;
		if (data.pairings) {
			for (const p of data.pairings) {
				if (p.aParticipantId === s.participantId) {
					const other = summary?.participants.find(
						(x) => x.id === p.bParticipantId,
					);
					if (other)
						partner = {
							emojiId: other.emojiId,
							emojiName: other.emojiName,
							displayName: other.displayName,
						};
				}
				if (p.bParticipantId === s.participantId) {
					const other = summary?.participants.find(
						(x) => x.id === p.aParticipantId,
					);
					if (other)
						partner = {
							emojiId: other.emojiId,
							emojiName: other.emojiName,
							displayName: other.displayName,
						};
				}
			}
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
	});

	onDestroy(() => {
		cleanupHeartbeat?.();
		disconnectSSE?.();
	});
</script>

{#if summary}
	<!-- Top overlay: self emoji -->
	<div class="fixed top-3 inset-x-0 z-20 flex justify-center">
		<div class="rounded-full bg-white/80 px-4 py-2 shadow">
			<div class="text-4xl">{my.emojiId}</div>
		</div>
	</div>

	<!-- Fullscreen partner area with derived background -->
	<section
		class="fixed inset-0 z-10 flex items-center justify-center"
		style="background-color: {partnerBg};"
	>
		{#if partner}
			<div class="text-center">
				<div class="text-[20vw] leading-none md:text-[15rem]">
					{partner.emojiId}
				</div>
				{#if partner.displayName}
					<div class="mt-6 text-slate-800 text-3xl font-semibold">
						{partner.displayName}
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
