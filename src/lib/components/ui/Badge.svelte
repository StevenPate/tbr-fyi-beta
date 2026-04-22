<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		variant?: 'default' | 'success' | 'info' | 'warning' | 'amber';
		size?: 'sm' | 'md';
		interactive?: boolean;
	}

	let {
		variant = 'default',
		size = 'md',
		interactive = false,
		class: className,
		...rest
	}: Props = $props();

	const variants = {
		default: 'bg-[var(--background-alt)] text-[var(--text-secondary)] border border-[var(--border)]',
		success: 'bg-green-50 text-[var(--status-read)] border border-green-200',
		info: 'bg-blue-50 text-blue-700 border border-blue-200',
		warning: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
		amber: 'bg-amber-50 text-amber-700 border border-amber-200'
	};

	const sizes = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-1 text-xs'
	};

	const classes = `${variants[variant]} ${sizes[size]} rounded font-medium transition-colors inline-flex items-center ${interactive ? 'cursor-pointer' : ''} ${className || ''}`;
</script>

<span class={classes} {...rest}>
	<slot />
</span>
