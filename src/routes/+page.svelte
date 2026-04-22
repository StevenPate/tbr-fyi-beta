<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let identifier = $state('');
	let isReturningUser = $state(false);

	onMount(() => {
		// Check if user has visited before
		const savedId = localStorage.getItem('tbr-userId') || '';
		if (savedId) {
			identifier = savedId;
			isReturningUser = true;
		}
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!identifier) return;

		const trimmed = identifier.trim();

		// Check if it looks like a username (contains letters, no + prefix)
		const hasLetters = /[a-zA-Z]/.test(trimmed);
		const isPhoneFormat = trimmed.startsWith('+') || /^\d{10,}$/.test(trimmed.replace(/\D/g, ''));

		if (hasLetters && !isPhoneFormat) {
			// It's a username - navigate directly
			goto(`/${encodeURIComponent(trimmed)}`);
		} else {
			// It's a phone number - normalize it
			let normalized = trimmed.replace(/\D/g, '');
			if (normalized.length === 10) {
				normalized = '+1' + normalized;
			} else if (normalized.length === 11 && normalized.startsWith('1')) {
				normalized = '+' + normalized;
			} else if (!trimmed.startsWith('+')) {
				normalized = '+' + normalized;
			} else {
				normalized = trimmed; // Already has + prefix
			}

			localStorage.setItem('tbr-userId', normalized);
			goto(`/${encodeURIComponent(normalized)}`);
		}
	}
</script>

<svelte:head>
	<title>TBR.fyi - text yourself books</title>
	<meta name="description" content="Someone mentions a book on a podcast, in a group chat, or across the table from you - text it to TBR.fyi and it lands on your shelf. No app to install. No account to remember." />
	<meta property="og:title" content="TBR.fyi - text yourself books" />
	<meta property="og:description" content="Text yourself book recommendations. No app to install. No account to remember." />
	<meta property="og:image" content="https://tbr.fyi/og-image.png" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://tbr.fyi" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="https://tbr.fyi/og-image.png" />
</svelte:head>

<!-- Hero -->
<section class="bg-[var(--surface-dark)] py-16 px-6">
	<div class="max-w-xl mx-auto text-center">
		<h1 class="font-serif italic text-2xl text-[var(--text-on-dark)] mb-4">
			text yourself books
		</h1>
		<p class="text-base text-[var(--text-on-dark)] opacity-70 mb-8">
			Someone mentions a book on a podcast, in a group chat, or across the table from you — text it to your shelf.
		</p>
		<a
			href="sms:+13605044327"
			class="inline-block text-xl font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
		>
			(360) 504-4327
		</a>
	</div>
</section>

<!-- Pitch -->
<section class="max-w-lg mx-auto px-6 py-12 text-center">
	<p class="text-base text-[var(--text-primary)] leading-relaxed">
		TBR.fyi is a reading list you can text. Send any ISBN, Amazon link, or bookstore URL
		and it appears on your personal shelf — organized, searchable, and shareable.
		No app to install. No account to remember.
	</p>
</section>

<!-- Sign in -->
<section class="max-w-sm mx-auto px-6 py-12 text-center">
	<h2 class="text-lg font-medium text-[var(--text-primary)] mb-6">
		Already have a shelf?
	</h2>
	<form onsubmit={handleSubmit} class="flex gap-2">
		<input
			bind:value={identifier}
			placeholder="Username or phone number"
			class="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
		/>
		<button
			type="submit"
			class="px-4 py-2 text-sm font-medium bg-[var(--surface-dark)] text-[var(--text-on-dark)] rounded hover:bg-[var(--surface-dark-secondary)] transition-colors"
		>
			Go
		</button>
	</form>
	<p class="text-xs text-[var(--text-tertiary)] mt-4">
		Or <a href="/auth/signin" class="text-[var(--accent)] hover:text-[var(--accent-hover)]">sign in with email</a>
	</p>
</section>
