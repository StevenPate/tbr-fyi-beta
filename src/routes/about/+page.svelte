<svelte:head>
	<title>About TBR.fyi</title>
</svelte:head>

<div class="about-page">
	<div class="about-content">
		<a href="/" class="back-link">&larr; Home</a>

		<!-- Header -->
		<header class="about-header">
			<h1 class="page-title">About TBR.fyi</h1>
			<p class="about-subtitle">A simple way to never lose a book recommendation again.</p>
		</header>

		<!-- Intro -->
		<section class="about-section">
			<p>
				Someone mentions a book on a podcast, in a group chat, or across the table—and you can save it instantly. No notes app, no screenshots, no forgotten tabs. Everything lands in one calm, searchable shelf.
			</p>
		</section>

		<hr class="ghost-rule" />

		<!-- Why This Exists -->
		<section class="about-section">
			<h2 class="section-heading">Why this exists</h2>

			<p>
				Book recommendations come from everywhere, and they almost always arrive when you're busy. TBR.fyi is designed to capture those moments with as little friction as possible—whether you're on your phone, at your desk, or mid-conversation. It also helps you remember why you saved each book.
			</p>

			<p>
				I'm Steven Pate, a bookseller at <a href="https://portbookandnews.com" target="_blank" rel="noopener noreferrer">Port Book and News</a> in Port Angeles, WA. I built this because I see the same pattern every day—people hear about a book and want to remember it, but the moment passes.
			</p>

			<p>
				If TBR.fyi is useful to you, you can <a href="https://ko-fi.com/stevenpate" target="_blank" rel="noopener noreferrer">leave me a tip</a>.
			</p>

			<p class="emphasis">
				No feeds. No algorithms. Just a place to put the books you actually want to read.
			</p>
		</section>

		<hr class="ghost-rule" />

		<!-- How It Works -->
		<section class="about-section">
			<h2 class="section-heading">How it works</h2>

			<p>
				There are two ways to add books—use whichever fits the moment:
			</p>

			<div class="method-block">
				<h3 class="method-label">Text it in.</h3>
				<p>
					Send a photo of a book cover, an ISBN, a link, or just the title:
				</p>
				<a href="sms:+13605044327" class="phone-link phone-link-large">(360) 504-4327</a>
				<p class="note">US number · standard messaging rates apply</p>
				<p>
					TBR.fyi figures out the book and adds it to your shelf automatically.
				</p>
			</div>

			<div class="method-block">
				<h3 class="method-label">Use the web app.</h3>
				<p>
					You can also add books directly here—same result, same shelf, no SMS required.
				</p>
			</div>

			<p>
				Once added, books show up on your shelf. You can mark them read or unread, note whether you own them, and add context like "Recommended on Fresh Air" so you remember why you saved it. When a book resurfaces months later, that context comes with it—so you're not staring at a title wondering why it's there.
			</p>
		</section>

		<hr class="ghost-rule" />

		<!-- What It Is -->
		<section class="about-section">
			<h2 class="section-heading">What it is (and isn't)</h2>

			<p>
				TBR.fyi is a lightweight tool for capturing and organizing book recommendations. It's fast, forgiving, and intentionally simple—built for real life, not perfect data entry.
			</p>

			<p>
				It isn't a social network. It isn't a recommendation engine. It isn't a reading tracker with stats and streaks.
			</p>
		</section>

		<hr class="ghost-rule" />

		<!-- Where This Is At -->
		<section class="about-section">
			<h2 class="section-heading">Where this is at</h2>

			<p>
				Built and maintained by one person. Still early—developing in the open on <a href="https://github.com/stevenpate/tbr-fyi-beta" target="_blank" rel="noopener noreferrer">GitHub</a>.
			</p>

			<h3 class="method-label">On the list:</h3>
			<ul class="simple-list">
				<li>Pagination for large shelves</li>
				<li>Edition finder (wrong cover? find the right one)</li>
			</ul>

			<p>
				If something breaks, telling me is genuinely helpful.
			</p>
		</section>

		<hr class="ghost-rule" />

		<!-- Feedback -->
		<section class="about-section">
			<h2 class="section-heading">Feedback</h2>

			<p>
				If you have thoughts—good or bad—I want to hear them. You can open an issue on <a href="https://github.com/stevenpate/tbr-fyi-beta/issues" target="_blank" rel="noopener noreferrer">GitHub</a> or just reply to any SMS.
			</p>

			<h3 class="method-label">Specific things that help:</h3>
			<ul class="simple-list">
				<li>"I stopped using it because..."</li>
				<li>"This is confusing..."</li>
				<li>"I wish it did..."</li>
				<li>"I use it when..."</li>
			</ul>

			<h3 class="method-label">Things that help less:</h3>
			<ul class="simple-list">
				<li>"It's cool!" (but why?)</li>
				<li>"You should add fifty features" (maybe, but which one matters most?)</li>
			</ul>
		</section>

		<hr class="ghost-rule" />

		<!-- Privacy -->
		<section class="about-section">
			<h2 class="section-heading">Privacy</h2>

			<p>
				TBR.fyi only stores what it needs to work: your phone number (if you use SMS) and the books you add. It doesn't sell your data, scan your contacts, or do anything clever behind the scenes.
			</p>

			<p>
				SMS is handled through Twilio on a registered 10DLC number—no shared short codes, no spam, no resale. Reply STOP at any time to unsubscribe instantly.
			</p>

			<p>
				Your books are yours. Claim your shelf and you can export your full library anytime—CSV (Goodreads-compatible) or JSON—from your <a href="/settings">Settings</a> page.
			</p>

			<p>
				If I ever shut this down, you'll get 60 days' notice first.
			</p>

			<p>
				To unsubscribe from SMS, text STOP. To delete your data entirely, open an issue on <a href="https://github.com/stevenpate/tbr-fyi-beta/issues" target="_blank" rel="noopener noreferrer">GitHub</a>.
			</p>
		</section>

		<hr class="ghost-rule" />

		<!-- Closing Signature -->
		<section class="closing-signature">
			<p>Ready to begin? Text a book to <a href="sms:+13605044327" class="phone-link">(360) 504-4327</a>.</p>
		</section>
	</div>
</div>

<style>
	.back-link {
		font-size: var(--text-sm);
		color: var(--accent);
		text-decoration: none;
	}

	.back-link:hover {
		color: var(--accent-hover);
	}

	.about-page {
		max-width: 640px;
		margin: 0 auto;
		padding: 48px 24px;
	}

	.about-header {
		margin-bottom: 40px;
	}

	.about-subtitle {
		font-size: var(--text-base);
		color: var(--text-secondary);
		margin-top: 12px;
	}

	.about-section {
		margin-bottom: 0;
	}

	.about-section p {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 12px;
	}

	.about-section p.emphasis {
		color: var(--text-primary);
		font-weight: 500;
	}

	.about-section a {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-thickness: 1px;
	}

	.about-section a:hover {
		color: var(--accent-hover);
	}

	.method-block {
		background: var(--background-alt);
		border-radius: 4px;
		padding: 20px;
		margin: 16px 0;
	}

	.method-block p {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 8px;
	}

	.method-label {
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: var(--text-sm);
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.phone-link-large {
		font-size: 20px;
	}

	.note {
		font-size: var(--text-xs) !important;
		color: var(--text-tertiary) !important;
	}

	.simple-list {
		list-style: none;
		padding: 0;
		margin: 0 0 16px;
	}

	.simple-list li {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: 1.6;
		padding-left: 16px;
		position: relative;
		margin-bottom: 4px;
	}

	.simple-list li::before {
		content: '·';
		position: absolute;
		left: 4px;
		color: var(--text-tertiary);
	}

	.closing-signature {
		text-align: center;
	}

	.closing-signature p {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
</style>
