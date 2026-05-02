<script lang="ts">
	import { page } from '$app/stores';

	interface Props {
		/** Path segment shown after TBR.fyi/ (e.g. username). Omit for non-shelf pages. */
		pathSegment?: string;
		/** URL the path segment links to. Defaults to /{pathSegment}. */
		pathHref?: string;
		/** Whether the current user is the authenticated owner (shows Settings/Sign out). */
		isOwner?: boolean;
		/** Settings link href. Only used when isOwner is true. */
		settingsHref?: string;
		/** Signed-in user object from layout data. If present + not owner, still shows Sign out. */
		user?: { phone_number: string; username?: string | null } | null;
	}

	let {
		pathSegment,
		pathHref,
		isOwner = false,
		settingsHref,
		user = null,
	}: Props = $props();

	async function handleSignOut() {
		await fetch('/api/auth/session', { method: 'DELETE' });
		window.location.href = '/';
	}
</script>

<nav class="site-nav">
	<div class="site-nav-inner">
		<div class="site-nav-path"><a href="/">TBR.fyi</a>{#if pathSegment}<span class="path-sep">/</span><a class="path-segment" href={pathHref || `/${pathSegment}`}>{pathSegment}</a>{/if}</div>
		<div class="site-nav-links">
			{#if isOwner}
				{#if settingsHref}
					<a href={settingsHref}>Settings</a>
				{/if}
				<button onclick={handleSignOut}>Sign out</button>
			{:else if user}
				<button onclick={handleSignOut}>Sign out</button>
			{:else}
				<a href="/auth/signin">Sign in</a>
			{/if}
		</div>
	</div>
</nav>

<style>
	.site-nav {
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		padding: 16px 24px;
	}

	.site-nav-inner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		max-width: var(--content-width);
		margin: 0 auto;
	}

	.site-nav-path {
		font-family: var(--font-serif);
		font-weight: 600;
		font-size: 20px;
		color: var(--text-primary);
	}

	.site-nav-path a {
		color: var(--text-primary);
		text-decoration: none;
	}

	.site-nav-path a:hover {
		color: var(--accent);
	}

	.site-nav-path .path-sep {
		color: var(--text-secondary);
		font-weight: 400;
	}

	.site-nav-path .path-segment {
		color: var(--accent);
	}

	.site-nav-path .path-segment:hover {
		color: var(--accent-hover);
	}

	.site-nav-links {
		display: flex;
		align-items: center;
		gap: 16px;
		font-size: var(--text-sm);
	}

	.site-nav-links a,
	.site-nav-links button {
		color: var(--accent);
		text-decoration: none;
		background: none;
		border: none;
		cursor: pointer;
		font-size: inherit;
		padding: 0;
	}

	.site-nav-links a:hover,
	.site-nav-links button:hover {
		color: var(--accent-hover);
		text-decoration: underline;
	}
</style>
