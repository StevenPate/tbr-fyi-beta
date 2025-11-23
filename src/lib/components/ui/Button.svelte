<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
	}

	let { variant = 'primary', size = 'md', class: className, ...rest }: Props = $props();

	const variants = {
		primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
		secondary: 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400',
		danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
		ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200'
	};

	const sizes = {
		sm: 'px-2.5 py-1 text-xs',
		md: 'px-4 py-2 text-sm',
		lg: 'px-6 py-3 text-base'
	};

	let classes = $derived(`${variants[variant]} ${sizes[size]} rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`);
</script>

<button class={classes} {...rest}>
	<slot />
</button>
