<script lang="ts">
	type Status = 'read' | 'owned';

	interface Props {
		status: Status;
		stacked?: boolean;
	}

	let { status, stacked = false }: Props = $props();

	let showIcon = $derived(status === 'read' || (status === 'owned' && !stacked));
</script>

<div
	class="status-badge animate-badge-pop"
	class:stacked
	class:status-read={status === 'read'}
	class:status-owned={status === 'owned'}
	aria-hidden="true"
>
	{#if showIcon}
		{#if status === 'read'}
			<svg
				width="10"
				height="10"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="20 6 9 17 4 12" />
			</svg>
		{:else if status === 'owned'}
			<svg
				width="10"
				height="10"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
			</svg>
		{/if}
	{/if}
</div>

<style>
	.status-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--paper-light);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		color: white;
	}

	.status-badge.stacked {
		top: 8px;
	}

	.status-badge.status-read {
		background-color: var(--status-read);
		z-index: 2;
	}

	.status-badge.status-owned {
		background-color: var(--status-owned);
		z-index: 1;
	}
</style>
