<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'size'> {
		size?: 'sm' | 'md' | 'lg';
		value?: string | number;
	}

	let { size = 'md', value = $bindable(), class: className, ...rest }: Props = $props();

	const sizes = {
		sm: 'px-2.5 py-1 text-xs',
		md: 'px-3 py-2 text-sm',
		lg: 'px-4 py-3 text-base'
	};

	const classes = `${sizes[size]} w-full border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`;
</script>

<input bind:value class={classes} {...rest} />
