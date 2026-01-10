<svelte:head>
    <title>Help - TBR.fyi</title>
</svelte:head>

<div class="static-page">
    <div class="max-w-3xl mx-auto px-4 py-16">
        <!-- Header -->
        <div class="mb-8">
            <a href="/" class="text-[var(--accent-hover)] hover:text-[var(--accent)] text-sm">← Back to Home</a>
        </div>

        <div class="text-center mb-12">
            <h1 class="text-4xl text-[var(--text-primary)] mb-4 page-title">Help</h1>
            <p class="text-xl text-[var(--text-secondary)]">A quick reference for using TBR.fyi</p>
        </div>

        <!-- Getting Started -->
        <div class="card">
            <h2 id="getting-started" class="text-2xl font-semibold text-[var(--text-primary)] mb-4">Getting started</h2>

            <div class="space-y-4 text-[var(--text-secondary)]">
                <ol class="list-decimal list-inside space-y-2">
                    <li>Text anything to <a href="sms:+13605044327" class="font-mono text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">+1 (360) 504-4327</a></li>
                    <li>You'll receive a welcome message</li>
                    <li>Reply START to opt in and activate your account</li>
                    <li>Start adding books—a "TBR" shelf is automatically created for you</li>
                </ol>

                <div class="bg-[var(--paper-light)] rounded-lg p-4 mt-6">
                    <p class="font-semibold text-[var(--text-primary)] mb-2">Try it now</p>
                    <p class="text-sm text-[var(--text-secondary)]">
                        Text <span class="font-mono">9780547928227</span> to add <em class="book-title">The Hobbit</em> to your shelf.
                    </p>
                </div>
            </div>
        </div>

        <!-- Adding Books -->
        <div class="card">
            <h2 id="adding-books" class="text-2xl font-semibold text-[var(--text-primary)] mb-4">Adding books</h2>

            <div class="space-y-6 text-[var(--text-secondary)]">
                <div>
                    <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-3">Via SMS</h3>
                    <p class="mb-3">Text any of these to <a href="sms:+13605044327" class="font-mono text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">+1 (360) 504-4327</a>:</p>
                    <ul class="space-y-2 text-sm ml-4">
                        <li>• An ISBN (10 or 13 digits)</li>
                        <li>• A title and author ("The Hobbit by Tolkien")</li>
                        <li>• A photo of a barcode</li>
                        <li>• An Amazon link</li>
                    </ul>
                </div>

                <div>
                    <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-3">Via web</h3>
                    <p class="text-sm">
                        Click the <strong>+</strong> button on your shelf page. You can enter an ISBN, paste an Amazon URL, search by title/author, or upload a photo.
                    </p>
                </div>

                <div>
                    <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-3">SMS commands</h3>
                    <ul class="space-y-2 text-sm ml-4">
                        <li><span class="font-mono bg-[var(--paper-light)] px-2 py-0.5 rounded">ADD</span> — Add the last suggested book to your shelf</li>
                        <li><span class="font-mono bg-[var(--paper-light)] px-2 py-0.5 rounded">HELP</span> — Get a quick command reference</li>
                        <li><span class="font-mono bg-[var(--paper-light)] px-2 py-0.5 rounded">STOP</span> — Unsubscribe from SMS messages</li>
                        <li><span class="font-mono bg-[var(--paper-light)] px-2 py-0.5 rounded">START</span> — Re-subscribe to SMS messages</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Managing Your Library -->
        <div class="card">
            <h2 id="managing" class="text-2xl font-semibold text-[var(--text-primary)] mb-4">Managing your library</h2>

            <div class="space-y-6 text-[var(--text-secondary)]">
                <div>
                    <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-3">Shelves</h3>
                    <p class="text-sm">
                        Your TBR shelf is created automatically. You can add custom shelves (Favorites, Currently Reading, etc.) by clicking "+ New Shelf." Deleting a shelf removes the organization, not the books—they'll still appear in All Books.
                    </p>
                </div>

                <div>
                    <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-3">Book actions</h3>
                    <ul class="space-y-2 text-sm ml-4">
                        <li>• <strong>Read/Unread</strong> — Click the green badge to toggle</li>
                        <li>• <strong>Owned</strong> — Click the blue badge to mark books you own</li>
                        <li>• <strong>Notes</strong> — Add context like "Recommended on Fresh Air"</li>
                        <li>• <strong>Shelves</strong> — Click "+ Add to shelf" to organize</li>
                        <li>• <strong>Delete</strong> — Removes from all shelves</li>
                    </ul>
                    <p class="text-sm mt-3 text-[var(--text-secondary)]">
                        Marking a book as read doesn't remove it from any shelves—it stays where you put it until you move it.
                    </p>
                </div>

                <div>
                    <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-3">View modes</h3>
                    <p class="text-sm">
                        Grid view shows covers with flip cards for details. List view is more compact with everything visible at once.
                    </p>
                </div>
            </div>
        </div>

        <!-- Exporting Your Data -->
        <div class="card">
            <h2 id="exporting" class="text-2xl font-semibold text-[var(--text-primary)] mb-4">Exporting your data</h2>

            <div class="space-y-6 text-[var(--text-secondary)]">
                <p class="text-sm">
                    Your data belongs to you. Export your complete library anytime from your Settings page.
                </p>

                <div>
                    <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-3">Export formats</h3>
                    <ul class="space-y-2 text-sm ml-4">
                        <li>• <strong>CSV (Goodreads format)</strong> — Compatible with StoryGraph, Hardcover, BookWyrm, Literal, and most book tracking apps</li>
                        <li>• <strong>JSON</strong> — For developers or full data backup</li>
                    </ul>
                </div>

                <div>
                    <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-3">Import to other platforms</h3>
                    <ul class="space-y-2 text-sm ml-4">
                        <li>• <strong>StoryGraph</strong> — Manage Account &rarr; Goodreads Import</li>
                        <li>• <strong>Hardcover</strong> — Settings &rarr; Import</li>
                        <li>• <strong>BookWyrm</strong> — Settings &rarr; Import</li>
                        <li>• <strong>Literal</strong> — Settings &rarr; Import from Goodreads</li>
                    </ul>
                </div>

                <div class="bg-[var(--paper-light)] rounded-lg p-4">
                    <p class="font-semibold text-[var(--text-primary)] mb-2">What's included</p>
                    <p class="text-sm text-[var(--text-secondary)]">
                        Titles, authors, ISBNs, read/unread status, owned status, shelf assignments, notes, and publication info.
                    </p>
                </div>
            </div>
        </div>

        <!-- FAQs -->
        <div class="card">
            <h2 id="faqs" class="text-2xl font-semibold text-[var(--text-primary)] mb-4">FAQs</h2>

            <div class="space-y-6 text-[var(--text-secondary)]">
                <div>
                    <h3 class="text-base font-semibold text-[var(--text-primary)] mb-2">Why isn't my book being found?</h3>
                    <p class="text-sm">
                        Some books aren't in Google Books. Try using the ISBN from the copyright page instead of the back cover, or try the other format (ISBN-10 vs ISBN-13). You can also search by exact title and author.
                    </p>
                </div>

                <div>
                    <h3 class="text-base font-semibold text-[var(--text-primary)] mb-2">What if I text the same ISBN twice?</h3>
                    <p class="text-sm">
                        Duplicates are detected automatically. You'll get a confirmation that the book is already on your shelf.
                    </p>
                </div>

                <div>
                    <h3 class="text-base font-semibold text-[var(--text-primary)] mb-2">Why are my barcode photos not working?</h3>
                    <p class="text-sm">
                        Good lighting helps. Keep the barcode in focus, fill most of the frame, avoid glare, and make sure the entire barcode is visible.
                    </p>
                </div>

                <div>
                    <h3 class="text-base font-semibold text-[var(--text-primary)] mb-2">Why can't I send a photo of the book cover?</h3>
                    <p class="text-sm">
                        Reliably extracting title and author from cover images is surprisingly complex—there's a lot of variation in cover design. For now, we're focused on features that work reliably. Once the core experience is solid, cover recognition is on the list.
                    </p>
                </div>

                <div>
                    <h3 class="text-base font-semibold text-[var(--text-primary)] mb-2">Can multiple people use the same phone number?</h3>
                    <p class="text-sm">
                        No, each phone number has its own library. This keeps your reading list private.
                    </p>
                </div>

                <div>
                    <h3 class="text-base font-semibold text-[var(--text-primary)] mb-2">Why is the cover image missing or low quality?</h3>
                    <p class="text-sm">
                        Cover images come from Google Books. Older or less common books sometimes don't have high-quality covers available.
                    </p>
                </div>
            </div>
        </div>

        <!-- Troubleshooting -->
        <div class="card">
            <h2 id="troubleshooting" class="text-2xl font-semibold text-[var(--text-primary)] mb-4">Troubleshooting</h2>

            <div class="space-y-6 text-[var(--text-secondary)]">
                <div>
                    <h3 class="text-base font-semibold text-[var(--text-primary)] mb-2">Not receiving SMS responses?</h3>
                    <p class="text-sm">
                        Check that you've sent START to opt in. Verify you're texting <a href="sms:+13605044327" class="font-mono text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">+1 (360) 504-4327</a>. SMS delivery can take 10-30 seconds. Some carriers block automated messages.
                    </p>
                </div>

                <div>
                    <h3 class="text-base font-semibold text-[var(--text-primary)] mb-2">Shelf page not loading?</h3>
                    <p class="text-sm">
                        Clear your browser cache and refresh, or try incognito mode. Make sure the phone number format includes the country code (+1 for US).
                    </p>
                </div>

                <div>
                    <h3 class="text-base font-semibold text-[var(--text-primary)] mb-2">Books not showing up after adding?</h3>
                    <p class="text-sm">
                        Refresh your shelf page and check that you're viewing the correct shelf (try "All Books"). Verify you received a confirmation SMS.
                    </p>
                </div>

                <div>
                    <h3 class="text-base font-semibold text-[var(--text-primary)] mb-3">Common error messages</h3>
                    <ul class="space-y-2 text-sm ml-4">
                        <li><strong>"Invalid ISBN"</strong> — Check for typos or try the other format (10-digit vs 13-digit)</li>
                        <li><strong>"Book not found"</strong> — The book may not be in Google Books; try searching by title/author</li>
                        <li><strong>"Already on your shelf"</strong> — This book is already in your library</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Need More Help -->
        <div class="cta-card">
            <h2 class="text-2xl font-semibold mb-4">Need more help?</h2>

            <div class="space-y-3 text-white/90">
                <p>
                    Text <span class="font-mono bg-[var(--terracotta-dark)] px-2 py-0.5 rounded">HELP</span> to <a href="sms:+13605044327" class="font-mono hover:text-white transition-colors">+1 (360) 504-4327</a> for a quick command reference.
                </p>
                <p>
                    Found a bug or have feedback? <a href="https://github.com/stevenpate/tbr-fyi-beta/issues" target="_blank" rel="noopener noreferrer" class="underline hover:text-white">Open an issue on GitHub</a>.
                </p>
            </div>
        </div>
    </div>
</div>

<style>
    .static-page {
        font-family: var(--font-sans);
        background: var(--background);
        color: var(--text-primary);
        min-height: 100vh;
    }

    .page-title {
        font-family: var(--font-serif);
        font-style: italic;
        font-weight: 400;
    }

    .book-title {
        font-family: var(--font-serif);
        font-style: italic;
    }

    .card {
        background: var(--surface);
        border-radius: 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        padding: 32px;
        margin-bottom: 24px;
        border: 1px solid var(--border);
    }

    .cta-card {
        background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
        border-radius: 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 32px;
        color: white;
    }
</style>
