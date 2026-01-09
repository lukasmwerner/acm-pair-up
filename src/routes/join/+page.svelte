<script lang="ts">
	import { onMount } from 'svelte';
	import { saveSession, startHeartbeat } from '$lib/client/session';
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
{:else if showForm}
	<div class="max-w-md mx-auto mt-16">
		<div class="bg-white rounded-lg shadow p-8">
			<h1 class="text-2xl font-semibold mb-2">Join Event</h1>
			<p class="text-slate-600 mb-6">Enter the event code provided by the organizer.</p>

			<form on:submit|preventDefault={handleFormSubmit}>
				<div class="mb-6">
					<label for="code" class="block text-sm font-medium text-slate-700 mb-1">
						Event Code
					</label>
					<input
						type="text"
						id="code"
						bind:value={formCode}
						class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
						placeholder="Enter event code"
						disabled={joining}
					/>
				</div>

				{#if errorMsg}
					<div class="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">
						{errorMsg}
					</div>
				{/if}

				<button
					type="submit"
					disabled={joining}
					class="w-full px-6 py-3 bg-indigo-600 text-white font-medium rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{joining ? 'Joining...' : 'Join Event'}
				</button>
			</form>

			<p class="mt-4 text-sm text-slate-500 text-center">
				<a href="/" class="underline">Back to home</a>
			</p>
		</div>
	</div>
{:else}
	<p>Joining...</p>
{/if}
