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
			hexId: string;
			displayName?: string;
			presence?: { connected: boolean };
		}>;
		round?: { id: string; index: number };
		connectedCount: number;
	};

	let summary: Summary | null = null;
	let partner: { hexId: string; displayName?: string } | null = null;
	let my = { id: "", hexId: "", token: "" };
	let cleanupHeartbeat: (() => void) | null = null;
	let disconnectSSE: (() => void) | null = null;

	function bgFromHex(hex: string) {
		// Map hex (base16) to hue; keep soft saturation/lightness for readability
		let val = 0;
		try {
			val = parseInt(hex, 16) % 360;
		} catch {}
		return `hsl(${val}, 70%, 90%)`;
	}

	let partnerBg = "transparent";
	$: partnerBg = partner ? bgFromHex(partner.hexId) : "transparent";

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
							hexId: other.hexId,
							displayName: other.displayName,
						};
				}
				if (p.bParticipantId === s.participantId) {
					const other = summary?.participants.find(
						(x) => x.id === p.aParticipantId,
					);
					if (other)
						partner = {
							hexId: other.hexId,
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
		my.hexId = s.hexId ?? "";
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
	<!-- Top overlay: self hex -->
	<div class="fixed top-3 inset-x-0 z-20 flex justify-center">
		<div class="rounded-full bg-white/80 px-4 py-1 shadow">
			<span class="font-mono text-2xl text-slate-800"
				>Your ID: {my.hexId}</span
			>
		</div>
	</div>

	<!-- Fullscreen partner area with derived background -->
	<section
		class="fixed inset-0 z-10 flex items-center justify-center"
		style="background-color: {partnerBg};"
	>
		{#if partner}
			<div class="text-center">
				<div
					class="font-mono text-[14vw] leading-none md:text-[10rem] text-slate-900"
				>
					{partner.hexId}
				</div>
				{#if partner.displayName}
					<div class="mt-2 text-slate-700 text-xl">
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
