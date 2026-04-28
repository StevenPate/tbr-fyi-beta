<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		open: boolean;
		options: { value: string; label: string }[];
		selected: string;
		onSelect: (value: string) => void;
		anchorEl?: HTMLElement;
		maxWidth?: number;
	}

	let { open = $bindable(), options, selected, onSelect, anchorEl, maxWidth }: Props = $props();

	let isMobile = $state(false);
	let position = $state({ top: 0, left: 0 });
	let dropdownEl: HTMLDivElement | undefined = $state();

	function updatePosition() {
		if (!anchorEl || isMobile) return;
		const rect = anchorEl.getBoundingClientRect();
		const margin = 8;

		// Measure actual dropdown if available, else estimate
		const dropdownWidth = dropdownEl?.offsetWidth || 160;
		const dropdownHeight = dropdownEl?.offsetHeight || (options.length * 36 + 8);

		let top = rect.bottom + 4;
		let left = rect.left;

		// Flip above trigger if it would overflow bottom
		if (top + dropdownHeight > window.innerHeight - margin) {
			top = rect.top - dropdownHeight - 4;
		}
		// Clamp to stay within viewport
		top = Math.max(margin, Math.min(top, window.innerHeight - dropdownHeight - margin));
		left = Math.max(margin, Math.min(left, window.innerWidth - dropdownWidth - margin));

		position = { top, left };
	}

	$effect(() => {
		if (open && anchorEl) {
			// Tick to let dropdown render, then measure and reposition
			requestAnimationFrame(() => updatePosition());
		}
	});

	function handleSelect(value: string) {
		onSelect(value);
		open = false;
	}

	function handleBackdropClick() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
		}
	}

	onMount(() => {
		isMobile = window.innerWidth < 640;
		const mql = window.matchMedia('(max-width: 639px)');
		const handler = (e: MediaQueryListEvent) => {
			isMobile = e.matches;
		};
		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	});
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40"
		class:backdrop-dim={isMobile}
		onclick={handleBackdropClick}
		role="presentation"
	></div>

	{#if isMobile}
		<!-- Bottom sheet -->
		<div
			class="popover-sheet fixed inset-x-0 bottom-0 z-50 rounded-t-2xl shadow-lg px-4 pt-3"
			style="padding-bottom: max(1.5rem, env(safe-area-inset-bottom));"
			role="listbox"
			aria-label="Filter options"
		>
			<!-- Drag handle -->
			<div class="w-10 h-1 rounded-full mx-auto mb-4" style="background: var(--border);"></div>
			<div class="flex flex-col gap-1">
				{#each options as option}
					<button
						class="popover-option popover-option-mobile"
						class:popover-option-selected={option.value === selected}
						onclick={() => handleSelect(option.value)}
						role="option"
						aria-selected={option.value === selected}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Desktop dropdown -->
		<div
			bind:this={dropdownEl}
			class="popover-dropdown fixed z-50 rounded-lg shadow-lg py-1 min-w-[160px]"
			style="top: {position.top}px; left: {position.left}px;{maxWidth ? ` max-width: ${maxWidth}px;` : ''}"
			role="listbox"
			aria-label="Filter options"
		>
			{#each options as option}
				<button
					class="popover-option popover-option-desktop"
					class:popover-option-selected={option.value === selected}
					onclick={() => handleSelect(option.value)}
					role="option"
					aria-selected={option.value === selected}
				>
					{option.label}
				</button>
			{/each}
		</div>
	{/if}
{/if}

<style>
	.backdrop-dim {
		background: rgba(0, 0, 0, 0.25);
	}

	.popover-sheet {
		background: var(--surface);
		animation: slide-up 200ms ease-out;
		max-height: 70vh;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.popover-dropdown {
		background: var(--surface);
		border: 1px solid var(--border);
		max-height: min(320px, 60vh);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.popover-option {
		text-align: left;
		width: 100%;
		border: none;
		background: none;
		cursor: pointer;
		transition: background var(--transition-fast), color var(--transition-fast);
		color: var(--text-secondary);
	}

	.popover-option-mobile {
		padding: 12px 16px;
		border-radius: 8px;
		font-size: 1rem;
		line-height: 1.5;
	}

	.popover-option-mobile:active {
		background: var(--background-alt);
	}

	.popover-option-desktop {
		padding: 8px 16px;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.popover-option-desktop:hover {
		background: var(--background-alt);
	}

	.popover-option-selected {
		background: var(--background);
		color: var(--text-primary);
		font-weight: 500;
	}

	@keyframes slide-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.popover-sheet {
			animation: none;
		}
	}
</style>
