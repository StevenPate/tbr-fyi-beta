<script lang="ts">
	import { onMount } from 'svelte';
	import Popover from './Popover.svelte';

	interface Shelf {
		id: string;
		name: string;
	}

	interface Props {
		status: 'all' | 'unread' | 'read' | 'without-notes';
		view: 'books' | 'notes';
		shelfId: string | null;
		shelves: Shelf[];
		defaultShelfId: string | null;
		onCreateShelf?: () => void;
	}

	let {
		status = $bindable(),
		view = $bindable(),
		shelfId = $bindable(),
		shelves,
		defaultShelfId,
		onCreateShelf
	}: Props = $props();

	// Popover open states
	let statusOpen = $state(false);
	let viewOpen = $state(false);
	let shelfOpen = $state(false);

	// Anchor elements for popover positioning
	let statusEl: HTMLButtonElement | undefined = $state();
	let viewEl: HTMLButtonElement | undefined = $state();
	let shelfEl: HTMLButtonElement | undefined = $state();

	// Sentence element for measuring width
	let sentenceEl: HTMLDivElement | undefined = $state();
	const sentenceWidth = $derived(() => sentenceEl?.offsetWidth || 0);

	// Whether filters are at their defaults
	const isDefault = $derived(() => {
		const defaultShelf = defaultShelfId || null;
		return status === 'all' && view === 'books' && shelfId === defaultShelf;
	});

	function resetFilters() {
		status = 'all';
		view = 'books';
		shelfId = defaultShelfId || null;
	}

	// First-run hint
	let showHint = $state(false);
	onMount(() => {
		if (!localStorage.getItem('nlp-filter-dismissed')) {
			showHint = true;
		}
	});
	function dismissHint() {
		showHint = false;
		localStorage.setItem('nlp-filter-dismissed', '1');
	}

	// --- Option lists ---

	const allStatusOptions = [
		{ value: 'all', label: 'all' },
		{ value: 'unread', label: 'unread' },
		{ value: 'read', label: 'read' },
		{ value: 'without-notes', label: 'without notes' }
	];

	// Hide "without notes" when in notes view — it's contradictory
	const statusOptions = $derived(() => {
		if (view === 'notes') {
			return allStatusOptions.filter(o => o.value !== 'without-notes');
		}
		return allStatusOptions;
	});

	const viewOptions = [
		{ value: 'books', label: 'books' },
		{ value: 'notes', label: 'notes' }
	];

	const shelfOptions = $derived(() => {
		const opts: { value: string; label: string }[] = [
			{ value: '__all__', label: 'all shelves' }
		];
		for (const shelf of shelves) {
			opts.push({ value: shelf.id, label: shelf.name });
		}
		if (onCreateShelf) {
			opts.push({ value: '__new__', label: '+ new shelf' });
		}
		return opts;
	});

	// --- Derived display labels ---

	const currentShelfName = $derived(() => {
		if (!shelfId) return 'all shelves';
		const shelf = shelves.find((s) => s.id === shelfId);
		return shelf?.name || 'all shelves';
	});

	const statusLabel = $derived(() => {
		return allStatusOptions.find((o) => o.value === status)?.label || 'all';
	});

	const viewLabel = $derived(() => {
		return viewOptions.find((o) => o.value === view)?.label || 'books';
	});

	// --- Selection handlers ---

	function handleStatusSelect(value: string) {
		status = value as typeof status;
		if (showHint) dismissHint();
	}

	function handleViewSelect(value: string) {
		view = value as typeof view;
		// Auto-reset contradictory combination
		if (view === 'notes' && status === 'without-notes') {
			status = 'all';
		}
		if (showHint) dismissHint();
	}

	function handleShelfSelect(value: string) {
		if (value === '__new__') {
			onCreateShelf?.();
			return;
		}
		shelfId = value === '__all__' ? null : value;
		if (showHint) dismissHint();
	}
</script>

<div class="nlp-sentence" bind:this={sentenceEl}>
	<span class="nlp-prefix">I'm looking at</span>

	<!-- Sentence structure depends on view mode -->
	{#if status === 'without-notes' && view === 'books'}
		<!-- "books without notes" — "books" = view trigger, "without notes" = status trigger -->
		<button
			bind:this={viewEl}
			onclick={() => { viewOpen = !viewOpen; }}
			class="nlp-trigger"
		>books</button>

		<button
			bind:this={statusEl}
			onclick={() => { statusOpen = !statusOpen; }}
			class="nlp-trigger"
		>without notes</button>
	{:else if view === 'notes'}
		<!-- "notes for [status] books" -->
		<button
			bind:this={viewEl}
			onclick={() => { viewOpen = !viewOpen; }}
			class="nlp-trigger"
		>notes</button>

		{#if status !== 'all'}
			<span class="nlp-word">for</span>

			<button
				bind:this={statusEl}
				onclick={() => { statusOpen = !statusOpen; }}
				class="nlp-trigger"
			>{statusLabel()}</button>

			<span class="nlp-word">books</span>
		{:else}
			<span class="nlp-word">for</span>

			<button
				bind:this={statusEl}
				onclick={() => { statusOpen = !statusOpen; }}
				class="nlp-trigger"
			>all books</button>
		{/if}
	{:else}
		<!-- "[status] books" -->
		<button
			bind:this={statusEl}
			onclick={() => { statusOpen = !statusOpen; }}
			class="nlp-trigger"
		>{statusLabel()}</button>

		<button
			bind:this={viewEl}
			onclick={() => { viewOpen = !viewOpen; }}
			class="nlp-trigger"
		>{viewLabel()}</button>
	{/if}

	<span class="nlp-word">in</span>

	<button
		bind:this={shelfEl}
		onclick={() => {
			shelfOpen = !shelfOpen;
		}}
		class="nlp-trigger nlp-shelf-name"
	>{currentShelfName()}</button><span class="nlp-period">.</span>

	{#if !isDefault()}
		<button
			class="nlp-reset"
			onclick={resetFilters}
			aria-label="Reset filters"
			title="Reset filters"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
				<path d="M3 3v5h5"/>
			</svg>
		</button>
	{/if}
</div>

{#if showHint}
	<p class="nlp-hint">
		Tap an underlined word to filter.
		<button class="nlp-hint-dismiss" onclick={dismissHint}>Got it</button>
	</p>
{/if}

<Popover
	bind:open={statusOpen}
	options={statusOptions()}
	selected={status}
	onSelect={handleStatusSelect}
	anchorEl={statusEl}
	maxWidth={sentenceWidth()}
/>
<Popover
	bind:open={viewOpen}
	options={viewOptions}
	selected={view}
	onSelect={handleViewSelect}
	anchorEl={viewEl}
	maxWidth={sentenceWidth()}
/>
<Popover
	bind:open={shelfOpen}
	options={shelfOptions()}
	selected={shelfId || '__all__'}
	onSelect={handleShelfSelect}
	anchorEl={shelfEl}
	maxWidth={sentenceWidth()}
/>

<style>
	/* The interactive sentence */
	.nlp-sentence {
		font-family: var(--font-serif);
		font-size: var(--text-xl);
		line-height: var(--leading-snug);
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}

	@media (min-width: 768px) {
		.nlp-sentence {
			font-size: var(--text-2xl);
		}
	}

	/* Static words in the sentence */
	.nlp-prefix,
	.nlp-word,
	.nlp-period {
		/* Inherits font from parent */
	}

	/* Tappable variable words */
	.nlp-trigger {
		font-family: var(--font-serif);
		font-size: inherit;
		line-height: inherit;
		letter-spacing: inherit;
		color: inherit;
		font-weight: 700;
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: var(--text-secondary);
		text-underline-offset: 4px;
		text-decoration-thickness: 2px;
		transition: text-decoration-color var(--transition-base);
	}

	.nlp-trigger:hover {
		text-decoration-color: var(--accent);
	}

	/* Shelf name truncation — wider allowance on narrow screens */
	.nlp-shelf-name {
		max-width: 60%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: inline-block;
		vertical-align: bottom;
	}

	@media (min-width: 768px) {
		.nlp-shelf-name {
			max-width: 40%;
		}
	}

	/* Reset button — subtle but findable */
	.nlp-reset {
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
		background: none;
		border: none;
		padding: 4px;
		margin-left: 6px;
		cursor: pointer;
		color: var(--text-secondary);
		opacity: 0.3;
		transition: opacity var(--transition-base);
	}

	.nlp-reset:hover,
	.nlp-reset:focus-visible {
		opacity: 0.7;
	}

	/* First-run hint */
	.nlp-hint {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-secondary);
		margin-top: var(--space-2);
	}

	.nlp-hint-dismiss {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-secondary);
		background: none;
		border: none;
		padding: 0;
		margin-left: var(--space-1);
		text-decoration: underline;
		cursor: pointer;
		transition: color var(--transition-fast);
	}

	.nlp-hint-dismiss:hover {
		color: var(--text-primary);
	}
</style>
