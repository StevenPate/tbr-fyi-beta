<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let identifier = $state('');
	let isReturningUser = $state(false);
	let currentSlide = $state(0);
	let touchStartX = $state(0);
	let touchEndX = $state(0);

	const totalSlides = 2;

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
	}

	function handleTouchMove(e: TouchEvent) {
		touchEndX = e.touches[0].clientX;
	}

	function handleTouchEnd() {
		const swipeThreshold = 50;
		const diff = touchStartX - touchEndX;

		if (Math.abs(diff) > swipeThreshold) {
			if (diff > 0 && currentSlide < totalSlides - 1) {
				currentSlide++;
			} else if (diff < 0 && currentSlide > 0) {
				currentSlide--;
			}
		}

		touchStartX = 0;
		touchEndX = 0;
	}

	function goToSlide(index: number) {
		currentSlide = index;
	}

	function toggleSlide() {
		currentSlide = (currentSlide + 1) % totalSlides;
	}

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
	<meta name="description" content="Text yourself books. Snap a photo of a book, send an ISBN or a link — it lands on your shelf in seconds. You'll remember something more than the title: why it mattered." />
	<meta property="og:title" content="TBR.fyi - text yourself books" />
	<meta property="og:description" content="Text yourself books. You'll remember something more than the title: why it mattered." />
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
			Text Yourself Books.
		</h1>
		<p class="text-base text-[var(--text-on-dark)] opacity-70 mb-8">
			You'll remember something more than the title: why it mattered.
		</p>
		<a
			href="sms:+13605044327"
			class="inline-block text-xl font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
		>
			(360) 504-4327
		</a>
		<p class="text-sm text-[var(--text-on-dark)] opacity-50 mt-8">Built by a bookseller working on tools for independent bookstores.</p>
	</div>
</section>

<!-- Pitch -->
<section class="max-w-lg mx-auto px-6 py-12 text-center">
	<p class="text-base text-[var(--text-primary)] leading-relaxed">
		We'll ask once — <em>why this one?</em> — when you add a book. Then it's yours.
	</p>
	<p class="text-base text-[var(--text-primary)] leading-relaxed mt-4">
		Snap a photo, text an ISBN, or send a link and it lands on your shelf in seconds.
	</p>
	<p class="text-base text-[var(--text-primary)] leading-relaxed mt-4">
		No app. No password. Just text or sign in.
	</p>
</section>

<!-- Sign in -->
<section class="max-w-sm mx-auto px-6 py-12 text-center">
	<h2 class="text-lg font-medium text-[var(--text-primary)] mb-2">
		Already have a shelf?
	</h2>
	<p class="text-sm text-[var(--text-secondary)] mb-6">Enter your username or phone number to open it.</p>
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

<!-- Phone Demo Carousel -->
<section class="demo">
	<div
		class="carousel-container"
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		onclick={toggleSlide}
		onkeydown={(e) => e.key === 'Enter' && toggleSlide()}
		role="button"
		tabindex="0"
		aria-label="Phone demo carousel - click to switch views"
	>
		<div class="carousel-track" style="transform: translateX(-{currentSlide * 100}%)">
			<!-- Slide 1: SMS Conversation (combined: cover photo + title search + note) -->
			<div class="carousel-slide">
				<div class="phone-mock">
					<div class="message outgoing">
						<div class="bubble image-bubble">
							<img src="/all-systems-red-cover.jpg" alt="Photo of book cover: All Systems Red" />
						</div>
					</div>
					<div class="message incoming">
						<div class="bubble">Added <span class="book-title">All Systems Red</span> by Martha Wells.</div>
					</div>
					<div class="message outgoing">
						<div class="bubble">The Witch of Prague</div>
					</div>
					<div class="message incoming">
						<div class="bubble">Added <span class="book-title">The Witch of Prague</span> by J. M. Sidorova.<br/><br/>Who told you about this one?</div>
					</div>
					<div class="message outgoing">
						<div class="bubble">Fisher recommended. And I think it would be fun to talk about with JD.</div>
					</div>
				</div>
			</div>

			<!-- Slide 2: Expanded Book Screenshot -->
			<div class="carousel-slide">
				<div class="phone-mock phone-mock-shelf">
					<img src="/shelf-mockup-v7.png" alt="Expanded book view with note, description, and shelf controls" class="shelf-screenshot" />
				</div>
			</div>
		</div>
	</div>

	<!-- Dot Indicators -->
	<div class="carousel-dots">
		{#each Array(totalSlides) as _, i}
			<button
				class="carousel-dot"
				class:active={currentSlide === i}
				onclick={() => goToSlide(i)}
				aria-label="Go to slide {i + 1}"
				aria-current={currentSlide === i ? 'true' : undefined}
			></button>
		{/each}
	</div>
	<p class="carousel-hint">Tap or swipe</p>
</section>

<!-- Builder note -->
<section class="max-w-md mx-auto px-6 py-10 text-center border-t border-[var(--border)]">
	<h3 class="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-4">A note from the builder</h3>
	<p class="text-sm text-[var(--text-secondary)] leading-relaxed">
		I built this because my reading list stopped working.
		It turned into a graveyard of books I couldn't remember choosing.
	</p>
	<p class="text-sm text-[var(--text-secondary)] leading-relaxed mt-3">
		This is the first version of something I've wanted for a long time —
		a way to keep the reason, not just the title.
	</p>
	<p class="text-sm text-[var(--text-secondary)] leading-relaxed mt-3">
		It's early. It works. I'm improving it as people use it.
	</p>
</section>

<style>
	.demo {
		padding: 48px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.carousel-container {
		width: 100%;
		max-width: 320px;
		overflow: hidden;
		touch-action: pan-y pinch-zoom;
		cursor: pointer;
	}

	.carousel-track {
		display: flex;
		transition: transform 0.3s ease-out;
	}

	.carousel-slide {
		flex: 0 0 100%;
		display: flex;
		justify-content: center;
	}

	.phone-mock {
		background: var(--surface);
		border: 1.5px solid var(--border);
		border-radius: 24px;
		padding: 24px 20px;
		max-width: 320px;
		width: 100%;
	}

	.phone-mock-shelf {
		padding: 0;
		overflow: hidden;
		border-color: var(--terracotta-dark);
	}

	.shelf-screenshot {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 22px;
	}

	.carousel-dots {
		display: flex;
		gap: 8px;
		justify-content: center;
	}

	.carousel-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: none;
		background: var(--border);
		cursor: pointer;
		padding: 0;
		transition: background 0.2s, transform 0.2s;
	}

	.carousel-dot:hover {
		background: var(--text-secondary);
	}

	.carousel-dot.active {
		background: var(--accent);
		transform: scale(1.25);
	}

	.carousel-hint {
		font-size: var(--text-xs);
		color: var(--text-secondary);
		margin-top: 4px;
	}

	.message {
		margin-bottom: 12px;
	}

	.message.outgoing {
		text-align: right;
	}

	.bubble {
		display: inline-block;
		padding: 10px 14px;
		border-radius: 16px;
		font-size: var(--text-sm);
		max-width: 85%;
	}

	.message.outgoing .bubble {
		background: var(--accent);
		color: white;
		border-bottom-right-radius: 4px;
	}

	.message.outgoing .bubble.image-bubble {
		padding: 6px;
		background: var(--accent);
	}

	.message.outgoing .bubble.image-bubble img {
		display: block;
		max-width: 180px;
		border-radius: 10px;
	}

	.message.incoming .bubble {
		background: var(--background-alt);
		color: var(--text-primary);
		border-bottom-left-radius: 4px;
	}

	.message .book-title {
		font-family: var(--font-serif);
		font-style: italic;
	}
</style>
