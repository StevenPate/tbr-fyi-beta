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
		const hasLetters = /[a-zA-Z]/.test(trimmed);
		const isPhoneFormat = trimmed.startsWith('+') || /^\d{10,}$/.test(trimmed.replace(/\D/g, ''));

		if (hasLetters && !isPhoneFormat) {
			goto(`/${encodeURIComponent(trimmed)}`);
		} else {
			let normalized = trimmed.replace(/\D/g, '');
			if (normalized.length === 10) {
				normalized = '+1' + normalized;
			} else if (normalized.length === 11 && normalized.startsWith('1')) {
				normalized = '+' + normalized;
			} else if (!trimmed.startsWith('+')) {
				normalized = '+' + normalized;
			} else {
				normalized = trimmed;
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

<!-- Nav -->
<nav class="nav">
	<a href="/" class="nav-logo">TBR.fyi</a>
	<a href="/auth/signin" class="nav-signin">Sign in</a>
</nav>

<!-- Headline -->
<section class="headline">
	<h1 class="headline-title">Text Yourself Books.</h1>
	<a href="sms:+13605044327" class="headline-phone">(360) 504-4327</a>
</section>

<!-- Split: How It Works + Carousel -->
<section class="split">
	<div class="split-text">
		<p class="step">Send a photo, ISBN, or link.</p>
		<p class="step">It lands on your shelf in seconds.</p>
		<p class="step">We ask once: <em>why this one?</em></p>
		<hr class="step-divider" />
		<p class="friction-relief">No app. No password. Just text.</p>
	</div>

	<div class="split-demo">
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
				<!-- Slide 1: SMS Conversation -->
				<div class="carousel-slide">
					<div class="phone-mock">
						<div class="message outgoing">
							<div class="bubble image-bubble">
								<img src="/all-systems-red-cover.jpg" alt="All Systems Red cover" />
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
	</div>
</section>

<!-- Pitch -->
<section class="pitch">
	<p>No more scrolling past books you don't recognize.</p>
	<p>You'll remember something more than the title: why it mattered.</p>
</section>

<!-- Colophon -->
<section class="colophon">
	<p>Built by a bookseller in Port Angeles. Designed for people who care more about the reading than the tracking.</p>
</section>

<!-- Shelf lookup -->
<section class="shelf-lookup">
	<h2 class="shelf-lookup-title">Already have a shelf?</h2>
	<p class="shelf-lookup-subtitle">Enter your username or phone number to open it.</p>
	<form onsubmit={handleSubmit} class="shelf-lookup-form">
		<input
			bind:value={identifier}
			placeholder="Username or phone number"
			class="shelf-lookup-input"
		/>
		<button type="submit" class="shelf-lookup-button">Go</button>
	</form>
	<p class="shelf-lookup-alt">
		Or <a href="/auth/signin">sign in with email</a>
	</p>
</section>

<style>
	/* Nav */
	.nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px;
		border-bottom: 1px solid var(--border);
	}

	.nav-logo {
		font-family: var(--font-serif);
		font-weight: 600;
		font-size: 20px;
		color: var(--text-primary);
		text-decoration: none;
	}

	.nav-signin {
		font-size: var(--text-sm);
		color: var(--accent);
		text-decoration: none;
	}

	.nav-signin:hover {
		color: var(--accent-hover);
		text-decoration: underline;
	}

	/* Headline */
	.headline {
		text-align: center;
		padding: 64px 24px 48px;
	}

	.headline-title {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 500;
		font-size: 42px;
		line-height: var(--leading-tight);
		color: var(--text-primary);
		margin-bottom: 16px;
	}

	.headline-phone {
		font-family: var(--font-serif);
		font-size: 28px;
		font-variant-numeric: oldstyle-nums;
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 4px;
		text-decoration-thickness: 1.5px;
	}

	.headline-phone:hover {
		color: var(--accent-hover);
	}

	/* Split section */
	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 48px;
		max-width: var(--content-width);
		margin: 0 auto;
		padding: 48px 24px;
		align-items: start;
	}

	.split-text {
		padding-top: 4px; /* fine-tune baseline alignment with carousel top */
	}

	.step {
		font-size: var(--text-base);
		color: var(--text-primary);
		line-height: var(--leading-relaxed);
		margin-bottom: 12px;
	}

	.step em {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: calc(var(--text-base) * 1.3);
	}

	.step-divider {
		border: none;
		border-top: 1px solid var(--border);
		margin: 20px 0;
	}

	.friction-relief {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
	}

	.split-demo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	/* Carousel */
	.carousel-container {
		width: 100%;
		max-width: 300px;
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
		width: 100%;
	}

	.phone-mock-shelf {
		padding: 0;
		overflow: hidden;
		border-color: var(--accent);
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

	/* Messages */
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
		font-size: calc(var(--text-base) * 1);
	}

	/* Pitch */
	.pitch {
		max-width: 540px;
		margin: 0 auto;
		padding: 56px 24px;
		text-align: center;
	}

	.pitch p {
		font-size: var(--text-lg);
		color: var(--text-primary);
		line-height: 1.55;
	}

	.pitch p + p {
		margin-top: 12px;
	}

	/* Colophon */
	.colophon {
		max-width: 540px;
		margin: 0 auto;
		padding: 0 24px 32px;
		text-align: center;
	}

	.colophon p {
		font-size: 13.5px;
		color: var(--text-secondary);
		letter-spacing: 0.02em;
		line-height: 1.6;
	}

	/* Shelf lookup */
	.shelf-lookup {
		max-width: 360px;
		margin: 0 auto;
		padding: 32px 24px 48px;
		text-align: center;
	}

	.shelf-lookup-title {
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: var(--text-base);
		color: var(--text-primary);
		margin-bottom: 4px;
	}

	.shelf-lookup-subtitle {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin-bottom: 16px;
	}

	.shelf-lookup-form {
		display: flex;
		gap: 8px;
	}

	.shelf-lookup-input {
		flex: 1;
		padding: 8px 12px;
		font-size: var(--text-sm);
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--surface);
		color: var(--text-primary);
	}

	.shelf-lookup-input::placeholder {
		color: var(--text-tertiary);
	}

	.shelf-lookup-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.shelf-lookup-button {
		padding: 8px 16px;
		font-size: var(--text-sm);
		font-weight: 500;
		border: 1.5px solid var(--accent);
		border-radius: 4px;
		color: var(--accent);
		background: transparent;
		cursor: pointer;
		transition: all 0.2s;
	}

	.shelf-lookup-button:hover {
		background: var(--accent);
		color: white;
	}

	.shelf-lookup-alt {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		margin-top: 12px;
	}

	.shelf-lookup-alt a {
		color: var(--accent);
		text-decoration: none;
	}

	.shelf-lookup-alt a:hover {
		color: var(--accent-hover);
		text-decoration: underline;
	}

	/* Mobile */
	@media (max-width: 640px) {
		.headline {
			padding: 48px 24px 36px;
		}

		.headline-title {
			font-size: 34px;
		}

		.headline-phone {
			font-size: 20px;
		}

		.split {
			grid-template-columns: 1fr;
			gap: 40px;
			padding: 36px 24px;
		}

		.split-text {
			padding-top: 0;
		}

		.pitch {
			padding: 40px 24px;
		}
	}
</style>
