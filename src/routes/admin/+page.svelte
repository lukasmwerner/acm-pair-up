<script lang="ts">
	import { saveSession } from '$lib/client/session';
	let admin = { name: 'Speed Friending', code: '' };
	let created: { id: string; code: string; adminKey: string } | null = null;
	let joinUrl = '';

	async function createEvent() {
		const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: admin.name, code: admin.code || undefined }) });
		const data = await res.json();
		created = data.event;
		saveSession({ eventId: created.id, adminKey: created.adminKey });
		joinUrl = `${location.origin}/join?e=${encodeURIComponent(created.id)}&code=${encodeURIComponent(created.code)}`;
	}

	function copy(text: string) { navigator.clipboard?.writeText(text).catch(()=>{}); }
</script>

<section class="bg-white rounded-lg shadow p-6 max-w-2xl">
	<h1 class="text-2xl font-semibold mb-4">Create Event</h1>
	<div class="space-y-3">
		<label class="block">
			<span class="text-sm">Name</span>
			<input class="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" bind:value={admin.name} placeholder="Event name" />
		</label>
		<label class="block">
			<span class="text-sm">Join Code (optional)</span>
			<input class="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" bind:value={admin.code} placeholder="e.g. ABCD" />
		</label>
		<button class="inline-flex items-center gap-2 rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700" on:click={createEvent}>Create</button>
		{#if created}
			<div class="mt-4 space-y-2">
				<p class="text-sm text-slate-700">Event ID: <code>{created.id}</code> — Code: <strong>{created.code}</strong></p>
				<p class="text-sm">Admin dashboard: <a class="underline" href={`/admin/${created.id}`}>/admin/{created.id}</a></p>
				<div class="pt-2">
					<label class="text-sm block mb-1">Join URL (QR-friendly)</label>
					<div class="flex items-center gap-2">
						<input class="flex-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" readonly value={joinUrl} />
						<button class="rounded bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300" on:click={() => copy(joinUrl)}>Copy</button>
					</div>
					<p class="text-xs text-slate-500 mt-1">Encode this URL as a QR code to let attendees scan-and-join.</p>
				</div>
			</div>
		{/if}
	</div>
</section>
