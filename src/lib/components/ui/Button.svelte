<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
	}

	let { variant = 'primary', size = 'md', class: className, ...rest }: Props = $props();

	const variants = {
		primary: 'bg-[var(--surface-dark)] text-[var(--text-on-dark)] hover:bg-[var(--surface-dark-secondary)] shadow-sm',
		secondary: 'bg-[var(--background-alt)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--paper-dark)]',
		danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
		ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--background-alt)] hover:text-[var(--text-primary)]'
	};

	const sizes = {
		sm: 'px-2.5 py-1 text-xs',
		md: 'px-4 py-3 md:py-2 text-sm',
		lg: 'px-6 py-3 text-base'
	};

	let classes = $derived(`${variants[variant]} ${sizes[size]} rounded font-medium transition-all duration-[var(--transition-fast)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`);
</script>

<button class={classes} {...rest}>
	<slot />
</button>
