<script lang="ts">
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    let identifier = $state('');
    let isReturningUser = $state(false);
    let currentSlide = $state(0);
    let touchStartX = $state(0);
    let touchEndX = $state(0);
    let carouselElement: HTMLDivElement;

    const totalSlides = 2;

    onMount(() => {
        // Check if user has visited before
        const savedId = localStorage.getItem('tbr-userId') || '';
        if (savedId) {
            identifier = savedId;
            isReturningUser = true;
        }
    });

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
                // Swipe left - next slide
                currentSlide++;
            } else if (diff < 0 && currentSlide > 0) {
                // Swipe right - previous slide
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
    <title>TBR.fyi – text yourself books</title>
    <meta name="description" content="Someone mentions a book on a podcast, in a group chat, or across the table from you—text it to TBR.fyi and it lands on your shelf. No app to install. No account to remember." />
    <meta property="og:title" content="TBR.fyi – text yourself books" />
    <meta property="og:description" content="Text yourself book recommendations. No app to install. No account to remember." />
    <meta property="og:image" content="https://tbr.fyi/og-image.png" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://tbr.fyi" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="https://tbr.fyi/og-image.png" />
</svelte:head>

<div class="landing">
    <!-- Header / Logo -->
    <header>
        <div class="lockup">
            <img src="/tbr-lockup-transparent.png" alt="TBR.fyi logo" class="lockup-icon" />
        </div>
    </header>

    <!-- Hero -->
    <section class="hero">
        <h1>text yourself books</h1>
        <p>Someone mentions a book on a podcast, in a group chat, or across the table from you—text it to TBR.fyi and it lands on your shelf. No app to install. No account to remember.</p>
        <p class="closing">Never lose a book recommendation again.</p>
    </section>

    <!-- Returning User: Show login first -->
    {#if isReturningUser}
        <section class="login login-returning">
            <div class="login-inner">
                <h2><span class="nowrap">Already using it?</span> <span class="nowrap">Welcome back!</span></h2>
                <form class="login-form" onsubmit={handleSubmit}>
                    <label for="identifier-top" class="sr-only">Phone number or username</label>
                    <input
                        type="text"
                        id="identifier-top"
                        name="identifier"
                        bind:value={identifier}
                        placeholder="Enter your phone number or username"
                        class="login-input"
                    />
                    <button
                        type="submit"
                        disabled={!identifier}
                        class="login-button"
                    >
                        View your shelf
                    </button>
                </form>
            </div>
        </section>

        <section class="beta-notice">
            <h3 class="beta-heading">This is a beta</h3>
            <p class="beta-text">If you have thoughts—or something breaks—the feedback button in the corner is there for a reason. Your input is very welcome!</p>
            <p class="beta-links"><a href="/about">About</a> · <a href="/help">Help</a></p>
        </section>
    {/if}

    <!-- How It Works -->
    <section class="how-it-works">
        <div class="how-it-works-inner">
            <h2>How it works</h2>
            <div class="steps">
                <div class="step">
                    <div class="step-number">1</div>
                    <h3>Text START</h3>
                    <p>Send START to <strong>+1 (360) 504-4327</strong> to get your personal TBR number.</p>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <h3>Text a book</h3>
                    <p>Text the title. Snap the barcode. Or send a link.</p>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <h3>We'll find it</h3>
                    <p>We match it to the right book and add it to your list.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Phone Demo Carousel -->
    <section class="example">
        <div
            class="carousel-container"
            bind:this={carouselElement}
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
                            <div class="bubble"><span class="book-title">Braiding Sweetgrass</span></div>
                        </div>
                        <div class="message incoming">
                            <div class="bubble">Got it! Added <span class="book-title">Braiding Sweetgrass</span> by Robin Wall Kimmerer to your list. 📚</div>
                        </div>
                        <div class="message outgoing">
                            <div class="bubble image-bubble">
                                <img src="/barcode.png" alt="Photo of book barcode" />
                            </div>
                        </div>
                        <div class="message incoming">
                            <div class="bubble">Added <span class="book-title">All Systems Red</span> by Martha Wells. 📚</div>
                        </div>
                        <div class="message outgoing">
                            <div class="bubble">https://amazon.com/dp/...</div>
                        </div>
                        <div class="message incoming">
                            <div class="bubble">Added <span class="book-title">The Pearl</span> by John Steinbeck to your list. 📚</div>
                        </div>
                    </div>
                </div>

                <!-- Slide 2: Shelf Screenshot -->
                <div class="carousel-slide">
                    <div class="phone-mock phone-mock-shelf">
                        <img src="/shelf-mockup.png" alt="Your reading list with book covers and titles" class="shelf-screenshot" />
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
        <p class="carousel-hint">Swipe to see your shelf</p>
    </section>

    <!-- Benefits -->
    <section class="benefits">
        <h2>What's Next?</h2>
        <ul class="benefits-list">
            <li>
                <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Access anywhere—from text thread or at tbr.fyi</span>
            </li>
            <li>
                <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Keep track of lists, mark status, add notes, and more</span>
            </li>
            <li>
                <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Show a barcode to get help finding EXACTLY what you want</span>
            </li>
            <li>
                <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Export to Goodreads, StoryGraph, etc.</span>
            </li>
        </ul>
    </section>

    <!-- Login Section (only for new users) -->
    {#if !isReturningUser}
        <section class="login">
            <div class="login-inner">
                <h2>Already using it?</h2>
                <form class="login-form" onsubmit={handleSubmit}>
                    <label for="identifier" class="sr-only">Phone number or username</label>
                    <input
                        type="text"
                        id="identifier"
                        name="identifier"
                        bind:value={identifier}
                        placeholder="Enter your phone number or username"
                        class="login-input"
                    />
                    <button
                        type="submit"
                        disabled={!identifier}
                        class="login-button"
                    >
                        View your shelf
                    </button>
                    <p class="login-help">
                        Text <code>HELP</code> to the number above for commands, or see the <a href="/help">help page</a>.
                    </p>
                </form>
            </div>
        </section>
    {/if}

    <!-- Footer (only for new users) -->
    {#if !isReturningUser}
        <footer>
            <h3 class="footer-heading">This is a beta</h3>
            <p class="footer-early">If you have thoughts—or something breaks—the feedback button in the corner is there for a reason. Your input is very welcome!</p>
            <p class="footer-links"><a href="/about">About</a> · <a href="/help">Help</a></p>
        </footer>
    {/if}
</div>

<style>
    /* Landing page styles using design system tokens */
    .landing {
        font-family: var(--font-sans);
        background: var(--background);
        color: var(--text-primary);
        line-height: 1.6;
        min-height: 100vh;
    }

    /* Header / Logo */
    header {
        padding: 48px 24px 32px;
        display: flex;
        justify-content: center;
    }

    .lockup {
        display: flex;
        align-items: center;
        gap: 20px;
    }

    .lockup-icon {
        height: 80px;
        width: auto;
    }

    /* Hero */
    .hero {
        text-align: center;
        padding: 24px 24px 64px;
        max-width: 600px;
        margin: 0 auto;
    }

    .hero h1 {
        font-family: var(--font-serif);
        font-weight: 400;
        font-style: italic;
        font-size: 28px;
        color: var(--text-secondary);
        margin-bottom: 32px;
    }

    .hero p {
        font-size: 18px;
        color: var(--text-secondary);
        margin-bottom: 24px;
        max-width: 460px;
        margin-left: auto;
        margin-right: auto;
    }

    .hero .closing {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 40px;
    }

    /* How it works */
    .how-it-works {
        background: var(--background-alt);
        padding: 64px 24px;
    }

    .how-it-works-inner {
        max-width: 800px;
        margin: 0 auto;
    }

    .how-it-works h2 {
        font-family: var(--font-serif);
        font-weight: 600;
        font-size: 22px;
        color: var(--text-primary);
        text-align: center;
        margin-bottom: 48px;
    }

    .steps {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 32px;
    }

    .step {
        text-align: center;
    }

    .step-number {
        width: 40px;
        height: 40px;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        font-weight: 600;
        font-size: 16px;
        color: var(--accent);
    }

    .step h3 {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 8px;
    }

    .step p {
        font-size: 14px;
        color: var(--text-secondary);
    }

    /* Example / Phone mock carousel */
    .example {
        padding: 64px 24px;
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
        border: 1.5px solid var(--terracotta-dark);
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
        font-size: 13px;
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
        font-size: 15px;
        max-width: 85%;
    }

    .message.outgoing .bubble {
        background: var(--accent);
        color: var(--white);
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

    /* Benefits section */
    .benefits {
        padding: 64px 24px;
        background: var(--background);
        text-align: center;
    }

    .benefits h2 {
        font-family: var(--font-serif);
        font-weight: 600;
        font-size: 22px;
        color: var(--text-primary);
        margin-bottom: 32px;
    }

    .benefits-list {
        list-style: none;
        padding: 0;
        margin: 0 auto;
        max-width: 600px;
        text-align: left;
    }

    .benefits-list li {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 24px;
        font-size: 17px;
        color: var(--text-primary);
    }

    .benefits-list li:last-child {
        margin-bottom: 0;
    }

    .check-icon {
        width: 22px;
        height: 22px;
        flex-shrink: 0;
        color: var(--accent);
        margin-top: 2px;
    }

    /* Login section */
    .login {
        padding: 64px 24px;
        background: var(--surface);
        border-top: 1px solid var(--border);
    }

    .login-returning {
        background: var(--background-alt);
        border-top: none;
        border-bottom: none;
        padding: 48px 24px;
    }

    .beta-notice {
        background: var(--surface);
        padding: 32px 24px;
        text-align: center;
        border-bottom: 1px solid var(--border);
    }

    .beta-heading {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 8px;
    }

    .beta-text {
        font-size: 15px;
        color: var(--text-secondary);
        max-width: 600px;
        margin: 0 auto;
    }

    .beta-links {
        font-size: 14px;
        margin-top: 16px;
        color: var(--text-secondary);
    }

    .beta-links a {
        color: var(--accent-hover);
        text-decoration: none;
    }

    .beta-links a:hover {
        text-decoration: underline;
    }

    .login-inner {
        max-width: 600px;
        margin: 0 auto;
        text-align: center;
    }

    .login h2 {
        font-size: 24px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 32px;
    }

    .login-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        align-items: center;
    }

    .login-input {
        width: 100%;
        max-width: 500px;
        padding: 14px 18px;
        font-size: 16px;
        font-family: var(--font-sans);
        color: var(--text-primary);
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 8px;
        transition: border-color 0.2s ease;
        text-align: center;
    }

    .login-input::placeholder {
        color: #a8a39e;
    }

    .login-input:focus {
        outline: none;
        border-color: var(--accent);
    }

    .login-button {
        width: 100%;
        max-width: 500px;
        padding: 14px 28px;
        font-size: 16px;
        font-weight: 500;
        font-family: var(--font-sans);
        color: var(--white);
        background: var(--accent);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s ease;
    }

    .login-button:hover:not(:disabled) {
        background: var(--accent-hover);
    }

    .login-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .login-help {
        font-size: 14px;
        color: var(--text-secondary);
        max-width: 500px;
        margin-top: 8px;
    }

    .login-help code {
        font-family: ui-monospace, monospace;
        background: var(--background-alt);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 13px;
    }

    .login-help a {
        color: var(--accent-hover);
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: border-color 0.2s ease;
    }

    .login-help a:hover {
        border-bottom-color: var(--accent-hover);
    }

    /* Footer */
    footer {
        padding: 48px 24px;
        text-align: center;
        color: var(--text-secondary);
    }

    .footer-heading {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 12px;
    }

    .footer-early {
        font-size: 15px;
        margin-bottom: 16px;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
    }

    .footer-links {
        font-size: 14px;
    }

    footer a {
        color: var(--accent-hover);
        text-decoration: none;
    }

    footer a:hover {
        text-decoration: underline;
    }

    /* Utility */
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    .nowrap {
        white-space: nowrap;
    }
</style>
