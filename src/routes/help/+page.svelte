<svelte:head>
    <title>Help - TBR.fyi</title>
</svelte:head>

<div class="help-page">
    <div class="help-content">
        <a href="/" class="back-link">&larr; Home</a>

        <!-- Header -->
        <header class="help-header">
            <h1 class="page-title">Help</h1>
            <p class="help-subtitle">A quick reference for using TBR.fyi</p>
        </header>

        <!-- Getting Started -->
        <section class="help-section">
            <h2 class="section-heading">Getting started</h2>

            <ol class="numbered-list">
                <li>Text anything to <a href="sms:+13605044327" class="phone-link">(360) 504-4327</a></li>
                <li>You'll receive a welcome message</li>
                <li>Reply START to opt in and activate your account</li>
                <li>Start adding books—a "TBR" shelf is automatically created for you</li>
            </ol>

            <div class="tip-block">
                <p class="tip-label">Try it now</p>
                <p>
                    Text <span class="mono">9780547928227</span> to add <em class="book-title">The Hobbit</em> to your shelf.
                </p>
            </div>
        </section>

        <hr class="ghost-rule" />

        <!-- Adding Books -->
        <section class="help-section">
            <h2 class="section-heading">Adding books</h2>

            <h3 class="method-label">Via SMS</h3>
            <p>Text any of these to <a href="sms:+13605044327" class="phone-link">(360) 504-4327</a>:</p>
            <ul class="simple-list">
                <li>An ISBN (10 or 13 digits)</li>
                <li>A title and author ("The Hobbit by Tolkien")</li>
                <li>A photo of a cover or barcode</li>
                <li>An Amazon link</li>
            </ul>

            <h3 class="method-label">Via web</h3>
            <p>
                Click the <strong>+</strong> button on your shelf page. You can enter an ISBN, paste an Amazon URL, search by title/author, or upload a photo.
            </p>

            <h3 class="method-label">SMS commands</h3>
            <ul class="simple-list">
                <li><span class="mono">ADD</span> — Add the last suggested book to your shelf</li>
                <li><span class="mono">HELP</span> — Get a quick command reference</li>
                <li><span class="mono">STOP</span> — Unsubscribe from SMS messages</li>
                <li><span class="mono">START</span> — Re-subscribe to SMS messages</li>
            </ul>
        </section>

        <hr class="ghost-rule" />

        <!-- Managing Your Library -->
        <section class="help-section">
            <h2 class="section-heading">Managing your library</h2>

            <h3 class="method-label">Shelves</h3>
            <p>
                Your TBR shelf is created automatically. You can add custom shelves (Favorites, Currently Reading, etc.) by clicking "+ New Shelf." Deleting a shelf removes the organization, not the books—they'll still appear in All Books.
            </p>

            <h3 class="method-label">Book actions</h3>
            <ul class="simple-list">
                <li><strong>Read/Unread</strong> — Click the green badge to toggle</li>
                <li><strong>Owned</strong> — Click the blue badge to mark books you own</li>
                <li><strong>Notes</strong> — Add context like "Recommended on Fresh Air"</li>
                <li><strong>Shelves</strong> — Click "+ Add to shelf" to organize</li>
                <li><strong>Delete</strong> — Removes from all shelves</li>
            </ul>
            <p>
                Marking a book as read doesn't remove it from any shelves—it stays where you put it until you move it.
            </p>

            <h3 class="method-label">View modes</h3>
            <p>
                Grid view shows covers with flip cards for details. List view is more compact with everything visible at once.
            </p>
        </section>

        <hr class="ghost-rule" />

        <!-- Exporting Your Data -->
        <section class="help-section">
            <h2 class="section-heading">Your data is always yours</h2>

            <p>
                You can export your books and notes anytime. No lock-in, no friction.
            </p>

            <h3 class="method-label">Export formats</h3>
            <ul class="simple-list">
                <li><strong>CSV (Goodreads format)</strong> — Compatible with most book tracking apps</li>
                <li><strong>JSON</strong> — For developers or full data backup</li>
            </ul>

            <h3 class="method-label">Want to move your list somewhere else? Here's how.</h3>
            <ul class="simple-list">
                <li><strong>StoryGraph</strong> — Manage Account &rarr; Goodreads Import</li>
                <li><strong>Hardcover</strong> — Settings &rarr; Import</li>
                <li><strong>BookWyrm</strong> — Settings &rarr; Import</li>
                <li><strong>Literal</strong> — Settings &rarr; Import from Goodreads</li>
            </ul>

            <div class="tip-block">
                <p class="tip-label">What's included</p>
                <p>
                    Titles, authors, ISBNs, read/unread status, owned status, shelf assignments, notes, and publication info.
                </p>
            </div>
        </section>

        <hr class="ghost-rule" />

        <!-- FAQs -->
        <section class="help-section">
            <h2 class="section-heading">FAQs</h2>

            <h3 class="faq-question">Why isn't my book being found?</h3>
            <p>
                Some books aren't in Google Books. Try using the ISBN from the copyright page instead of the back cover, or try the other format (ISBN-10 vs ISBN-13). You can also search by exact title and author.
            </p>

            <h3 class="faq-question">What if I text the same ISBN twice?</h3>
            <p>
                Duplicates are detected automatically. You'll get a confirmation that the book is already on your shelf.
            </p>

            <h3 class="faq-question">Why are my barcode photos not working?</h3>
            <p>
                Good lighting helps. Keep the barcode in focus, fill most of the frame, avoid glare, and make sure the entire barcode is visible.
            </p>

            <h3 class="faq-question">How does cover photo recognition work?</h3>
            <p>
                When you send a photo of a book cover, TBR reads the title and author from the image and searches for a match. Clear, well-lit photos work best. If the cover isn't recognized, try texting the title and author directly.
            </p>

            <h3 class="faq-question">Can multiple people use the same phone number?</h3>
            <p>
                No, each phone number has its own library. This keeps your reading list private.
            </p>

            <h3 class="faq-question">Why is the cover image missing or low quality?</h3>
            <p>
                Cover images come from Google Books. Older or less common books sometimes don't have high-quality covers available.
            </p>
        </section>

        <hr class="ghost-rule" />

        <!-- Troubleshooting -->
        <section class="help-section">
            <h2 class="section-heading">Troubleshooting</h2>

            <h3 class="faq-question">Not receiving SMS responses?</h3>
            <p>
                Check that you've sent START to opt in. Verify you're texting <a href="sms:+13605044327" class="phone-link">(360) 504-4327</a>. SMS delivery can take 10-30 seconds. Some carriers block automated messages.
            </p>

            <h3 class="faq-question">Shelf page not loading?</h3>
            <p>
                Clear your browser cache and refresh, or try incognito mode. Make sure the phone number format includes the country code (+1 for US).
            </p>

            <h3 class="faq-question">Books not showing up after adding?</h3>
            <p>
                Refresh your shelf page and check that you're viewing the correct shelf (try "All Books"). Verify you received a confirmation SMS.
            </p>

            <h3 class="method-label">Common error messages</h3>
            <ul class="simple-list">
                <li><strong>"Invalid ISBN"</strong> — Check for typos or try the other format (10-digit vs 13-digit)</li>
                <li><strong>"Book not found"</strong> — The book may not be in Google Books; try searching by title/author</li>
                <li><strong>"Already on your shelf"</strong> — This book is already in your library</li>
            </ul>
        </section>

        <hr class="ghost-rule" />

        <!-- Closing Signature -->
        <section class="closing-signature">
            <p>Need more help? Text <span class="mono">HELP</span> to <a href="sms:+13605044327" class="phone-link">(360) 504-4327</a> for a quick command reference.</p>
            <p class="closing-secondary">Found a bug? <a href="https://github.com/stevenpate/tbr-fyi-beta/issues" target="_blank" rel="noopener noreferrer">Open an issue on GitHub</a>.</p>
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

    .help-page {
        max-width: 640px;
        margin: 0 auto;
        padding: 48px 24px;
    }

    .help-header {
        margin-bottom: 40px;
    }

    .help-subtitle {
        font-size: var(--text-base);
        color: var(--text-secondary);
        margin-top: 12px;
    }

    .help-section p {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        line-height: 1.6;
        margin-bottom: 12px;
    }

    .help-section a:not(.phone-link) {
        color: var(--accent);
        text-decoration: underline;
        text-underline-offset: 2px;
        text-decoration-thickness: 1px;
    }

    .help-section a:not(.phone-link):hover {
        color: var(--accent-hover);
    }

    .method-label {
        font-family: var(--font-sans);
        font-weight: 500;
        font-size: var(--text-sm);
        color: var(--text-primary);
        margin-top: 20px;
        margin-bottom: 8px;
    }

    .faq-question {
        font-family: var(--font-sans);
        font-weight: 500;
        font-size: var(--text-sm);
        color: var(--text-primary);
        margin-top: 20px;
        margin-bottom: 6px;
    }

    .numbered-list {
        list-style: decimal;
        padding-left: 20px;
        margin: 0 0 16px;
    }

    .numbered-list li {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        line-height: 1.6;
        margin-bottom: 6px;
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

    .tip-block {
        background: var(--background-alt);
        border-radius: 4px;
        padding: 16px;
        margin: 16px 0;
    }

    .tip-block p {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        line-height: 1.6;
        margin-bottom: 4px;
    }

    .tip-label {
        font-weight: 500;
        color: var(--text-primary) !important;
        margin-bottom: 6px !important;
    }

    .mono {
        font-family: ui-monospace, 'SF Mono', monospace;
        font-size: 0.9em;
        background: var(--background-alt);
        padding: 2px 5px;
        border-radius: 3px;
    }

    .book-title {
        font-family: var(--font-serif);
        font-style: italic;
        font-size: calc(var(--text-base) * 1.3);
    }

    .closing-signature {
        text-align: center;
    }

    .closing-signature p {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        margin-bottom: 8px;
    }

    .closing-secondary {
        font-size: var(--text-xs) !important;
        color: var(--text-tertiary) !important;
    }

    .closing-secondary a {
        color: var(--accent);
        text-decoration: underline;
        text-underline-offset: 2px;
        text-decoration-thickness: 1px;
    }

    .closing-secondary a:hover {
        color: var(--accent-hover);
    }
</style>
