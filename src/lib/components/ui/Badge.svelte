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
		default: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300',
		success: 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-300',
		info: 'bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-300',
		warning: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300',
		amber: 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
	};

	const sizes = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-1 text-xs'
	};

	const classes = `${variants[variant]} ${sizes[size]} rounded-lg font-medium transition-colors inline-flex items-center ${interactive ? 'cursor-pointer' : ''} ${className || ''}`;
</script>

<span class={classes} {...rest}>
	<slot />
</span>
