<script lang="ts">
	import { onMount } from 'svelte';
	import { saveSession, startHeartbeat } from '$lib/client/session';
	let errorMsg = '';
	let qrMode = false;
	let joinUrl = '';

	onMount(async () => {
		const url = new URL(location.href);
		const eventId = url.searchParams.get('e') || url.searchParams.get('event') || '';
		const code = url.searchParams.get('code') || url.searchParams.get('c') || '';
		const displayName = url.searchParams.get('name') || '';
		const qr = url.searchParams.get('qr') || '';
		if (!eventId || !code) { errorMsg = 'Missing event or code'; return; }
		joinUrl = `${location.origin}/join?e=${encodeURIComponent(eventId)}&code=${encodeURIComponent(code)}${displayName ? `&name=${encodeURIComponent(displayName)}` : ''}`;
		if (qr) { qrMode = true; return; }
		const res = await fetch(`/api/events/${eventId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, displayName }) });
		if (!res.ok) { errorMsg = 'Join failed'; return; }
		const data = await res.json();
		saveSession({ eventId, participantToken: data.participantToken, hexId: data.hexId, participantId: data.participantId });
		startHeartbeat(eventId, data.participantToken);
		location.href = `/events/${eventId}`;
	});
</script>

{#if qrMode}
	<section class="min-h-dvh flex flex-col items-center justify-center text-center">
		<h1 class="text-2xl font-semibold mb-4">Scan to Join</h1>
		<div class="bg-white p-4 rounded-lg shadow">
			<img alt="Join QR code" width="420" height="420" src={"https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=" + encodeURIComponent(joinUrl)} />
		</div>
		<div class="mt-4 text-sm text-slate-600 break-all">{joinUrl}</div>
		<div class="mt-3 flex gap-2">
			<a class="rounded bg-slate-800 text-white px-3 py-2 text-sm hover:bg-slate-900" target="_blank" rel="noreferrer" href={joinUrl}>Open Link</a>
			<button class="rounded bg-indigo-600 text-white px-3 py-2 text-sm hover:bg-indigo-700" on:click={() => navigator.clipboard.writeText(joinUrl)}>Copy</button>
		</div>
	</section>
{:else if errorMsg}
	<div class="bg-white rounded p-6 shadow">
		<p class="text-red-700">{errorMsg}</p>
		<p class="mt-2 text-sm"><a class="underline" href="/">Go back</a></p>
	</div>
{:else}
	<p>Joining...</p>
{/if}
