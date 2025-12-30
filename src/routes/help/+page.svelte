<script lang="ts">
	import { onMount } from 'svelte';

	const TWILIO_NUMBER = '+1 (360) 504-4327';

	let activeFAQ = $state<string | null>(null);

	function toggleFAQ(id: string) {
		activeFAQ = activeFAQ === id ? null : id;
	}

	// Smooth scroll for anchor links
	onMount(() => {
		document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
			anchor.addEventListener('click', (e) => {
				e.preventDefault();
				const href = anchor.getAttribute('href');
				if (href) {
					const target = document.querySelector(href);
					if (target) {
						target.scrollIntoView({
							behavior: 'smooth',
							block: 'start'
						});
					}
				}
			});
		});
	});
</script>

<svelte:head>
	<title>Help - TBR.fyi</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="container">
	<!-- Header -->
	<div class="header">
		<a href="/" class="back-link">← Back to Home</a>
		<h1>Help & Documentation</h1>
		<p class="subtitle">Everything you need to know about using TBR</p>
	</div>

	<!-- Quick Links -->
	<div class="quick-links">
		<div class="quick-links-title">Jump to:</div>
		<div class="quick-links-grid">
			<a href="#getting-started" class="quick-link">🚀 Getting Started</a>
			<a href="#adding-books" class="quick-link">📚 Adding Books</a>
			<a href="#managing" class="quick-link">🗂️ Managing Library</a>
			<a href="#faqs" class="quick-link">💡 FAQs</a>
			<a href="#troubleshooting" class="quick-link">🔧 Troubleshooting</a>
		</div>
	</div>

	<!-- Getting Started -->
	<div class="section-card" id="getting-started">
		<div class="section-header">
			<span class="section-icon">🚀</span>
			<h2 class="section-title">Getting Started</h2>
		</div>
		<div class="section-content">
			<ol class="steps">
				<li>Text anything to <span class="phone-highlight">{TWILIO_NUMBER}</span></li>
				<li>You'll receive a welcome message</li>
				<li>Reply <span class="command">START</span> to opt in and activate your account</li>
				<li>Start adding books! A "TBR" shelf is automatically created for you</li>
			</ol>

			<div class="info-box">
				<div class="info-box-title">First Book Suggestion</div>
				<div class="info-box-content">
					Try texting <span class="command">9780547928227</span> to add The Hobbit by Tolkien to your shelf!
				</div>
			</div>
		</div>
	</div>

	<!-- Adding Books -->
	<div class="section-card" id="adding-books">
		<div class="section-header">
			<span class="section-icon">📚</span>
			<h2 class="section-title">Adding Books</h2>
		</div>
		<div class="section-content">
			<h3>Via SMS</h3>
			<p>Text any of these to <span class="phone-highlight">{TWILIO_NUMBER}</span>:</p>

			<div class="sms-examples">
				<div class="sms-example-item">
					<div class="sms-bubble">9780547928227</div>
					<div class="sms-label">ISBN number</div>
				</div>
				<div class="sms-example-item">
					<div class="sms-bubble">The Hobbit by Tolkien</div>
					<div class="sms-label">Title and author</div>
				</div>
				<div class="sms-example-item">
					<div class="sms-bubble-photo">
						<div class="barcode-placeholder">
							<div class="barcode-lines">
								<div class="barcode-line"></div>
								<div class="barcode-line"></div>
								<div class="barcode-line"></div>
								<div class="barcode-line thick"></div>
								<div class="barcode-line"></div>
								<div class="barcode-line thick"></div>
								<div class="barcode-line"></div>
								<div class="barcode-line"></div>
								<div class="barcode-line thick"></div>
								<div class="barcode-line"></div>
							</div>
							<div class="barcode-number">9780547928227</div>
						</div>
						<div class="photo-icon">📸</div>
					</div>
					<div class="sms-label">Photo of barcode</div>
				</div>
				<div class="sms-example-item">
					<div class="sms-bubble amazon-link">
						<div class="link-icon">🔗</div>
						<div class="link-text">amazon.com/dp/...</div>
					</div>
					<div class="sms-label">Link from Amazon</div>
				</div>
			</div>

			<div class="code-example" style="margin-top: 1.5rem;">
				Reply <span class="command">ADD</span> to add the last suggested book
			</div>

			<h3>Via Web</h3>
			<ol class="steps">
				<li>Visit your shelf page (link provided in SMS)</li>
				<li>Click the <strong>+</strong> button in the header</li>
				<li>
					Enter ISBN, paste Amazon URL, search by title/author, or upload a photo
				</li>
				<li>Select book(s) and click "Add"</li>
			</ol>

			<h3>Common SMS Commands</h3>
			<div class="feature-grid">
				<div class="feature-item">
					<strong><span class="command">ADD</span></strong>
					Add the last suggested book to your shelf
				</div>
				<div class="feature-item">
					<strong><span class="command">HELP</span></strong>
					Get a quick command reference
				</div>
				<div class="feature-item">
					<strong><span class="command">STOP</span></strong>
					Unsubscribe from SMS messages
				</div>
				<div class="feature-item">
					<strong><span class="command">START</span></strong>
					Re-subscribe to SMS messages
				</div>
			</div>
		</div>
	</div>

	<!-- Managing Library -->
	<div class="section-card" id="managing">
		<div class="section-header">
			<span class="section-icon">🗂️</span>
			<h2 class="section-title">Managing Your Library</h2>
		</div>
		<div class="section-content">
			<h3>Shelves</h3>
			<ul>
				<li><strong>All Books:</strong> See your entire collection</li>
				<li><strong>TBR (To Be Read):</strong> Automatically created; your default shelf</li>
				<li>
					<strong>Custom shelves:</strong> Click "+ New Shelf" to organize books (e.g., "Favorites",
					"Currently Reading")
				</li>
			</ul>

			<h3>Book Actions</h3>
			<div class="feature-grid">
				<div class="feature-item">
					<strong>Mark as Read/Unread</strong>
					Click the green "Read" badge
				</div>
				<div class="feature-item">
					<strong>Mark as Owned</strong>
					Click the blue "Owned" badge
				</div>
				<div class="feature-item">
					<strong>Add to Shelf</strong>
					Click "+ Add to shelf" to organize
				</div>
				<div class="feature-item">
					<strong>Add Notes</strong>
					Remember why you want to read it
				</div>
				<div class="feature-item">
					<strong>View Description</strong>
					Click "Show description"
				</div>
				<div class="feature-item">
					<strong>Delete Book</strong>
					Removes from all shelves
				</div>
			</div>

			<h3>View Modes</h3>
			<ul>
				<li><strong>Grid view:</strong> See book covers (flip cards for details)</li>
				<li><strong>List view:</strong> Compact format with all information</li>
			</ul>
		</div>
	</div>

	<!-- FAQs -->
	<div class="section-card" id="faqs">
		<div class="section-header">
			<span class="section-icon">💡</span>
			<h2 class="section-title">Frequently Asked Questions</h2>
		</div>
		<div class="section-content">
			<div class="faq-item" class:active={activeFAQ === 'faq-1'}>
				<button class="faq-question" onclick={() => toggleFAQ('faq-1')}>
					<span>Why isn't my book being found?</span>
					<span class="faq-icon">▼</span>
				</button>
				<div class="faq-answer">
					<div class="faq-answer-content">
						<p>Some books may not be in the Google Books database. Try:</p>
						<ul>
							<li>Using the ISBN from the copyright page instead of the back cover</li>
							<li>Trying the other ISBN format (ISBN-10 vs ISBN-13)</li>
							<li>Searching by exact title and author</li>
							<li>Checking for typos in the ISBN</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="faq-item" class:active={activeFAQ === 'faq-2'}>
				<button class="faq-question" onclick={() => toggleFAQ('faq-2')}>
					<span>What happens when I text the same ISBN twice?</span>
					<span class="faq-icon">▼</span>
				</button>
				<div class="faq-answer">
					<div class="faq-answer-content">
						<p>
							Duplicate ISBNs are automatically detected and handled gracefully. The system will
							confirm the book is already on your shelf without creating a duplicate entry.
						</p>
					</div>
				</div>
			</div>

			<div class="faq-item" class:active={activeFAQ === 'faq-3'}>
				<button class="faq-question" onclick={() => toggleFAQ('faq-3')}>
					<span>Why are my photos not working?</span>
					<span class="faq-icon">▼</span>
				</button>
				<div class="faq-answer">
					<div class="faq-answer-content">
						<p>For best results:</p>
						<ul>
							<li>Ensure good lighting (avoid shadows on the barcode)</li>
							<li>Keep the barcode in focus and fill most of the frame</li>
							<li>Avoid glare or reflections</li>
							<li>Make sure the entire barcode is visible (no cut-off edges)</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="faq-item" class:active={activeFAQ === 'faq-4'}>
				<button class="faq-question" onclick={() => toggleFAQ('faq-4')}>
					<span>Why can't I send a photo of the book cover?</span>
					<span class="faq-icon">▼</span>
				</button>
				<div class="faq-answer">
					<div class="faq-answer-content">
						<p>
							Great question! While we'd love to support cover photos, reliably extracting the
							title and author from cover images is surprisingly complex. There's a lot of work
							involved in identifying the right text components and returning accurate results.
							Right now, we want to focus on building features that work reliably without
							frustrating errors. Once we nail the core texting experience, we'll explore adding
							cover photo recognition.
						</p>
					</div>
				</div>
			</div>

			<div class="faq-item" class:active={activeFAQ === 'faq-5'}>
				<button class="faq-question" onclick={() => toggleFAQ('faq-5')}>
					<span>Do books stay on TBR when I mark them as read?</span>
					<span class="faq-icon">▼</span>
				</button>
				<div class="faq-answer">
					<div class="faq-answer-content">
						<p>
							Yes! Marking a book as "Read" doesn't remove it from any shelves. Books remain on
							TBR (and any other custom shelves) until you manually remove them. This lets you
							track what you've read while keeping your TBR list organized.
						</p>
					</div>
				</div>
			</div>

			<div class="faq-item" class:active={activeFAQ === 'faq-6'}>
				<button class="faq-question" onclick={() => toggleFAQ('faq-6')}>
					<span>What happens when I delete a shelf?</span>
					<span class="faq-icon">▼</span>
				</button>
				<div class="faq-answer">
					<div class="faq-answer-content">
						<p>
							Deleting a shelf only removes the shelf organization, not the books themselves. All
							books remain in your library and can still be viewed under "All Books" or other
							shelves they're on.
						</p>
					</div>
				</div>
			</div>

			<div class="faq-item" class:active={activeFAQ === 'faq-7'}>
				<button class="faq-question" onclick={() => toggleFAQ('faq-7')}>
					<span>Can multiple people use the same phone number?</span>
					<span class="faq-icon">▼</span>
				</button>
				<div class="faq-answer">
					<div class="faq-answer-content">
						<p>
							No, each phone number has its own separate library. This keeps your reading list
							private and prevents conflicts between different users.
						</p>
					</div>
				</div>
			</div>

			<div class="faq-item" class:active={activeFAQ === 'faq-8'}>
				<button class="faq-question" onclick={() => toggleFAQ('faq-8')}>
					<span>Why is the cover image missing or low quality?</span>
					<span class="faq-icon">▼</span>
				</button>
				<div class="faq-answer">
					<div class="faq-answer-content">
						<p>
							Cover images come from Google Books. Some older or less common books may not have
							high-quality covers available. If no cover is available, you'll see a placeholder
							with the book emoji (📖).
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Troubleshooting -->
	<div class="section-card" id="troubleshooting">
		<div class="section-header">
			<span class="section-icon">🔧</span>
			<h2 class="section-title">Troubleshooting</h2>
		</div>
		<div class="section-content">
			<div class="faq-item" class:active={activeFAQ === 'trouble-1'}>
				<button class="faq-question" onclick={() => toggleFAQ('trouble-1')}>
					<span>Not receiving SMS responses?</span>
					<span class="faq-icon">▼</span>
				</button>
				<div class="faq-answer">
					<div class="faq-answer-content">
						<ul>
							<li>Check that you've sent <span class="command">START</span> to opt in</li>
							<li>
								Verify you're texting the correct number: <span class="phone-highlight"
									>{TWILIO_NUMBER}</span
								>
							</li>
							<li>SMS delivery can take a few seconds - wait 10-30 seconds</li>
							<li>Check if your carrier is blocking automated messages</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="faq-item" class:active={activeFAQ === 'trouble-2'}>
				<button class="faq-question" onclick={() => toggleFAQ('trouble-2')}>
					<span>Shelf page not loading?</span>
					<span class="faq-icon">▼</span>
				</button>
				<div class="faq-answer">
					<div class="faq-answer-content">
						<ul>
							<li>Clear your browser cache and refresh</li>
							<li>Try incognito/private browsing mode</li>
							<li>Check your internet connection</li>
							<li>Verify the phone number format includes country code (e.g., +1 for US)</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="faq-item" class:active={activeFAQ === 'trouble-3'}>
				<button class="faq-question" onclick={() => toggleFAQ('trouble-3')}>
					<span>Books not showing up after adding?</span>
					<span class="faq-icon">▼</span>
				</button>
				<div class="faq-answer">
					<div class="faq-answer-content">
						<ul>
							<li>Refresh your shelf page</li>
							<li>Check if you're viewing the correct shelf (try "All Books")</li>
							<li>Verify you received a confirmation SMS</li>
							<li>Clear localStorage and try again</li>
						</ul>
					</div>
				</div>
			</div>

			<h3>Common Error Messages</h3>
			<div class="feature-grid">
				<div class="feature-item">
					<strong>"Invalid ISBN"</strong>
					Check the ISBN for typos or try the other format (10-digit vs 13-digit)
				</div>
				<div class="feature-item">
					<strong>"Book not found"</strong>
					The book may not be in Google Books - try searching by title/author
				</div>
				<div class="feature-item">
					<strong>"Already on your shelf"</strong>
					This book is already in your library (duplicates are prevented)
				</div>
			</div>
		</div>
	</div>

	<!-- Contact Section -->
	<div class="contact-section">
		<h2>📬 Need More Help?</h2>
		<p>
			Text <span class="command">HELP</span> to <span class="phone-highlight">{TWILIO_NUMBER}</span
			> for a quick command reference
		</p>
		<p>Found a bug or have feedback? We'd love to hear from you!</p>
		<a
			href="https://github.com/anthropics/tbr-fyi-beta/issues"
			class="contact-button"
			target="_blank">Report on GitHub</a
		>
	</div>
</div>

<style>
	* {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #fafafa;
		color: #1a1a1a;
		line-height: 1.6;
	}

	.container {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	/* Header */
	.header {
		text-align: center;
		margin-bottom: 3rem;
	}

	.back-link {
		display: inline-block;
		color: #2563eb;
		text-decoration: none;
		font-weight: 500;
		margin-bottom: 1rem;
		font-size: 0.9375rem;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		color: #1a1a1a;
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		font-size: 1.125rem;
		color: #737373;
		margin: 0;
	}

	/* Quick Links */
	.quick-links {
		background: white;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		border: 1px solid #e5e5e5;
	}

	.quick-links-title {
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #737373;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.quick-links-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.75rem;
	}

	.quick-link {
		display: block;
		padding: 0.75rem 1rem;
		background: #f8fafc;
		border-radius: 8px;
		text-decoration: none;
		color: #2563eb;
		font-weight: 500;
		font-size: 0.9375rem;
		transition: all 0.2s;
		border: 1px solid transparent;
	}

	.quick-link:hover {
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	/* Phone Number Highlight */
	.phone-highlight {
		display: inline-block;
		background: #eff6ff;
		color: #2563eb;
		padding: 0.25rem 0.75rem;
		border-radius: 6px;
		font-weight: 600;
		font-size: 1.0625rem;
		font-variant-numeric: tabular-nums;
	}

	/* Command Badge */
	.command {
		display: inline-block;
		background: #f0fdf4;
		color: #16a34a;
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
		font-weight: 600;
		font-size: 0.9375rem;
		font-family: 'Monaco', 'Courier New', monospace;
	}

	/* Section Card */
	.section-card {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		border: 1px solid #e5e5e5;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.section-icon {
		font-size: 1.75rem;
	}

	.section-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1a1a1a;
		margin: 0;
	}

	.section-content h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: #1a1a1a;
		margin: 1.5rem 0 0.75rem 0;
	}

	.section-content h3:first-child {
		margin-top: 0;
	}

	.section-content p {
		margin: 0 0 1rem 0;
		color: #525252;
	}

	.section-content ul,
	.section-content ol {
		margin: 0 0 1rem 0;
		padding-left: 1.5rem;
	}

	.section-content li {
		margin-bottom: 0.5rem;
		color: #525252;
	}

	/* Steps */
	.steps {
		counter-reset: step-counter;
		list-style: none;
		padding: 0;
	}

	.steps li {
		counter-increment: step-counter;
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
		align-items: flex-start;
	}

	.steps li::before {
		content: counter(step-counter);
		background: #2563eb;
		color: white;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 0.875rem;
		flex-shrink: 0;
		margin-top: 2px;
	}

	/* FAQ Accordion */
	.faq-item {
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		margin-bottom: 0.75rem;
		overflow: hidden;
	}

	.faq-question {
		width: 100%;
		text-align: left;
		padding: 1rem 1.25rem;
		background: white;
		border: none;
		font-family: inherit;
		font-size: 1rem;
		font-weight: 600;
		color: #1a1a1a;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		transition: background 0.2s;
	}

	.faq-question:hover {
		background: #f8fafc;
	}

	.faq-icon {
		font-size: 1.25rem;
		transition: transform 0.2s;
	}

	.faq-item.active .faq-icon {
		transform: rotate(180deg);
	}

	.faq-answer {
		max-height: 0;
		overflow: hidden;
		transition: max-height 0.3s ease-out;
	}

	.faq-answer-content {
		padding: 0 1.25rem 1.25rem 1.25rem;
		color: #525252;
	}

	.faq-item.active .faq-answer {
		max-height: 500px;
	}

	/* Info Box */
	.info-box {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 8px;
		padding: 1rem 1.25rem;
		margin: 1rem 0;
	}

	.info-box-title {
		font-weight: 600;
		color: #1e40af;
		margin-bottom: 0.5rem;
	}

	.info-box-content {
		color: #1e3a8a;
		margin: 0;
	}

	/* Code Block */
	.code-example {
		background: #f5f5f5;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		padding: 1rem;
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.9375rem;
		color: #1a1a1a;
		margin: 1rem 0;
		overflow-x: auto;
	}

	/* SMS Examples */
	.sms-examples {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1.5rem;
		margin: 1.5rem 0;
	}

	@media (min-width: 768px) and (max-width: 1024px) {
		.sms-examples {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.sms-example-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.sms-bubble {
		background: #2563eb;
		color: white;
		padding: 1rem 1.5rem;
		border-radius: 18px;
		font-size: 1rem;
		font-weight: 500;
		text-align: center;
		width: 100%;
		box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
	}

	.sms-bubble.amazon-link {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
	}

	.link-icon {
		font-size: 1.25rem;
	}

	.link-text {
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
	}

	.sms-bubble-photo {
		background: #2563eb;
		padding: 1rem;
		border-radius: 18px;
		width: 100%;
		position: relative;
		box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
	}

	.barcode-placeholder {
		background: white;
		border-radius: 8px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.barcode-lines {
		display: flex;
		gap: 3px;
		height: 50px;
		align-items: center;
		padding: 0 0.5rem;
	}

	.barcode-line {
		width: 3px;
		height: 100%;
		background: #1a1a1a;
	}

	.barcode-line.thick {
		width: 5px;
	}

	.barcode-number {
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.75rem;
		color: #525252;
		letter-spacing: 0.05em;
	}

	.photo-icon {
		position: absolute;
		top: -8px;
		right: -8px;
		font-size: 1.75rem;
		background: white;
		border-radius: 50%;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.sms-label {
		font-size: 0.875rem;
		color: #737373;
		font-weight: 500;
		text-align: center;
	}

	/* Feature Grid */
	.feature-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
		margin: 1rem 0;
	}

	.feature-item {
		background: #f8fafc;
		padding: 1rem;
		border-radius: 8px;
		border: 1px solid #e5e5e5;
	}

	.feature-item strong {
		color: #1a1a1a;
		display: block;
		margin-bottom: 0.25rem;
	}

	/* Contact Section */
	.contact-section {
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
		color: white;
		border-radius: 12px;
		padding: 2rem;
		text-align: center;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}

	.contact-section h2 {
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
	}

	.contact-section p {
		margin: 0 0 1.5rem 0;
		opacity: 0.9;
	}

	.contact-button {
		display: inline-block;
		background: white;
		color: #2563eb;
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		text-decoration: none;
		font-weight: 600;
		transition: transform 0.2s;
	}

	.contact-button:hover {
		transform: translateY(-2px);
	}

	/* Responsive */
	@media (max-width: 640px) {
		h1 {
			font-size: 2rem;
		}

		.quick-links-grid {
			grid-template-columns: 1fr;
		}

		.section-card {
			padding: 1.5rem;
		}

		.sms-examples {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}
	}
</style>
