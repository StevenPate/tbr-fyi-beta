<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		id?: string;
		flipped?: boolean;
		duration?: number;
		aspectRatio?: string;
		front: Snippet;
		back: Snippet;
		ariaLabel?: string;
		autoFlipOnMount?: boolean;
		animationIndex?: number;
	}

	let {
		id,
		flipped = $bindable(false),
		duration = 600,
		aspectRatio = '2/3',
		front,
		back,
		ariaLabel = 'Flip card to see details',
		autoFlipOnMount = false,
		animationIndex = 0,
		class: className,
		...rest
	}: Props = $props();

	let containerEl: HTMLDivElement;
	let prefersReducedMotion = $state(false);
	let isFocused = $state(false);
	let showBackHint = $state(false);
	let backHintTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		// Check for reduced motion preference
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = mediaQuery.matches;

		const handleChange = (e: MediaQueryListEvent) => {
			prefersReducedMotion = e.matches;
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	});

	function handleClick() {
		// Clear focus hint immediately on click (prevents "Press Enter" hint on mobile/desktop clicks)
		isFocused = false;

		flipped = !flipped;

		// Show hint when flipping to back, auto-dismiss after 2 seconds
		if (flipped) {
			showBackHint = true;
			if (backHintTimeout) clearTimeout(backHintTimeout);
			backHintTimeout = setTimeout(() => {
				showBackHint = false;
			}, 2000);
		} else {
			showBackHint = false;
			if (backHintTimeout) clearTimeout(backHintTimeout);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		// Don't trigger flip if user is typing in an input/textarea
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
			return;
		}

		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();

			// Clear focus hint immediately
			isFocused = false;

			flipped = !flipped;

			// Show hint when flipping to back, auto-dismiss after 2 seconds
			if (flipped) {
				showBackHint = true;
				if (backHintTimeout) clearTimeout(backHintTimeout);
				backHintTimeout = setTimeout(() => {
					showBackHint = false;
				}, 2000);
			} else {
				showBackHint = false;
				if (backHintTimeout) clearTimeout(backHintTimeout);
			}
		}
	}
</script>

<div
	bind:this={containerEl}
	{id}
	class="flip-card fly-in {className || ''}"
	class:reduced-motion={prefersReducedMotion}
	class:auto-flip={autoFlipOnMount && !prefersReducedMotion}
	role="button"
	tabindex="0"
	aria-label={ariaLabel}
	aria-expanded={flipped}
	onclick={handleClick}
	onkeydown={handleKeydown}
	onfocus={() => isFocused = true}
	onblur={() => isFocused = false}
	style="--flip-duration: {duration}ms; --aspect-ratio: {aspectRatio}; --animation-index: {animationIndex};"
	{...rest}
>
	<div class="flip-card-inner" class:flipped>
		<div class="flip-card-front" aria-hidden={flipped}>
			{@render front()}
		</div>
		<div class="flip-card-back" aria-hidden={!flipped}>
			{@render back()}
		</div>
	</div>

	<!-- Keyboard hint (visible on focus) -->
	{#if isFocused && !flipped}
		<div class="keyboard-hint">
			Press Enter to flip
		</div>
	{/if}

	<!-- Back hint (auto-dismisses after 2 seconds) -->
	{#if showBackHint && flipped}
		<div class="keyboard-hint fade-out">
			Click to flip back
		</div>
	{/if}

	<!-- Screen reader announcement -->
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{flipped ? 'Card flipped to show details' : 'Card showing cover'}
	</div>
</div>

<style>
	.flip-card {
		perspective: 1000px;
		cursor: pointer;
		width: 100%;
		aspect-ratio: var(--aspect-ratio);
	}

	.flip-card:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
		border-radius: 0.5rem;
	}

	.flip-card-inner {
		position: relative;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		transition: transform var(--flip-duration) ease-in-out;
	}

	/* Instant flip for users who prefer reduced motion */
	.flip-card.reduced-motion .flip-card-inner {
		transition: transform 0s;
	}

	.flip-card-inner.flipped {
		transform: rotateY(180deg);
	}

	/* Auto-flip animation for first card */
	.flip-card.auto-flip .flip-card-inner {
		animation: autoFlip 1.2s ease-out;
	}

	@keyframes autoFlip {
		0% {
			transform: rotateY(180deg);
		}
		100% {
			transform: rotateY(0deg);
		}
	}

	/* Fly-in animation for all cards */
	.flip-card.fly-in {
		opacity: 0;
		animation: flyIn 0.6s ease-out forwards;
		animation-delay: calc(var(--animation-index) * 0.08s);
	}

	@keyframes flyIn {
		0% {
			opacity: 0;
			transform: translateY(20px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Disable animations for users who prefer reduced motion */
	.flip-card.reduced-motion.fly-in {
		opacity: 1;
		animation: none;
	}

	.flip-card-front,
	.flip-card-back {
		position: absolute;
		width: 100%;
		height: 100%;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.flip-card-inner.flipped .flip-card-back {
		box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
	}

	.flip-card-front {
		z-index: 2;
	}

	.flip-card-back {
		transform: rotateY(180deg);
		z-index: 1;
	}

	/* Keyboard hint for focused cards */
	.keyboard-hint {
		position: absolute;
		bottom: 8px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.8);
		color: white;
		padding: 4px 12px;
		border-radius: 4px;
		font-size: 0.75rem;
		white-space: nowrap;
		z-index: 10;
		pointer-events: none;
		animation: fadeIn 0.2s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	.keyboard-hint.fade-out {
		animation: fadeInOut 2s ease-in-out forwards;
	}

	@keyframes fadeInOut {
		0% {
			opacity: 0;
			transform: translateX(-50%) translateY(4px);
		}
		10% {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
		90% {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
		100% {
			opacity: 0;
			transform: translateX(-50%) translateY(-4px);
		}
	}

	/* Screen reader only content */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
