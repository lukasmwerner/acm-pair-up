<script lang="ts">
	import { onMount } from "svelte";
	import {
		loadSession,
		saveSession,
		startHeartbeat,
	} from "$lib/client/session";
	let eventId = "";
	let code = "";
	let displayName = "";

	onMount(() => {
		const s = loadSession();
		if (s?.eventId) eventId = s.eventId;
	});

	async function join() {
		const res = await fetch(`/api/events/${eventId}/join`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code, displayName }),
		});
		if (!res.ok) {
			alert("Join failed");
			return;
		}
		const data = await res.json();
		saveSession({
			eventId,
			participantToken: data.participantToken,
			hexId: data.hexId,
			participantId: data.participantId,
		});
		startHeartbeat(eventId, data.participantToken);
		location.href = `/events/${eventId}`;
	}
</script>

<section class="bg-white rounded-lg shadow p-6 max-w-xl mx-auto">
	<h1 class="text-2xl font-semibold mb-4">Join Event</h1>
	<div class="space-y-3">
		<label class="block">
			<span class="text-sm">Event ID</span>
			<input
				class="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
				bind:value={eventId}
				placeholder="evt_..."
			/>
		</label>
		<label class="block">
			<span class="text-sm">Join Code</span>
			<input
				class="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
				bind:value={code}
				placeholder="ABCD"
			/>
		</label>
		<label class="block">
			<span class="text-sm">Display Name (optional)</span>
			<input
				class="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
				bind:value={displayName}
				placeholder="Jane"
			/>
		</label>
	</div>
</section>
