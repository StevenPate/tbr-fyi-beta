<script lang="ts">
	import { REACTION_CHIPS, type ReactionChip } from './reaction-chips';

	interface Props {
		selected: Set<string>;
		onToggle: (chipId: string) => void;
		onOtherClick?: () => void;
		wrap?: boolean;
	}

	let { selected, onToggle, onOtherClick, wrap = false }: Props = $props();

	function handleChipClick(chip: ReactionChip) {
		onToggle(chip.id);
	}

	function handleOtherClick() {
		onOtherClick?.();
	}
</script>

<div class="flex gap-2 {wrap ? 'flex-wrap justify-center' : 'overflow-x-auto scrollbar-hide'}">
	{#each REACTION_CHIPS as chip}
		<button
			type="button"
			onclick={() => handleChipClick(chip)}
			class="{wrap ? '' : 'flex-shrink-0'} flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out border active:scale-[0.97] {selected.has(chip.id)
				? 'bg-[var(--surface-dark)] text-[var(--text-on-dark)] border-[var(--surface-dark)] scale-[1.02]'
				: 'bg-[var(--paper-light)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--paper-mid)] hover:border-[var(--warm-gray)]'}"
			aria-pressed={selected.has(chip.id)}
		>
			<span class="text-base leading-none">{chip.emoji}</span>
			<span>{chip.label}</span>
		</button>
	{/each}

	{#if onOtherClick}
		<button
			type="button"
			onclick={handleOtherClick}
			class="{wrap ? '' : 'flex-shrink-0'} flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out border active:scale-[0.97] bg-[var(--paper-light)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--paper-mid)] hover:border-[var(--warm-gray)]"
		>
			<span class="text-base leading-none">✏️</span>
			<span>Other...</span>
		</button>
	{/if}
</div>

<style>
	/* Hide scrollbar but allow scrolling */
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
