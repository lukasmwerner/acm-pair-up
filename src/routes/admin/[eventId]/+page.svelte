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
		dParticipantId?: string | null;
		groupSize?: 2 | 3 | 4;
	};

	let summary: Summary | null = null;
	let pairings: Pairing[] = [];
	let adminKey: string | null = null;
	let disconnectSSE: (() => void) | null = null;
	let loading = false;
	let joinUrl = "";
	let currentTime = Date.now();
	let lastRematchTime = 0;
	let rematchCooldown = 0;
	let selectedGroupSize: 2 | 4 = 2;

	// Toast notification state
	let toastMessage = "";
	let toastType: "success" | "error" | "warning" = "success";
	let toastVisible = false;

	function showToast(
		message: string,
		type: "success" | "error" | "warning" = "success",
	) {
		toastMessage = message;
		toastType = type;
		toastVisible = true;
		setTimeout(() => {
			toastVisible = false;
		}, 3000);
	}

	$: joinUrl =
		summary && typeof window !== "undefined"
			? `${location.origin}/join?e=${encodeURIComponent(summary.event.id)}&code=${encodeURIComponent(summary.event.code)}`
			: "";

	$: connectedParticipants =
		summary?.participants.filter((p) => p.presence?.connected) || [];
	$: disconnectedParticipants =
		summary?.participants.filter((p) => !p.presence?.connected) || [];

	function formatLastSeen(lastSeenAt?: number): string {
		if (!lastSeenAt) return "never";
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
			showToast("Join link copied!", "success");
		} catch (e) {
			console.error("Copy failed", e);
			showToast("Failed to copy link", "error");
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
				body: JSON.stringify({ adminKey, groupSize: selectedGroupSize }),
			},
		);
		loading = false;

		if (!res.ok) {
			showToast("Rematch failed - please try again", "error");
			return;
		}

		const data = await res.json();
		if (data.skipped) {
			const timeToWait = 1000 - (Date.now() - lastRematchTime);
			rematchCooldown = Math.max(0, timeToWait);
			showToast("Too fast! Please wait 1 second", "warning");
			return;
		}

		lastRematchTime = Date.now();
		showToast(
			`Created ${data.pairings?.length || 0} new pairings!`,
			"success",
		);
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

		const timeInterval = setInterval(() => {
			currentTime = Date.now();
		}, 1000);

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

<svelte:head>
	<title>{summary?.event.name || "Admin"} - ACM Pair Up</title>
</svelte:head>

<div
	class="fixed inset-0 overflow-y-auto bg-gradient-to-br from-slate-100 via-indigo-50 to-purple-100"
>
	<div class="relative z-10 min-h-screen p-4 md:p-6">
		{#if summary}
			<!-- Header -->
			<header
				class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
			>
				<div>
					<h1 class="text-2xl md:text-3xl font-bold text-slate-800">
						{summary.event.name}
					</h1>
					<p class="text-slate-600">Admin Dashboard</p>
				</div>
				<div class="flex items-center gap-3">
					<div
						class="px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-slate-600 shadow-sm"
					>
						Code: <strong class="text-indigo-700"
							>{summary.event.code}</strong
						>
					</div>
					<div
						class="px-4 py-2 bg-emerald-100/80 backdrop-blur-sm rounded-full text-sm text-emerald-700 shadow-sm"
					>
						{summary.connectedCount} online
					</div>
				</div>
			</header>

			<div class="grid gap-4 md:gap-6 lg:grid-cols-3">
				<!-- Controls Section -->
				<section
					class="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg p-6"
				>
					<h2
						class="font-semibold text-slate-800 mb-4 flex items-center gap-2"
					>
						<span class="text-xl">🎛️</span> Controls
					</h2>
					<div class="space-y-4">
						<div>
							<label
								for="join-link"
								class="block text-sm font-medium text-slate-700 mb-2"
								>Join Link</label
							>
							<div class="flex items-center gap-2">
								<input
									id="join-link"
									class="flex-1 px-3 py-2 border border-slate-200 rounded-xl bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
									readonly
									value={joinUrl}
								/>
								<button
									class="px-3 py-2 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-900 transition-all"
									on:click={copyJoinLink}
								>
									Copy
								</button>
							</div>
						</div>

						<div>
							<label
								class="block text-sm font-medium text-slate-700 mb-2"
							>
								Group Size
							</label>
							<div class="flex gap-2">
								<button
									type="button"
									class="flex-1 px-4 py-2 rounded-lg border-2 transition-all {selectedGroupSize ===
									2
										? 'border-purple-600 bg-purple-50 text-purple-700 font-semibold'
										: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}"
									on:click={() =>
										(selectedGroupSize = 2)}
								>
									Pairs (2)
								</button>
								<button
									type="button"
									class="flex-1 px-4 py-2 rounded-lg border-2 transition-all {selectedGroupSize ===
									4
										? 'border-purple-600 bg-purple-50 text-purple-700 font-semibold'
										: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}"
									on:click={() =>
										(selectedGroupSize = 4)}
								>
									Groups (4)
								</button>
							</div>
						</div>

						<div class="flex flex-col gap-3">
							<a
								class="w-full px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all text-center"
								target="_blank"
								rel="noreferrer"
								href={`${joinUrl}&qr=1`}
							>
								QR Code
							</a>
							<button
								class="w-full px-4 py-3 bg-purple-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative overflow-hidden"
								disabled={loading || rematchCooldown > 0}
								on:click={rematchConnected}
							>
								<span class="relative z-10">
									{#if rematchCooldown > 0}
										Wait {Math.ceil(
											rematchCooldown / 1000,
										)}s
									{:else if loading}
										Creating pairs...
									{:else}
										Rematch Connected
									{/if}
								</span>
								{#if rematchCooldown > 0}
									<div
										class="absolute inset-0 bg-indigo-800/50 transition-all"
										style="width: {100 -
											rematchCooldown / 10}%"
									></div>
								{/if}
							</button>
						</div>
					</div>
				</section>

				<!-- Current Pairings Section -->
				<section
					class="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg p-6 lg:col-span-2"
				>
					<h2
						class="font-semibold text-slate-800 mb-4 flex items-center gap-2"
					>
						<span class="text-xl">🔗</span> Current Pairings
						{#if summary.round}
							<span class="text-sm font-normal text-slate-500"
								>Round {summary.round.index + 1}</span
							>
						{/if}
					</h2>
					{#if pairings.length > 0}
						<div class="flex flex-wrap gap-3">
							{#each pairings as pair}
								{@const participantA =
									summary.participants.find(
										(p) => p.id === pair.aParticipantId,
									)}
								{@const participantB =
									summary.participants.find(
										(p) => p.id === pair.bParticipantId,
									)}
								{@const participantC = pair.cParticipantId
									? summary.participants.find(
											(p) => p.id === pair.cParticipantId,
										)
									: null}
								{@const participantD = pair.dParticipantId
									? summary.participants.find(
											(p) => p.id === pair.dParticipantId,
										)
									: null}
								{@const groupMembers = [
									participantA,
									participantB,
									participantC,
									participantD,
								].filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined)}
								{#if groupMembers.length >= 2}
									<div
										class="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-full px-4 py-2 border border-indigo-200/50 shadow-sm"
									>
										{#each groupMembers as member, i}
											{#if i > 0}
												<span
													class="text-indigo-400 text-sm"
													>↔</span
												>
											{/if}
											<span
												class="text-2xl"
												title={member.displayName ||
													member.emojiName}
												>{member.emojiId}</span
											>
										{/each}
										{#if pair.groupSize}
											<span
												class="ml-1 text-xs text-purple-600 font-semibold"
											>
												({pair.groupSize})
											</span>
										{/if}
									</div>
								{/if}
							{/each}
						</div>
					{:else}
						<div class="text-center py-8">
							<div class="text-4xl mb-2">🎲</div>
							<p class="text-slate-500">
								No pairings yet. Click "Rematch Connected" to
								create pairings.
							</p>
						</div>
					{/if}
				</section>

				<!-- Participants Section -->
				<section
					class="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg p-6 lg:col-span-3"
				>
					<h2
						class="font-semibold text-slate-800 mb-4 flex items-center gap-2"
					>
						<span class="text-xl">👥</span> Participants
						<span class="text-sm font-normal text-slate-500"
							>({summary.participants.length} total)</span
						>
					</h2>

					{#if connectedParticipants.length > 0}
						<div class="mb-6">
							<h3
								class="text-sm font-medium text-emerald-700 mb-3 flex items-center gap-2"
							>
								<span
									class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"
								></span>
								Connected ({connectedParticipants.length})
							</h3>
							<div class="flex flex-wrap gap-3">
								{#each connectedParticipants as p}
									<div class="relative group">
										<div
											class="flex flex-col items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-2xl border-2 border-emerald-300 hover:border-emerald-400 hover:shadow-md transition-all"
										>
											<span class="text-3xl md:text-4xl"
												>{p.emojiId}</span
											>
										</div>
										{#if p.displayName}
											<div
												class="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm z-10"
											>
												{p.displayName}
											</div>
										{/if}
										<span
											class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm"
										></span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if disconnectedParticipants.length > 0}
						<div>
							<h3
								class="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2"
							>
								<span class="w-2 h-2 bg-slate-400 rounded-full"
								></span>
								Disconnected ({disconnectedParticipants.length})
							</h3>
							<div class="flex flex-wrap gap-3">
								{#each disconnectedParticipants as p}
									<div class="relative group">
										<div
											class="flex flex-col items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-slate-100 rounded-2xl border-2 border-slate-200 opacity-60"
										>
											<span
												class="text-3xl md:text-4xl grayscale"
												>{p.emojiId}</span
											>
										</div>
										<div
											class="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm z-10"
										>
											{#if p.displayName}{p.displayName} •
											{/if}{formatLastSeen(
												p.presence?.lastSeenAt,
											)}
										</div>
										<span
											class="absolute -top-1 -right-1 w-3 h-3 bg-slate-400 rounded-full border-2 border-white shadow-sm"
										></span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if connectedParticipants.length === 0 && disconnectedParticipants.length === 0}
						<div class="text-center py-8">
							<div class="text-4xl mb-2">🦗</div>
							<p class="text-slate-500">
								No participants yet. Share the join link to get
								started!
							</p>
						</div>
					{/if}
				</section>
			</div>

			<!-- Toast Notification -->
			{#if toastVisible}
				<div class="fixed bottom-6 right-6 z-50 animate-slide-up">
					<div
						class="rounded-xl shadow-lg px-6 py-4 flex items-center gap-3 backdrop-blur-sm {toastType ===
						'success'
							? 'bg-emerald-600/90'
							: toastType === 'error'
								? 'bg-red-600/90'
								: 'bg-amber-500/90'} text-white"
					>
						{#if toastType === "success"}
							<span class="text-xl">✓</span>
						{:else if toastType === "error"}
							<span class="text-xl">✗</span>
						{:else}
							<span class="text-xl">⚠</span>
						{/if}
						<span class="font-medium">{toastMessage}</span>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Loading State -->
			<div class="min-h-screen flex flex-col items-center justify-center">
				<div class="text-6xl mb-4 animate-bounce">🔄</div>
				<p class="text-slate-600 font-medium">Loading dashboard...</p>
			</div>
		{/if}
	</div>
</div>

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
