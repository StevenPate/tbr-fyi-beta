<script lang="ts">
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';

	let phoneNumber = '';
	let showWelcomeBack = false;
	let savedPhone = '';
	let qrCodeUrl = '';

	const TWILIO_NUMBER = '+13605044327';
	const SMS_URI = `sms:${TWILIO_NUMBER}`;

	onMount(async () => {
		// Check if user has visited before (using existing localStorage key)
		savedPhone = localStorage.getItem('tbr-userId') || '';
		if (savedPhone) {
			showWelcomeBack = true;
			phoneNumber = savedPhone;
		}

		// Generate QR code for SMS URI
		try {
			qrCodeUrl = await QRCode.toDataURL(SMS_URI, {
				width: 200,
				margin: 2,
				color: {
					dark: '#1a1a1a',
					light: '#FFFFFF'
				}
			});
		} catch (error) {
			console.error('Failed to generate QR code:', error);
		}
	});

	function handleViewList() {
		if (phoneNumber) {
			// Normalize phone number
			let cleaned = phoneNumber.trim();
			const digitsOnly = cleaned.replace(/\D/g, '');

			if (digitsOnly.length === 10) {
				// US number without country code
				cleaned = `+1${digitsOnly}`;
			} else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
				// US number with 1 prefix but no +
				cleaned = `+${digitsOnly}`;
			}

			// Save phone number to localStorage
			localStorage.setItem('tbr-userId', cleaned);
			// Navigate to shelf view
			window.location.href = `/${encodeURIComponent(cleaned)}`;
		}
	}

	function goToSavedList() {
		if (savedPhone) {
			window.location.href = `/${encodeURIComponent(savedPhone)}`;
		}
	}
</script>

<svelte:head>
	<title>TBR.fyi - Never Lose a Book Recommendation</title>
	<meta name="description" content="A simple way to save book recommendations. Text an ISBN, paste an Amazon link, or add books from the web. Everything lands in one calm, searchable reading list." />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="content">
	<!-- Hero Section -->
		<div class="hero">
			<h1>Your Personal Reading Inbox</h1>
			<p class="tagline">
				Text a book title or ISBN.<br />
				Get an instant reading list.<br />
				<span class="highlight">No app required.</span>
			</p>
		</div>

		<!-- Welcome Back Card (for returning users) -->
		{#if showWelcomeBack}
		<div class="welcome-back-card">
			<div class="welcome-back-label">Welcome back!</div>
			<button class="welcome-back-button" on:click={goToSavedList}>
				<span>Go to My Reading List</span>
				<span class="arrow">📚 →</span>
			</button>
		</div>
		{/if}

		<!-- Demo Section -->
		<div class="demo-section">
			<div class="demo-label">Try it now</div>
			<div class="demo-content">
				<div class="demo-main">
					<div class="phone-display">
						<div class="phone-number">(360) 504-4327</div>
					</div>
					<div class="example-text">
						Text "The Hobbit by Tolkien"<br /> or ISBN <code>9780547928227</code><br />
						or 📸 a photo of the barcode<br /> or 🔗 an Amazon link
					</div>
				</div>
				{#if qrCodeUrl}
				<div class="qr-code-container">
					<div class="qr-code-label">Or scan to text:</div>
					<img
						src={qrCodeUrl}
						alt="QR code to text (360) 504-4327"
						class="qr-code-image"
						width="160"
						height="160"
					/>
				</div>
				{/if}
			</div>
		</div>

		<!-- Already Using It Card -->
		<div class="already-using-card">
			<div class="already-using-label">Already using it?</div>

			<!-- CTA Section -->
			<div class="cta-section">
				<label for="phone" class="cta-label">Enter your phone number to view your list</label>
				<div class="input-group">
					<input
						id="phone"
						type="tel"
						bind:value={phoneNumber}
						placeholder="Your phone number"
						class="phone-input"
						on:keypress={(e) => e.key === 'Enter' && handleViewList()}
					/>
					<button on:click={handleViewList} class="view-button" disabled={!phoneNumber}>
						View List
					</button>
				</div>
			</div>
		</div>

		<!-- Footer Help -->
		<div class="footer-help">
			Text <strong>HELP</strong> to (360) 504-4327 for commands<br />
			or check out the <a href="/help">help page</a>.
		</div>

		<!-- Feedback Encouragement -->
		<div class="feedback-note">
			📣 Click the <strong>Feedback</strong> button in the bottom right corner with <strong>any</strong> feedback or ideas. This site literally exists to gather feedback right now. I would love to hear from you!
		</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: #fafafa;
	}

	.content {
		max-width: 580px;
		margin: 0 auto;
		padding: 4rem 1rem 2rem 1rem;
	}

	/* Hero Section */
	.hero {
		text-align: center;
		margin-bottom: 4rem;
	}

	/* Welcome Back Card */
	.welcome-back-card {
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
		border-radius: 16px;
		padding: 2rem 2.5rem;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		text-align: center;
	}

	.welcome-back-label {
		color: rgba(255, 255, 255, 0.9);
		font-size: 1rem;
		font-weight: 500;
		margin-bottom: 1rem;
		text-align: center;
	}

	.welcome-back-button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: white;
		color: #1a1a1a;
		padding: 1.25rem 1.5rem;
		border-radius: 12px;
		font-size: 1.5rem;
		font-weight: 700;
		text-decoration: none;
		transition: transform 0.2s, box-shadow 0.2s;
		cursor: pointer;
		border: none;
		width: 100%;
		font-family: inherit;
	}

	.welcome-back-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.welcome-back-button .arrow {
		font-size: 1.5rem;
	}

	.already-using-label {
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #1e40af;
		font-weight: 600;
		margin-bottom: 1.5rem;
	}

	h1 {
		font-size: 3rem;
		font-weight: 700;
		color: #1a1a1a;
		margin: 0 0 1.5rem 0;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	.tagline {
		font-size: 1.5rem;
		color: #4a4a4a;
		line-height: 1.5;
		margin: 0;
		font-weight: 400;
	}

	.highlight {
		color: #2563eb;
		font-weight: 500;
	}

	/* Demo Section */
	.demo-section {
		background: white;
		border-radius: 16px;
		padding: 2.5rem 2rem;
		text-align: center;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		border: 1px solid #e5e5e5;
		margin-bottom: 2rem;
	}

	.demo-label {
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #737373;
		font-weight: 600;
		margin-bottom: 1.5rem;
	}

	.demo-content {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3rem;
	}

	.demo-main {
		flex: 1;
		max-width: 100%;
	}

	.phone-display {
		margin-bottom: 1.5rem;
	}

	.phone-number {
		font-size: 2.5rem;
		font-weight: 700;
		color: #2563eb;
		letter-spacing: 0.02em;
		font-variant-numeric: tabular-nums;
	}

	.example-text {
		font-size: 1rem;
		color: #525252;
		line-height: 1.6;
	}

	.example-text code {
		background: #f5f5f5;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 1rem;
		color: #1a1a1a;
	}

	/* QR Code */
	.qr-code-container {
		display: none; /* Hidden on mobile */
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 1.25rem;
		background: #fafafa;
		border-radius: 12px;
		border: 1px solid #e5e5e5;
	}

	.qr-code-label {
		font-size: 0.875rem;
		color: #737373;
		font-weight: 500;
	}

	.qr-code-image {
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	/* Show QR code on desktop (768px and up) */
	@media (min-width: 768px) {
		.qr-code-container {
			display: flex;
		}
	}

	/* Already Using It Card */
	.already-using-card {
		background: #f0f9ff;
		border-radius: 16px;
		padding: 2.5rem 2rem;
		text-align: center;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		border: 1px solid #bfdbfe;
	}

	/* CTA Section */
	.cta-section {
		margin-bottom: 0;
	}

	.cta-label {
		display: block;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1a1a1a;
		margin-bottom: 1rem;
		text-align: center;
	}

	.input-group {
		display: flex;
		gap: 0.75rem;
		max-width: 500px;
		margin: 0 auto;
	}

	.phone-input {
		flex: 1;
		padding: 1rem 1.25rem;
		font-size: 1.125rem;
		border: 2px solid #e5e5e5;
		border-radius: 8px;
		outline: none;
		transition: border-color 0.2s;
		font-family: inherit;
	}

	.phone-input:focus {
		border-color: #2563eb;
	}

	.phone-input::placeholder {
		color: #a3a3a3;
	}

	.view-button {
		padding: 1rem 2rem;
		font-size: 1.125rem;
		font-weight: 600;
		color: white;
		background: #2563eb;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.2s;
		white-space: nowrap;
		font-family: inherit;
	}

	.view-button:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.view-button:disabled {
		background: #d4d4d4;
		cursor: not-allowed;
	}

	/* Footer Help */
	.footer-help {
		text-align: center;
		font-size: 0.9375rem;
		color: #737373;
		padding-top: 2rem;
		line-height: 1.6;
	}

	.footer-help strong {
		color: #525252;
		font-weight: 600;
	}

	.footer-help a {
		color: #2563eb;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s;
	}

	.footer-help a:hover {
		color: #1d4ed8;
		text-decoration: underline;
	}

	/* Feedback Note */
	.feedback-note {
		text-align: center;
		font-size: 0.9375rem;
		color: #525252;
		line-height: 1.6;
		background: #fef3c7;
		border: 1px solid #fbbf24;
		border-radius: 8px;
		padding: 1rem 1.5rem;
		margin-top: 2rem;
	}

	.feedback-note strong {
		color: #1a1a1a;
		font-weight: 600;
	}

	/* Responsive */
	@media (max-width: 767px) {
		.demo-content {
			flex-direction: column;
			gap: 0;
		}
	}

	@media (max-width: 640px) {
		h1 {
			font-size: 2.25rem;
		}

		.tagline {
			font-size: 1.25rem;
		}

		.phone-number {
			font-size: 2rem;
		}

		.demo-section {
			padding: 2rem 1.5rem;
		}

		.input-group {
			flex-direction: column;
		}

		.view-button {
			width: 100%;
		}
	}
</style>
