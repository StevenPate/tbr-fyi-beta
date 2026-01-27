<script lang="ts">
	import { REACTION_CHIPS, type ReactionChip } from './reaction-chips';

	interface Props {
		selected: Set<string>;
		onToggle: (chipId: string) => void;
		onOtherClick?: () => void;
	}

	let { selected, onToggle, onOtherClick }: Props = $props();

	function handleChipClick(chip: ReactionChip) {
		onToggle(chip.id);
	}

	function handleOtherClick() {
		onOtherClick?.();
	}
</script>

<div class="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
	{#each REACTION_CHIPS as chip}
		<button
			type="button"
			onclick={() => handleChipClick(chip)}
			class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ease-out border {selected.has(chip.id)
				? 'bg-stone-700 text-white border-stone-700'
				: 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 hover:border-stone-300'}"
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
			class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ease-out border bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 hover:border-stone-300"
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
